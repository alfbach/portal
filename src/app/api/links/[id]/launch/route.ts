import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getLink } from "@/lib/db";
import { normalizeHttpUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Launch payload for opening a link (optionally via authenticated bridge). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const link = getLink(Number(id));
  if (!link || !link.enabled) return jsonError("Not found", 404);

  const url = normalizeHttpUrl(link.url);
  const hasAuth = Boolean(link.auth_username);

  return NextResponse.json({
    id: link.id,
    title: link.title,
    url,
    // Never embed credentials in the URL — browsers strip them and Cockpit
    // needs a proper /cockpit/login session cookie instead.
    targetUrl: url,
    hasAuth,
    username: link.auth_username,
    bridgeUrl: hasAuth ? `/bridge/${link.id}/` : null,
  });
}
