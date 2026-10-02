import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { deleteGroup, getGroup, updateGroup } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const group = getGroup(Number(id));
  if (!group) return jsonError("Not found", 404);
  return NextResponse.json(group);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const group = updateGroup(Number(id), body);
    if (!group) return jsonError("Not found", 404);
    return NextResponse.json(group);
  } catch {
    return jsonError("Invalid request body");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!deleteGroup(Number(id))) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}
