import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { createGroup, getAllGroups } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAllGroups());
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.name) return jsonError("name is required");
    const group = createGroup(body);
    return NextResponse.json(group, { status: 201 });
  } catch {
    return jsonError("Invalid request body");
  }
}
