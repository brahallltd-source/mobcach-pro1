import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const {
      playerEmail,
      agentId,
      gosport365_username,
      amount,
      payment_method_id,
      payment_method_name,
      currency,
      notes,
      proof_url,
      proof_hash,
      duplicate_detected,
      suspicious_flags,
    } = await req.json();

    if (!playerEmail || !gosport365_username || !amount || !agentId || !payment_method_id || !payment_method_name) {
      return NextResponse.json({ message: "Missing required order data" }, { status: 400 });
    }

    const users = readJsonArray<any>(dataPath("users.json"));
    const playerUser = users.find((item) => item.email === playerEmail && item.role === "player");
    if (!playerUser) return NextResponse.json({ message: "Player user not found" }, { status: 404 });
    if (playerUser.player_status && playerUser.player_status !== "active") return NextResponse.json({ message: "Player account is not active yet" }, { status: 400 });
    if (String(playerUser.assigned_agent_id || "") !== String(agentId)) return NextResponse.json({ message: "Player can only order from assigned agent" }, { status: 400 });

    const method = readJsonArray<any>(dataPath("agent_payment_methods.json")).find((item) => String(item.id) === String(payment_method_id) && String(item.agentId) === String(agentId));
    if (!method) return NextResponse.json({ message: "Payment method not found" }, { status: 404 });

    const ordersPath = dataPath("orders.json");
    const orders = readJsonArray<any>(ordersPath);

    const duplicateCount = proof_hash ? Number(readJsonArray<any>(dataPath("proof_hashes.json")).find((item) => item.hash === proof_hash)?.duplicate_count || 0) : 0;
    const duplicateDetected = proof_hash ? (duplicateCount > 1 || Boolean(duplicate_detected)) : false;

    const now = nowIso();
    const isCryptoFlow = !String(proof_url || "").trim() && !String(proof_hash || "").trim();

    const order = {
      id: uid("order"),
      agentId: String(agentId),
      playerEmail,
      amount: Number(amount),
      currency: currency || method.currency || "MAD",
      gosport365_username,
      status: "proof_uploaded",
      messages: [],
      created_at: now,
      updated_at: now,
      proof_uploaded: true,
      proof_uploaded_at: now,
      proof_url,
      proof_hash,
      proof_duplicate_detected: duplicateDetected,
      suspicious_flags: isCryptoFlow ? [] : (Array.isArray(suspicious_flags) ? suspicious_flags : duplicate_detected ? ["duplicate_proof_hash"] : []),
      anti_fraud_state: duplicateDetected ? "needs_review" : "basic_pass",
      agent_approved: false,
      agent_approved_at: "",
      player_approved: false,
      review_required: duplicateDetected,
      review_reason: duplicateDetected ? "Duplicate proof image detected" : "",
      wallet_deducted: false,
      wallet_deducted_at: "",
      completion_finalized: false,
      payment_method_id,
      payment_method_name,
      payment_method_snapshot: method,
      notes: String(notes || ""),
    };

    orders.unshift(order);
    writeJsonArray(ordersPath, orders);

    createNotification({ targetRole: "agent", targetId: String(agentId), title: "New payment proof received", message: `A new order from ${playerEmail} is waiting for review.` });
    if (duplicateDetected) {
      createNotification({ targetRole: "admin", targetId: "admin", title: "Possible duplicate proof", message: `Order ${order.id} was flagged because the uploaded proof image already exists.` });
    }

    return NextResponse.json({ message: "Order created successfully ✅", order });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
