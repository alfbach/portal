import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getLink } from "@/lib/db";
import { buildCredentialedUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Launch payload for opening a link (optionally with basic-auth credentials). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const link = getLink(Number(id));
  if (!link || !link.enabled) return jsonError("Not found", 404);

  const hasAuth = Boolean(link.auth_username);
  const targetUrl = hasAuth
    ? buildCredentialedUrl(link.url, link.auth_username, link.auth_password)
    : link.url;

  return NextResponse.json({
    id: link.id,
    title: link.title,
    url: link.url,
    targetUrl,
    hasAuth,
    username: link.auth_username,
  });
}
