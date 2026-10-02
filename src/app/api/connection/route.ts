import { NextResponse } from "next/server";
import { getConnectionSummary } from "@/lib/bandwidth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getConnectionSummary());
}
