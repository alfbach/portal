import { NextResponse } from "next/server";
import { getAllLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const links = getAllLinks(true).map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    status: l.last_status,
    latencyMs: l.last_latency_ms,
    checkedAt: l.last_checked_at,
  }));

  const counts = { ok: 0, degraded: 0, down: 0, unknown: 0 };
  for (const l of links) {
    counts[l.status as keyof typeof counts] =
      (counts[l.status as keyof typeof counts] || 0) + 1;
  }

  return NextResponse.json({ links, counts, checkedAt: new Date().toISOString() });
}
