import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { deleteWidget, getWidget, updateWidget } from "@/lib/db";
import { sanitizeHtml } from "@/lib/metrics";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function normalizeConfig(
  type: string,
  body: { config?: Record<string, unknown>; config_json?: string | object }
): string | undefined {
  let config: Record<string, unknown> | null = null;
  if (typeof body.config_json === "string") {
    config = JSON.parse(body.config_json);
  } else if (body.config && typeof body.config === "object") {
    config = body.config;
  } else if (body.config_json && typeof body.config_json === "object") {
    config = body.config_json as Record<string, unknown>;
  }
  if (!config) return undefined;
  if (type === "html_fragment" && typeof config.html === "string") {
    config.html = sanitizeHtml(config.html);
  }
  return JSON.stringify(config);
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const widget = getWidget(Number(id));
  if (!widget) return jsonError("Not found", 404);
  return NextResponse.json(widget);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const existing = getWidget(Number(id));
    if (!existing) return jsonError("Not found", 404);
    const body = await req.json();
    const type = body.type ?? existing.type;
    const payload = { ...body };
    const configJson = normalizeConfig(type, body);
    if (configJson) payload.config_json = configJson;
    const widget = updateWidget(Number(id), payload);
    if (!widget) return jsonError("Not found", 404);
    return NextResponse.json(widget);
  } catch {
    return jsonError("Invalid request body");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!deleteWidget(Number(id))) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}
