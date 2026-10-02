import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { createLink, getAllLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAllLinks());
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.title || !body.url) {
      return jsonError("title and url are required");
    }
    const link = createLink(body);
    return NextResponse.json(link, { status: 201 });
  } catch {
    return jsonError("Invalid request body");
  }
}
