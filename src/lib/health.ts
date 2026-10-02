import { getAllLinks, getSettings, updateLinkHealth } from "./db";
import { testConnection } from "./auth";
import type { HealthStatus } from "./types";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function checkLinkHealth(
  url: string,
  username?: string | null,
  password?: string | null
): Promise<{
  status: HealthStatus;
  latencyMs: number | null;
}> {
  const result = await testConnection({ url, username, password });
  if (result.status === "auth_required" || result.status === "auth_failed") {
    return { status: "down", latencyMs: result.latencyMs };
  }
  if (result.status === "ok" || result.status === "degraded") {
    return { status: result.status, latencyMs: result.latencyMs };
  }
  return { status: "down", latencyMs: result.latencyMs };
}

export async function runHealthChecks() {
  if (running) return;
  running = true;
  try {
    const links = getAllLinks(true);
    for (const link of links) {
      const target = link.health_check_url || link.url;
      const result = await checkLinkHealth(
        target,
        link.auth_username,
        link.auth_password
      );
      updateLinkHealth(link.id, result.status, result.latencyMs);
    }
  } finally {
    running = false;
  }
}

export function startHealthWorker() {
  if (timer) return;
  const settings = getSettings();
  const intervalSec = Math.max(15, Number(settings.health_interval_sec) || 60);

  void runHealthChecks();
  timer = setInterval(() => {
    void runHealthChecks();
  }, intervalSec * 1000);

  console.log(`[health] worker started, interval=${intervalSec}s`);
}

export function restartHealthWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  startHealthWorker();
}
