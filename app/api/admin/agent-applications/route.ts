import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

/**
 * GET → جلب طلبات الوكلاء
 */
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

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

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

/**
 * POST → approve / reject agent
 */
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

    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { agentId, action } = body as {
      agentId?: string;
      action?: "approve" | "reject";
    };

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, message: "Missing data" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, message: "Invalid action" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id: String(agentId) },
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
          data: {
            status: "account_created",
            online: true,
            updatedAt: new Date(),
          },
        });

        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { email: agent.email },
              { username: agent.username },
            ],
          },
        });

        if (existingUser) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              role: "AGENT",
              frozen: false,
              agentId: agent.id,
            },
          });
        } else {
          const passwordHash = await bcrypt.hash("123456", 10);

          await tx.user.create({
            data: {
              email: agent.email,
              username: agent.username || agent.email.split("@")[0],
              passwordHash,
              role: "AGENT",
              frozen: false,
              agentId: agent.id,
            },
          });
        }
      }

      if (action === "reject") {
        await tx.agent.update({
          where: { id: agentId },
          data: {
            status: "rejected",
            online: false,
            updatedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Agent ${action}d successfully`,
    });
  } catch (error) {
    console.error("AGENT APPROVAL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}