import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { runHealthChecks } from "@/lib/health";
import { getAllLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await runHealthChecks();
  return NextResponse.json({
    ok: true,
    links: getAllLinks(true).map((l) => ({
      id: l.id,
      status: l.last_status,
      latencyMs: l.last_latency_ms,
      checkedAt: l.last_checked_at,
    })),
  });
}
