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

    const userId = String(body.userId || "").trim();
    const fullName = String(body.full_name || body.fullName || body.name || "").trim();
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizePhoneWithCountry(
      String(body.phone || "").trim(),
      String(body.country || "Morocco").trim()
    );
    const country = String(body.country || "").trim();
    const note = String(body.note || "").trim();

    if (!userId || !fullName || !username || !email) {
      return NextResponse.json(
        { success: false, message: "userId, full_name, username and email are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const existingPending = await prisma.agentApplication.findFirst({
      where: {
        userId,
        status: "pending",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { success: false, message: "You already have a pending request" },
        { status: 400 }
      );
    }

    const existingApproved = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (existingApproved?.role === "AGENT") {
      return NextResponse.json(
        { success: false, message: "This user is already an agent" },
        { status: 400 }
      );
    }

    const application = await prisma.agentApplication.create({
      data: {
        userId,
        fullName,
        username,
        email,
        phone,
        country: country || null,
        note: note || null,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent application submitted successfully",
      data: application,
    });
  } catch (error) {
    console.error("APPLY AGENT ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}