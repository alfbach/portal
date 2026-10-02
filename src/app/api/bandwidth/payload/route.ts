import { NextResponse } from "next/server";
import { getPayloadSizeBytes } from "@/lib/bandwidth";

export const dynamic = "force-dynamic";

export async function GET() {
  const size = getPayloadSizeBytes();
  const buffer = Buffer.alloc(size, 0x61);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Payload-Bytes": String(size),
    },
  });
}
