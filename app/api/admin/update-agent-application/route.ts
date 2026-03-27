
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { createNotification } from "@/lib/notifications";
import { createWalletIfMissing } from "@/lib/wallet";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function buildAgentApprovalMessage(payload: { username: string; email: string; password: string }) {
  const { username, email, password } = payload;
  return `Hello, your agent account has been approved successfully.

Agent login credentials:
- Username: ${username}
- Password: ${password}
- Email: ${email}

Please keep these credentials private.
These credentials are valid for GoSport365 MobCash.

------------------------------

مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${username}
- Password: ${password}
- Email: ${email}

يرجى الحفاظ على هذه البيانات بشكل سري.
هذه البيانات صالحة للدخول إلى GoSport365 MobCash.`;
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("agents");
  if (!access.ok) {
    return NextResponse.json({ success: false, message: access.message }, { status: access.status });
  }

  try {
    const { agentId, action } = await req.json();

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, message: "agentId and action are required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid action" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database not available" },
        { status: 500 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id: String(agentId) },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent application not found" },
        { status: 404 }
      );
    }

    if (action === "reject") {
      const updated = await prisma.agent.update({
        where: { id: String(agentId) },
        data: {
          status: "rejected",
          online: false,
          updatedAt: new Date(),
        },
      });

      createNotification({
        targetRole: "agent",
        targetId: updated.id,
        title: "Application rejected",
        message: "Your agent application has been rejected.",
      });

      return NextResponse.json({
        success: true,
        message: "Agent application rejected successfully",
        agent: updated,
      });
    }

    const updated = await prisma.agent.update({
      where: { id: String(agentId) },
      data: {
        status: "account_created",
        online: true,
        updatedAt: new Date(),
      },
    });

    createWalletIfMissing(updated.id);

    const officialMessage = buildAgentApprovalMessage({
      username: updated.username || updated.email.split("@")[0],
      email: updated.email,
      password: "123456",
    });

    createNotification({
      targetRole: "agent",
      targetId: updated.id,
      title: "Application approved",
      message: "Your agent account is now approved and created.",
    });

    return NextResponse.json({
      success: true,
      message: "Agent approved successfully ✅",
      agent: updated,
      officialMessage,
    });
  } catch (error) {
    console.error("UPDATE AGENT APPLICATION ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
