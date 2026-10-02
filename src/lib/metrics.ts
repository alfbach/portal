function getByPath(obj: unknown, jsonPath: string): unknown {
  if (!jsonPath || jsonPath === ".") return obj;
  const parts = jsonPath.replace(/^\$\.?/, "").split(".").filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      current = (current as Record<string, unknown>)[match[1]];
      if (!Array.isArray(current)) return undefined;
      current = current[Number(match[2])];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

export async function fetchMetricValue(
  url: string,
  jsonPath: string
): Promise<{ value: unknown; raw?: unknown; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { value: null, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      const text = await res.text();
      return { value: text.slice(0, 200), raw: text.slice(0, 200) };
    }
    const raw = await res.json();
    return { value: getByPath(raw, jsonPath), raw };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Very small HTML sanitizer for trusted admin fragments */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
