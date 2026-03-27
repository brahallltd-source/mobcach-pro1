import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playerEmail = searchParams.get("playerEmail");
    if (!playerEmail) return NextResponse.json({ message: "playerEmail is required" }, { status: 400 });

    const winner = readJsonArray<any>(dataPath("winners.json")).find((item) => String(item.playerEmail) === String(playerEmail)) || null;
    const history = readJsonArray<any>(dataPath("withdrawals.json"))
      .filter((item) => String(item.playerEmail) === String(playerEmail))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ winner, history });
  } catch (error) {
    console.error("PLAYER WINNINGS GET ERROR:", error);
    return NextResponse.json({ message: "Server error", winner: null, history: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { playerEmail, method, amount, rib, swift, ribConfirm, swiftConfirm, cashProvider, fullName, phone, city } = body;

    if (!playerEmail || !method || !amount) {
      return NextResponse.json({ message: "playerEmail, method and amount are required" }, { status: 400 });
    }

    const winnersPath = dataPath("winners.json");
    const withdrawalsPath = dataPath("withdrawals.json");
    const players = readJsonArray<any>(dataPath("players.json"));
    const users = readJsonArray<any>(dataPath("users.json"));
    const winners = readJsonArray<any>(winnersPath);
    const withdrawals = readJsonArray<any>(withdrawalsPath);

    const winner = winners.find((item) => String(item.playerEmail) === String(playerEmail));
    if (!winner) return NextResponse.json({ message: "Winner entry not found" }, { status: 404 });
    if (Number(amount) !== Number(winner.amount)) {
      return NextResponse.json({ message: "Amount must match the winning amount" }, { status: 400 });
    }

    const activeRequest = withdrawals.find((item) => String(item.playerEmail) === String(playerEmail) && ["pending", "agent_approved", "sent"].includes(item.status));
    if (activeRequest) return NextResponse.json({ message: "A payout request is already in progress" }, { status: 400 });

    if (method === "bank") {
      if (!rib || !swift || !ribConfirm || !swiftConfirm) {
        return NextResponse.json({ message: "RIB, SWIFT and their confirmations are required" }, { status: 400 });
      }
      if (String(rib).trim() !== String(ribConfirm).trim() || String(swift).trim() !== String(swiftConfirm).trim()) {
        return NextResponse.json({ message: "Bank confirmations do not match" }, { status: 400 });
      }
    }

    if (method === "cash") {
      if (!cashProvider || !fullName || !phone || !city) {
        return NextResponse.json({ message: "Cash provider, full name, phone and city are required" }, { status: 400 });
      }
    }

    const user = users.find((item) => String(item.email) === String(playerEmail));
    const player = players.find((item) => item.user_id === user?.id);

    const record = {
      id: uid("withdraw"),
      playerEmail,
      playerId: player?.id || "",
      agentId: player?.assigned_agent_id || "",
      amount: Number(amount),
      method,
      rib: method === "bank" ? String(rib || "").trim() : "",
      swift: method === "bank" ? String(swift || "").trim() : "",
      cashProvider: method === "cash" ? String(cashProvider || "").trim() : "",
      fullName: String(fullName || "").trim(),
      phone: String(phone || "").trim(),
      city: String(city || "").trim(),
      status: "pending",
      winnerId: winner.id,
      agent_note: "",
      admin_note: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    withdrawals.unshift(record);
    writeJsonArray(withdrawalsPath, withdrawals);

    if (record.agentId) {
      createNotification({
        targetRole: "agent",
        targetId: record.agentId,
        title: "New winner payout request",
        message: `A payout request for ${record.amount} DH was submitted by ${playerEmail}.`,
      });
    }

    createNotification({
      targetRole: "admin",
      targetId: "admin-1",
      title: "Pending payout request",
      message: `A winning player submitted a payout request. It is waiting for agent review.`,
    });

    if (user?.id) {
      createNotification({
        targetRole: "player",
        targetId: user.id,
        title: "Payout request submitted",
        message: "Your winning payout request is now pending agent review.",
      });
    }

    return NextResponse.json({ message: "Payout request submitted successfully", withdrawal: record });
  } catch (error) {
    console.error("PLAYER WINNINGS POST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
