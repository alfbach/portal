import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { getSettings, updateSettings } from "@/lib/db";
import { restartHealthWorker } from "@/lib/health";
import type { SettingsMap } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json()) as Partial<SettingsMap>;
    const settings = updateSettings(body);
    if (body.health_interval_sec) {
      restartHealthWorker();
    }
    return NextResponse.json(settings);
  } catch {
    return jsonError("Invalid request body");
  }
}
