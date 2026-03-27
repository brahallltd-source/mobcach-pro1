import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  try {
    const withdrawals = readJsonArray<any>(dataPath("withdrawals.json"))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error("ADMIN WITHDRAWALS GET ERROR:", error);
    return NextResponse.json({ message: "Server error", withdrawals: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { withdrawalId, action, note } = await req.json();
    if (!withdrawalId || !["mark_sent", "reject"].includes(action)) {
      return NextResponse.json({ message: "withdrawalId and valid action are required" }, { status: 400 });
    }

    const withdrawalsPath = dataPath("withdrawals.json");
    const winnersPath = dataPath("winners.json");
    const withdrawals = readJsonArray<any>(withdrawalsPath);
    const winners = readJsonArray<any>(winnersPath);
    const users = readJsonArray<any>(dataPath("users.json"));

    const index = withdrawals.findIndex((item) => item.id === withdrawalId);
    if (index === -1) return NextResponse.json({ message: "Withdrawal request not found" }, { status: 404 });
    if (action === "mark_sent" && withdrawals[index].status !== "agent_approved") {
      return NextResponse.json({ message: "Admin can only send funds after the agent has approved the request" }, { status: 400 });
    }

    withdrawals[index] = {
      ...withdrawals[index],
      status: action === "mark_sent" ? "sent" : "rejected",
      admin_note: String(note || "").trim(),
      updated_at: nowIso(),
      admin_reviewed_at: nowIso(),
    };
    writeJsonArray(withdrawalsPath, withdrawals);

    const winnerIndex = winners.findIndex((item) => item.id === withdrawals[index].winnerId);
    if (winnerIndex !== -1 && action === "mark_sent") {
      winners[winnerIndex] = { ...winners[winnerIndex], status: "withdrawn", updated_at: nowIso() };
      writeJsonArray(winnersPath, winners);
    }

    const playerUser = users.find((item) => String(item.email) === String(withdrawals[index].playerEmail));
    if (playerUser?.id) {
      createNotification({
        targetRole: "player",
        targetId: playerUser.id,
        title: action === "mark_sent" ? "Funds sent" : "Payout rejected by admin",
        message: action === "mark_sent"
          ? `Your winning payout of ${withdrawals[index].amount} DH has been sent.`
          : "Your payout request was rejected by admin. Please contact support if needed.",
      });
    }

    return NextResponse.json({ message: action === "mark_sent" ? "Funds marked as sent" : "Withdrawal rejected by admin", withdrawal: withdrawals[index] });
  } catch (error) {
    console.error("ADMIN WITHDRAWALS POST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
