export function basicAuthHeader(
  username?: string | null,
  password?: string | null
): Record<string, string> {
  if (!username) return {};
  const token = Buffer.from(`${username}:${password ?? ""}`, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

/** Embed HTTP basic auth into a URL (used when opening a new browser window). */
export function buildCredentialedUrl(
  rawUrl: string,
  username?: string | null,
  password?: string | null
): string {
  if (!username) return rawUrl;
  const u = new URL(rawUrl);
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

export async function testConnection(options: {
  url: string;
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
}): Promise<ConnectionTestResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  const auth = basicAuthHeader(options.username, options.password);
  const hasAuth = Boolean(options.username);

  try {
    let res = await fetch(options.url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: { ...auth },
    });

    if (res.status === 405 || res.status === 501) {
      res = await fetch(options.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
        headers: { ...auth, Range: "bytes=0-0" },
      });
    }

    const latencyMs = Date.now() - start;

    if (res.status === 401 || res.status === 403) {
      if (hasAuth) {
        return {
          ok: false,
          status: "auth_failed",
          httpStatus: res.status,
          latencyMs,
          message: `Authentication failed (HTTP ${res.status})`,
        };
      }
      return {
        ok: false,
        status: "auth_required",
        httpStatus: res.status,
        latencyMs,
        message: `Credentials required (HTTP ${res.status})`,
      };
    }

    if (res.ok || res.status === 206) {
      return {
        ok: true,
        status: latencyMs > 2500 ? "degraded" : "ok",
        httpStatus: res.status,
        latencyMs,
        message: hasAuth
          ? `Connected with credentials (HTTP ${res.status})`
          : `Connected (HTTP ${res.status})`,
      };
    }

    if (res.status >= 500) {
      return {
        ok: false,
        status: "down",
        httpStatus: res.status,
        latencyMs,
        message: `Server error (HTTP ${res.status})`,
      };
    }

    return {
      ok: false,
      status: "degraded",
      httpStatus: res.status,
      latencyMs,
      message: `Unexpected response (HTTP ${res.status})`,
    };
  } catch (err) {
    return {
      ok: false,
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
