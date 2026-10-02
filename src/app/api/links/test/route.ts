import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api";
import { getLink } from "@/lib/db";
import { testConnection } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Test connectivity for a link (saved or ad-hoc form values).
 * Body: { id?, url?, health_check_url?, auth_username?, auth_password? }
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    let url = body.url as string | undefined;
    let username = (body.auth_username as string | null | undefined) ?? null;
    let password = (body.auth_password as string | null | undefined) ?? null;

    if (body.id != null) {
      const link = getLink(Number(body.id));
      if (!link) return jsonError("Link not found", 404);
      url = body.health_check_url || body.url || link.health_check_url || link.url;
      if (username == null || username === "") {
        username = link.auth_username;
      }
      if (password == null || password === "") {
        password = link.auth_password;
      }
    }

    if (!url) return jsonError("url is required");

    const result = await testConnection({
      url: body.health_check_url || url,
      username: username || null,
      password: password || null,
    });

    return NextResponse.json(result);
  } catch {
    return jsonError("Invalid request body");
  }
}
