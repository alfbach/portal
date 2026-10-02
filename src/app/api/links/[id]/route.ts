import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { deleteLink, getLink, updateLink } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const link = getLink(Number(id));
  if (!link) return jsonError("Not found", 404);
  return NextResponse.json(link);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const link = updateLink(Number(id), body);
    if (!link) return jsonError("Not found", 404);
    return NextResponse.json(link);
  } catch {
    return jsonError("Invalid request body");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!deleteLink(Number(id))) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}
