import { NextRequest, NextResponse } from "next/server";
import { getConnectionSummary, recordBandwidth } from "@/lib/bandwidth";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getConnectionSummary());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const downMbps = Number(body.downMbps);
    const rttMs = body.rttMs != null ? Number(body.rttMs) : null;
    if (!Number.isFinite(downMbps) || downMbps < 0) {
      return jsonError("downMbps must be a non-negative number");
    }
    const sample = recordBandwidth(downMbps, Number.isFinite(rttMs) ? rttMs : null);
    return NextResponse.json({
      sample,
      summary: getConnectionSummary(),
    });
  } catch {
    return jsonError("Invalid request body");
  }
}
