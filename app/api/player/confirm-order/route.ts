import { NextResponse } from "next/server";
import { debitWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";
import { recordOrderActivity, rewardReferralOnFirstOrder } from "@/lib/bonus";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    const ordersPath = dataPath("orders.json");
    const orders = readJsonArray<any>(ordersPath);
    const index = orders.findIndex((item) => item.id === orderId);
    if (index === -1) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    const order = orders[index];
    if (order.completion_finalized === true) return NextResponse.json({ message: "Order already finalized" }, { status: 400 });
    if (order.status !== "agent_approved_waiting_player") return NextResponse.json({ message: "Order not ready for confirmation" }, { status: 400 });
    debitWallet(order.agentId, Number(order.amount), "order_completion_deduction", { orderId: order.id, playerEmail: order.playerEmail });
    orders[index] = { ...order, player_approved: true, status: "completed", wallet_deducted: true, wallet_deducted_at: nowIso(), completion_finalized: true, updated_at: nowIso() };
    writeJsonArray(ordersPath, orders);
    const activity = recordOrderActivity(
      String(order.agentId),
      Number(order.amount || 0),
      String(order.id)
    );
    
    rewardReferralOnFirstOrder(
      String(order.playerEmail || ""),
      String(order.id),
      Number(order.amount || 0)
    );
    
    createNotification({
      targetRole: "agent",
      targetId: order.agentId,
      title: "Order completed",
      message: `Order ${order.id} has been confirmed by the player.`,
    });
    
    if (activity.profile.energy >= 1000) {
      createNotification({
        targetRole: "agent",
        targetId: order.agentId,
        title: "Energy full",
        message: "Your energy reward is ready to unlock.",
      });
    }
    
    if (activity.task.status === "ready") {
      createNotification({
        targetRole: "agent",
        targetId: order.agentId,
        title: "Task ready",
        message: "You completed the current task reward. Visit Bonus to claim it.",
      });
    }
    return NextResponse.json({ message: "Order completed and wallet deducted ✅", order: orders[index] });
  } catch (error: any) {
    console.error("CONFIRM ORDER ERROR:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: error.message === "Insufficient wallet balance" ? 400 : 500 });
  }
}
