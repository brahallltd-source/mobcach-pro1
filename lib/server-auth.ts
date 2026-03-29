import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";

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

    // 🔥 transaction مهم جدًا
    await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        // 1) تحديث حالة الوكيل
        await tx.agent.update({
          where: { id: agentId },
          data: { status: "approved" },
        });

        // 2) تحديث المستخدم إلى AGENT
        await tx.user.updateMany({
          where: {
            OR: [
              { email: agent.email },
              { username: agent.username },
            ],
          },
          data: {
            role: "AGENT",
            frozen: false,
          },
        });
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
    });
  } catch (error) {
    console.error("AGENT APPROVAL ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}