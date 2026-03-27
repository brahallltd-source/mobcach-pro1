import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const orderId = searchParams.get("orderId");
  const orders = readJsonArray<any>(dataPath("orders.json"));
  if (orderId) {
    const order = orders.find((item) => item.id === orderId && (!email || item.playerEmail === email));
    return NextResponse.json({ order: order || null });
  }
  return NextResponse.json({ orders: orders.filter((item) => !email || item.playerEmail === email).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
}
