import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export function basicAuthHeader(
  username?: string | null,
  password?: string | null
): Record<string, string> {
  if (!username) return {};
  const token = Buffer.from(`${username}:${password ?? ""}`, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

/** Ensure a URL has an http(s) scheme so browser redirects and probes work. */
export function normalizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Embed HTTP basic auth into a URL (used when opening a new browser window). */
export function buildCredentialedUrl(
  rawUrl: string,
  username?: string | null,
  password?: string | null
): string {
  if (!username) return normalizeHttpUrl(rawUrl);
  const u = new URL(normalizeHttpUrl(rawUrl));
  u.username = username;
  u.password = password ?? "";
  return u.toString();
}

export type ConnectionTestResult = {
  ok: boolean;
  status: "ok" | "degraded" | "down" | "auth_required" | "auth_failed";
  httpStatus: number | null;
  latencyMs: number;
  message: string;
};

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1") return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

type ProbeResponse = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  usedInsecureTls: boolean;
};

function requestOnce(
  target: URL,
  options: {
    method: "HEAD" | "GET";
    headers: Record<string, string>;
    timeoutMs: number;
    rejectUnauthorized: boolean;
  }
): Promise<ProbeResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = target.protocol === "https:";
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: options.method,
        headers: options.headers,
        timeout: options.timeoutMs,
        rejectUnauthorized: options.rejectUnauthorized,
      },
      (res) => {
        res.resume();
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          usedInsecureTls: isHttps && !options.rejectUnauthorized,
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Connection timed out")));
    req.on("error", reject);
    req.end();
  });
}

async function probeUrl(
  url: string,
  options: {
    username?: string | null;
    password?: string | null;
    timeoutMs: number;
  }
): Promise<ProbeResponse> {
  const auth = basicAuthHeader(options.username, options.password);
  const baseHeaders: Record<string, string> = {
    "User-Agent": "ops-portal-health/1.0",
    Accept: "*/*",
    ...auth,
  };

  let current = new URL(normalizeHttpUrl(url));
  let allowInsecure =
    current.protocol === "https:" && isPrivateOrLocalHost(current.hostname);
  let redirects = 0;

  while (redirects <= 5) {
    let response: ProbeResponse;
    try {
      // Prefer GET: many LAN UIs (Cockpit, etc.) reject HEAD with 400.
      response = await requestOnce(current, {
        method: "GET",
        headers: { ...baseHeaders, Range: "bytes=0-0" },
        timeoutMs: options.timeoutMs,
        rejectUnauthorized: !allowInsecure,
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code || "")
          : "";
      const tlsFailure =
        current.protocol === "https:" &&
        !allowInsecure &&
        /UNABLE_TO_VERIFY|CERT_|DEPTH_ZERO|ERR_TLS|SELF_SIGNED/i.test(
          `${code} ${err instanceof Error ? err.message : ""}`
        );
      if (tlsFailure) {
        allowInsecure = true;
        continue;
      }
      throw err;
    }

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location) return response;
      const next = new URL(location, current);
      if (
        next.protocol === "https:" &&
        isPrivateOrLocalHost(next.hostname)
      ) {
        allowInsecure = true;
      }
      current = next;
      redirects += 1;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
}

export async function testConnection(options: {
  url: string;
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
}): Promise<ConnectionTestResult> {
  const start = Date.now();
  const hasAuth = Boolean(options.username);

  try {
    const res = await probeUrl(options.url, {
      username: options.username,
      password: options.password,
      timeoutMs: options.timeoutMs ?? 8000,
    });
    const latencyMs = Date.now() - start;
    const tlsNote = res.usedInsecureTls ? " · self-signed TLS accepted" : "";

    if (res.statusCode === 401 || res.statusCode === 403) {
      if (hasAuth) {
        return {
          ok: false,
          status: "auth_failed",
          httpStatus: res.statusCode,
          latencyMs,
          message: `Authentication failed (HTTP ${res.statusCode})`,
        };
      }
      return {
        ok: false,
        status: "auth_required",
        httpStatus: res.statusCode,
        latencyMs,
        message: `Credentials required (HTTP ${res.statusCode})`,
      };
    }

    if (
      (res.statusCode >= 200 && res.statusCode < 400) ||
      res.statusCode === 206
    ) {
      return {
        ok: true,
        status: latencyMs > 2500 ? "degraded" : "ok",
        httpStatus: res.statusCode,
        latencyMs,
        message: hasAuth
          ? `Connected with credentials (HTTP ${res.statusCode})${tlsNote}`
          : `Connected (HTTP ${res.statusCode})${tlsNote}`,
      };
    }

    if (res.statusCode >= 500) {
      return {
        ok: false,
        status: "down",
        httpStatus: res.statusCode,
        latencyMs,
        message: `Server error (HTTP ${res.statusCode})`,
      };
    }

    return {
      ok: false,
      status: "degraded",
      httpStatus: res.statusCode,
      latencyMs,
      message: `Unexpected response (HTTP ${res.statusCode})${tlsNote}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
