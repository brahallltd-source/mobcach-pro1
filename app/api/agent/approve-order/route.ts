import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    const path = dataPath("orders.json");
    const orders = readJsonArray<any>(path);
    const index = orders.findIndex((item) => item.id === orderId);
    if (index === -1) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    const order = orders[index];
    if (order.status !== "proof_uploaded") return NextResponse.json({ message: "Order must be in proof_uploaded state" }, { status: 400 });
    orders[index] = { ...order, agent_approved: true, agent_approved_at: nowIso(), status: "agent_approved_waiting_player", updated_at: nowIso() };
    writeJsonArray(path, orders);
    createNotification({ targetRole: "player", targetId: order.playerEmail, title: "Order approved", message: `Your agent approved order ${order.id}.` });
    return NextResponse.json({ message: "Order approved successfully ✅", order: orders[index] });
  } catch (error) {
    console.error("APPROVE ORDER ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
