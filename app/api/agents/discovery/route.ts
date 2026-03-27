import { NextResponse } from "next/server";
import { getDiscoverableAgents } from "@/lib/agent-market";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const amount = Number(searchParams.get("amount") || 0);
    const time = Number(searchParams.get("time") || 0);
    const agents = getDiscoverableAgents({
      country: searchParams.get("country") || "",
      method: searchParams.get("method") || "",
      asset: searchParams.get("asset") || "",
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      time: Number.isFinite(time) && time > 0 ? time : undefined,
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("AGENT DISCOVERY ERROR:", error);
    return NextResponse.json({ message: "Server error", agents: [] }, { status: 500 });
  }
}
