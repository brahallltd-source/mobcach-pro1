import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("agents");

  if (!access.ok) {
    return NextResponse.json(
      { success: false, message: access.message },
      { status: access.status }
    );
  }

  try {
    const prisma = getPrisma();

    const applications = await prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    console.error("GET AGENT APPLICATIONS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("agents");

  if (!access.ok) {
    return NextResponse.json(
      { success: false, message: access.message },
      { status: access.status }
    );
  }

  try {
    const prisma = getPrisma();
    const body = await req.json();

    const { agentId, action } = body;

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, message: "Missing data" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        await tx.agent.update({
          where: { id: agentId },
          data: { status: "approved" },
        });

        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { email: agent.email ?? undefined },
              { username: agent.username ?? undefined },
            ],
          },
        });

        if (existingUser) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              role: "AGENT",
              frozen: false,
              email: agent.email || existingUser.email,
              username: agent.username || existingUser.username,
            },
          });
        } else {
          const passwordHash = await bcrypt.hash("123456", 10);

          await tx.user.create({
            data: {
              fullName: agent.fullName || agent.full_name || "Agent User",
              email: agent.email || `${agent.username}@mobcash.local`,
              username: agent.username || (agent.email ? agent.email.split("@")[0] : `agent_${Date.now()}`),
              phone: agent.phone || "",
              passwordHash,
              role: "AGENT",
              frozen: false,
            },
          });
        }
      }

      if (action === "reject") {
        await tx.agent.update({
          where: { id: agentId },
          data: { status: "rejected" },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Agent ${action}d successfully`,
      officialMessage:
        action === "approve"
          ? `Hello, your agent account has been approved successfully.

Username: ${agent.username || (agent.email || "").split("@")[0]}
Password: 123456
Email: ${agent.email || ""}`
          : null,
    });
  } catch (error) {
    console.error("AGENT APPROVAL ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}