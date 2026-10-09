/**
 * Production entry: Next.js + authenticated reverse proxy at /bridge/:id/*
 *
 * Browsers strip user:pass@host URLs, and Cockpit uses session cookies via
 * /cockpit/login — so we proxy and inject credentials server-side.
 */
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");
const { URL } = require("node:url");

const dir = __dirname;
process.env.NODE_ENV = "production";
process.chdir(dir);

const currentPort = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(dir, "data");
const DB_PATH = path.join(DATA_DIR, "portal.db");

// Reuse standalone config embedded in the default server.js
try {
  const serverSrc = fs.readFileSync(path.join(dir, "server.js"), "utf8");
  const start = serverSrc.indexOf("const nextConfig = ");
  const end = serverSrc.indexOf(
    "\nprocess.env.__NEXT_PRIVATE_STANDALONE_CONFIG"
  );
  if (start >= 0 && end > start && !process.env.__NEXT_PRIVATE_STANDALONE_CONFIG) {
    const jsonPart = serverSrc.slice(
      start + "const nextConfig = ".length,
      end
    );
    const nextConfig = JSON.parse(jsonPart);
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);
  }
} catch (err) {
  console.warn("[bridge] could not load standalone config:", err.message);
}

require("next");
const { getRequestHandlers } = require("next/dist/server/lib/start-server");

/** @type {Map<number, { cookieHeader: string, mode: 'cockpit' | 'basic', basicHeader?: string, obtainedAt: number }>} */
const sessions = new Map();

function normalizeHttpUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isPrivateHost(hostName) {
  const host = hostName.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

function looksLikeCockpit(url) {
  try {
    const u = new URL(normalizeHttpUrl(url));
    return u.port === "9090" || /cockpit/i.test(`${u.pathname}${u.hostname}`);
  } catch {
    return false;
  }
}

function loadLink(id) {
  const Database = require("better-sqlite3");
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    return db.prepare("SELECT * FROM links WHERE id = ? AND enabled = 1").get(id);
  } finally {
    db.close();
  }
}

function basicAuthHeader(username, password) {
  const token = Buffer.from(`${username}:${password ?? ""}`, "utf8").toString(
    "base64"
  );
  return `Basic ${token}`;
}

function requestUpstream(targetUrl, options) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: options.timeoutMs || 15000,
        rejectUnauthorized: !(isHttps && isPrivateHost(u.hostname)),
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("upstream timeout")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function ensureSession(link) {
  const id = link.id;
  const existing = sessions.get(id);
  if (existing && Date.now() - existing.obtainedAt < 10 * 60 * 1000) {
    return existing;
  }

  const username = link.auth_username;
  const password = link.auth_password || "";
  if (!username) throw new Error("Link has no credentials");

  const target = new URL(normalizeHttpUrl(link.url));
  const auth = basicAuthHeader(username, password);

  if (looksLikeCockpit(link.url)) {
    const loginUrl = new URL("/cockpit/login", target);
    const res = await requestUpstream(loginUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "User-Agent": "ops-portal-bridge/1.0",
      },
    });
    if (res.statusCode !== 200) {
      throw new Error(
        `Cockpit login failed (HTTP ${res.statusCode}): ${res.body
          .toString("utf8")
          .slice(0, 200)}`
      );
    }
    const setCookie = res.headers["set-cookie"];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const cockpit = cookies
      .map((c) => c.split(";")[0])
      .find((c) => c.toLowerCase().startsWith("cockpit="));
    if (!cockpit) {
      throw new Error(
        "Cockpit login succeeded but no session cookie was returned"
      );
    }
    const session = {
      mode: "cockpit",
      cookieHeader: cockpit,
      obtainedAt: Date.now(),
    };
    sessions.set(id, session);
    return session;
  }

  const session = {
    mode: "basic",
    basicHeader: auth,
    cookieHeader: "",
    obtainedAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

function rewriteHtml(html, bridgePrefix, targetOrigin) {
  let out = html;
  // Cockpit derives WebSocket paths from <meta name="url-root">.
  // Without this, it connects to /cockpit/socket instead of /bridge/N/cockpit/socket.
  const urlRoot = bridgePrefix.replace(/^\/+|\/+$/g, "");
  if (/<meta\s+name=["']url-root["']/i.test(out)) {
    out = out.replace(
      /<meta\s+name=["']url-root["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="url-root" content="${urlRoot}" />`
    );
  } else {
    out = out.replace(
      /<head([^>]*)>/i,
      `<head$1><meta name="url-root" content="${urlRoot}" />`
    );
  }
  out = out.replace(
    /<base\s+href=["']\/["']\s*\/?>/i,
    `<base href="${bridgePrefix}/">`
  );
  out = out.replace(
    /(href|src)=["']\/(?!\/)/gi,
    `$1="${bridgePrefix}/`
  );
  if (targetOrigin) {
    const escaped = targetOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), bridgePrefix);
  }
  return out;
}

function filterRequestHeaders(reqHeaders, session, targetOrigin) {
  const headers = { ...reqHeaders };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  delete headers["transfer-encoding"];
  delete headers["accept-encoding"];
  // Upstream (esp. Cockpit) validates Origin against its own host.
  if (targetOrigin) {
    headers.origin = targetOrigin;
    headers.referer = `${targetOrigin}/`;
  }
  if (session.mode === "cockpit" && session.cookieHeader) {
    headers.cookie = session.cookieHeader;
  }
  if (session.mode === "basic" && session.basicHeader) {
    headers.authorization = session.basicHeader;
  }
  return headers;
}

function filterResponseHeaders(headers, bridgePrefix, targetOrigin) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase();
    if (
      [
        "transfer-encoding",
        "connection",
        "content-length",
        "content-encoding",
        "content-security-policy",
        "x-frame-options",
      ].includes(k)
    ) {
      continue;
    }
    if (k === "set-cookie") continue;
    if (k === "location" && typeof value === "string") {
      let loc = value;
      if (targetOrigin && loc.startsWith(targetOrigin)) {
        loc = bridgePrefix + loc.slice(targetOrigin.length);
      } else if (loc.startsWith("/")) {
        loc = bridgePrefix + loc;
      }
      out[key] = loc;
      continue;
    }
    out[key] = value;
  }
  return out;
}

async function proxyHttp(clientReq, clientRes, linkId, restPath, search) {
  let link;
  try {
    link = loadLink(linkId);
  } catch (err) {
    clientRes.writeHead(500, { "Content-Type": "text/plain" });
    clientRes.end(`Database error: ${err instanceof Error ? err.message : err}`);
    return;
  }
  if (!link) {
    clientRes.writeHead(404, { "Content-Type": "text/plain" });
    clientRes.end("Link not found");
    return;
  }
  if (!link.auth_username) {
    clientRes.writeHead(400, { "Content-Type": "text/plain" });
    clientRes.end("This link has no stored credentials");
    return;
  }

  let session;
  try {
    session = await ensureSession(link);
  } catch (err) {
    clientRes.writeHead(502, { "Content-Type": "text/plain" });
    clientRes.end(
      `Authentication bridge failed: ${err instanceof Error ? err.message : err}`
    );
    return;
  }

  const target = new URL(normalizeHttpUrl(link.url));
  const targetOrigin = target.origin;
  const bridgePrefix = `/bridge/${linkId}`;
  const upstreamPath = `${restPath || "/"}${search || ""}`;
  const upstreamUrl = new URL(upstreamPath, targetOrigin);

  const method = clientReq.method || "GET";
  const chunks = [];
  for await (const chunk of clientReq) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const tryOnce = async (sess) => {
    const headers = filterRequestHeaders(
      clientReq.headers,
      sess,
      targetOrigin
    );
    headers.host = upstreamUrl.host;
    return requestUpstream(upstreamUrl.toString(), {
      method,
      headers,
      body,
      timeoutMs: 30000,
    });
  };

  let upstream = await tryOnce(session);
  if (
    session.mode === "cockpit" &&
    (upstream.statusCode === 401 || upstream.statusCode === 403)
  ) {
    sessions.delete(linkId);
    session = await ensureSession(link);
    upstream = await tryOnce(session);
  }

  const contentType = String(upstream.headers["content-type"] || "");
  const isHtml = contentType.includes("text/html");
  let responseBody = decompressBody(
    upstream.body,
    upstream.headers["content-encoding"]
  );
  const outHeaders = filterResponseHeaders(
    upstream.headers,
    bridgePrefix,
    targetOrigin
  );

  if (isHtml && responseBody.length) {
    const html = rewriteHtml(
      responseBody.toString("utf8"),
      bridgePrefix,
      targetOrigin
    );
    responseBody = Buffer.from(html, "utf8");
    outHeaders["content-type"] = "text/html; charset=utf-8";
  }
  outHeaders["content-length"] = String(responseBody.length);

  clientRes.writeHead(upstream.statusCode, outHeaders);
  clientRes.end(responseBody);
}

function decompressBody(body, contentEncoding) {
  if (!body?.length) return body || Buffer.alloc(0);
  const enc = String(contentEncoding || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    if (enc.includes("gzip")) return zlib.gunzipSync(body);
    if (enc.includes("deflate")) return zlib.inflateSync(body);
    if (enc.includes("br")) return zlib.brotliDecompressSync(body);
    // Some servers gzip without advertising; detect magic bytes
    if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
      return zlib.gunzipSync(body);
    }
  } catch (err) {
    console.warn("[bridge] decompress failed:", err.message);
  }
  return body;
}

function proxyUpgrade(clientReq, clientSocket, head, linkId, restPath, search) {
  let link;
  try {
    link = loadLink(linkId);
  } catch {
    clientSocket.destroy();
    return;
  }
  if (!link || !link.auth_username) {
    clientSocket.destroy();
    return;
  }

  ensureSession(link)
    .then((session) => {
      const target = new URL(normalizeHttpUrl(link.url));
      const isHttps = target.protocol === "https:";
      const port = Number(target.port) || (isHttps ? 443 : 80);
      const upstreamPath = `${restPath || "/"}${search || ""}`;

      const connectOpts = {
        host: target.hostname,
        port,
        servername: target.hostname,
        rejectUnauthorized: !(isHttps && isPrivateHost(target.hostname)),
      };

      const upstream = (isHttps ? tls : net).connect(connectOpts, () => {
        const targetOrigin = target.origin;
        const headerLines = [
          `${clientReq.method} ${upstreamPath} HTTP/1.1`,
          `Host: ${target.host}`,
          `Origin: ${targetOrigin}`,
          `Referer: ${targetOrigin}/`,
        ];
        for (const [key, value] of Object.entries(clientReq.headers)) {
          const k = key.toLowerCase();
          if (
            [
              "host",
              "cookie",
              "authorization",
              "origin",
              "referer",
            ].includes(k) ||
            value == null
          ) {
            continue;
          }
          if (Array.isArray(value)) {
            for (const v of value) headerLines.push(`${key}: ${v}`);
          } else {
            headerLines.push(`${key}: ${value}`);
          }
        }
        if (session.mode === "cockpit" && session.cookieHeader) {
          headerLines.push(`Cookie: ${session.cookieHeader}`);
        }
        if (session.mode === "basic" && session.basicHeader) {
          headerLines.push(`Authorization: ${session.basicHeader}`);
        }
        headerLines.push("", "");
        upstream.write(headerLines.join("\r\n"));
        if (head && head.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });

      upstream.on("error", () => clientSocket.destroy());
      clientSocket.on("error", () => upstream.destroy());
    })
    .catch(() => clientSocket.destroy());
}

function parseBridge(urlPath) {
  const m = urlPath.match(/^\/bridge\/(\d+)(\/.*)?$/);
  if (!m) return null;
  return {
    id: Number(m[1]),
    restPath: m[2] && m[2].length ? m[2] : "/",
  };
}

async function main() {
  const handlers = await getRequestHandlers({
    dir,
    port: currentPort,
    isDev: false,
    hostname,
    minimalMode: false,
    keepAliveTimeout: undefined,
    quiet: false,
  });

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`
      );
      const bridge = parseBridge(parsed.pathname);
      if (bridge) {
        if (parsed.pathname === `/bridge/${bridge.id}`) {
          res.writeHead(302, { Location: `/bridge/${bridge.id}/` });
          res.end();
          return;
        }
        await proxyHttp(req, res, bridge.id, bridge.restPath, parsed.search);
        return;
      }
      await handlers.requestHandler(req, res);
    } catch (err) {
      console.error("[bridge]", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
      }
      res.end("Internal bridge error");
    }
  });

  server.on("upgrade", (req, socket, head) => {
    try {
      const parsed = new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`
      );
      const bridge = parseBridge(parsed.pathname);
      if (bridge) {
        proxyUpgrade(
          req,
          socket,
          head,
          bridge.id,
          bridge.restPath,
          parsed.search
        );
        return;
      }
      void handlers.upgradeHandler(req, socket, head);
    } catch (err) {
      console.error("[bridge-ws]", err);
      socket.destroy();
    }
  });

  server.listen(currentPort, hostname, () => {
    console.log(`[bridge] listening on http://${hostname}:${currentPort}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
