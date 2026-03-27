import { NextResponse } from "next/server";
import { dataPath, normalize, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const orderId = searchParams.get("orderId");
  const users = readJsonArray<any>(dataPath("users.json"));
  const orders = readJsonArray<any>(dataPath("orders.json"));
  const user = users.find((item) => normalize(item.email) === normalize(email || "") && item.role === "agent");
  if (!user) return NextResponse.json({ orders: [], order: null });
  const filtered = orders.filter((item) => item.agentId === String(user.agentId));
  if (orderId) return NextResponse.json({ order: filtered.find((item) => item.id === orderId) || null });
  return NextResponse.json({ orders: filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
}
