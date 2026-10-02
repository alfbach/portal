import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { createWidget, getAllWidgets } from "@/lib/db";
import { sanitizeHtml } from "@/lib/metrics";

export const dynamic = "force-dynamic";

function normalizeConfig(body: {
  type: string;
  config?: Record<string, unknown>;
  config_json?: string | object;
}): string {
  let config: Record<string, unknown> = {};
  if (typeof body.config_json === "string") {
    config = JSON.parse(body.config_json);
  } else if (body.config && typeof body.config === "object") {
    config = body.config;
  } else if (body.config_json && typeof body.config_json === "object") {
    config = body.config_json as Record<string, unknown>;
  }
  if (body.type === "html_fragment" && typeof config.html === "string") {
    config.html = sanitizeHtml(config.html);
  }
  return JSON.stringify(config);
}

export async function GET() {
  return NextResponse.json(getAllWidgets());
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.title || !body.type) {
      return jsonError("title and type are required");
    }
    const widget = createWidget({
      ...body,
      config_json: normalizeConfig(body),
    });
    return NextResponse.json(widget, { status: 201 });
  } catch {
    return jsonError("Invalid request body");
  }
}
