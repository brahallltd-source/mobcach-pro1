import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function buildAgentApprovalMessage(payload: {
  username: string;
  email: string;
  password: string;
}) {
  const { username, email, password } = payload;

  return `Hello, your agent account has been approved successfully.

Agent login credentials:
- Username: ${username}
- Password: ${password}
- Email: ${email}

Please keep these credentials private.

------------------------------

مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: ${password}
- Email: ${email}

يرجى الحفاظ على هذه البيانات بشكل سري.`;
}

/**
 * GET → جلب طلبات الوكلاء من AgentApplication
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

    const applications = await prisma.agentApplication.findMany({
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
 * POST → approve / reject agent application
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

    const application = await prisma.agentApplication.findUnique({
      where: { id: String(agentId) },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, message: "Application not found" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (action === "reject") {
        const rejected = await tx.agentApplication.update({
          where: { id: String(agentId) },
          data: {
            status: "rejected",
            updatedAt: new Date(),
          },
        });

        return { mode: "rejected" as const, application: rejected };
      }

      const user = await tx.user.findUnique({
        where: { id: application.userId },
      });

      if (!user) {
        throw new Error("Linked user not found");
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          role: "AGENT",
          frozen: false,
        },
      });

      const existingAgent = await tx.agent.findFirst({
        where: {
          OR: [
            { email: application.email },
            { username: application.username },
          ],
        },
      });

      let agentRecord;

      if (existingAgent) {
        agentRecord = await tx.agent.update({
          where: { id: existingAgent.id },
          data: {
            fullName: application.fullName,
            username: application.username,
            email: application.email,
            phone: application.phone,
            country: application.country || "Morocco",
            status: "account_created",
            online: true,
            updatedAt: new Date(),
          },
        });
      } else {
        agentRecord = await tx.agent.create({
          data: {
            fullName: application.fullName,
            username: application.username,
            email: application.email,
            phone: application.phone,
            country: application.country || "Morocco",
            status: "account_created",
            online: true,
          },
        });
      }

      await tx.user.update({
        where: { id: updatedUser.id },
        data: {
          agentId: agentRecord.id,
        },
      });

      const approvedApplication = await tx.agentApplication.update({
        where: { id: String(agentId) },
        data: {
          status: "approved",
          updatedAt: new Date(),
        },
      });

      return {
        mode: "approved" as const,
        application: approvedApplication,
        user: updatedUser,
        agent: agentRecord,
      };
    });

    if (result.mode === "rejected") {
      return NextResponse.json({
        success: true,
        message: "Agent application rejected successfully",
        data: result.application,
      });
    }

    const officialMessage = buildAgentApprovalMessage({
      username: result.user.username,
      email: result.user.email,
      password: "Use the same password you registered with",
    });

    return NextResponse.json({
      success: true,
      message: "Agent application approved successfully",
      data: result.application,
      officialMessage,
      agent: result.agent,
      userId: result.user.id,
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