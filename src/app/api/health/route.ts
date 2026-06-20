import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Video Generator App",
    timestamp: new Date().toISOString(),
  });
}
