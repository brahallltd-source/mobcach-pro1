
import { NextResponse } from "next/server";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const fullName = String(body.full_name || body.fullName || body.name || "").trim();
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizePhoneWithCountry(
      String(body.phone || "").trim(),
      String(body.country || "Morocco").trim()
    );
    const country = String(body.country || "").trim();
    const note = String(body.note || "").trim();

    if (!fullName || !username || !email) {
      return NextResponse.json(
        { success: false, message: "full_name, username and email are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.agent.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Agent already exists" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.create({
      data: {
        fullName,
        username,
        email,
        phone,
        country: country || null,
        status: "pending_agent_review",
        note: note || null,
        online: false,
        verified: false,
        rating: 0,
        successRate: 0,
        tradesCount: 0,
        availableBalance: 0,
        responseMinutes: 30,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent application submitted successfully ✅",
      data: agent,
    });
  } catch (error) {
    console.error("APPLY AGENT ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
