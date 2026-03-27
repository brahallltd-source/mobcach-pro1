
import { NextResponse } from "next/server";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    const orders = readJsonArray<any>(dataPath("orders.json"));
    const order = orders.find((item) => item.id === orderId);
    if (!order) return NextResponse.json({ message: "Order not found", order: null }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET ORDER MESSAGES ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, senderRole, message } = await req.json();
    if (!orderId || !senderRole || !message) return NextResponse.json({ message: "orderId, senderRole and message are required" }, { status: 400 });
    const path = dataPath("orders.json");
    const orders = readJsonArray<any>(path);
    const orderIndex = orders.findIndex((item) => item.id === orderId);
    if (orderIndex === -1) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    const messages = Array.isArray(orders[orderIndex].messages) ? orders[orderIndex].messages : [];
    messages.push({ senderRole, message, created_at: nowIso() });
    orders[orderIndex] = { ...orders[orderIndex], messages, updated_at: nowIso() };
    writeJsonArray(path, orders);
    return NextResponse.json({ message: "Message sent successfully ✅", order: orders[orderIndex] });
  } catch (error) {
    console.error("ORDER MESSAGE ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
