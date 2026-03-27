import { NextResponse } from "next/server";
import { dataPath, normalize, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

function splitName(fullName: string) {
  const clean = String(fullName || "").trim().replace(/\s+/g, " ");
  const parts = clean.split(" ");
  return { first_name: parts[0] || "", last_name: parts.slice(1).join(" ") };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ message: "Email is required", application: null }, { status: 400 });
    const agents = readJsonArray<any>(dataPath("agents.json"));
    const application = agents.find((agent) => normalize(agent.email) === normalize(email) && agent.applied_from === "player");
    return NextResponse.json({ application: application || null });
  } catch (error) {
    console.error("GET BECOME AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error", application: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, phone, email, note } = await req.json();
    if (!name || !phone || !email) return NextResponse.json({ message: "name, phone and email are required" }, { status: 400 });
    const agentsPath = dataPath("agents.json");
    const agents = readJsonArray<any>(agentsPath);
    const existing = agents.find((agent) => normalize(agent.email) === normalize(email));
    if (existing) return NextResponse.json({ message: existing.status === "pending_agent_review" ? "You already have a pending application" : "An agent record already exists for this email" }, { status: 400 });
    const names = splitName(name);
    const application = { id: uid("agent-app"), ...names, full_name: String(name).trim(), email: String(email).trim(), password: "123456", phone: String(phone).trim(), country: "Morocco", note: String(note || "").trim(), status: "pending_agent_review", referral_code: "", applied_from: "player", online: false, created_at: nowIso(), updated_at: nowIso() };
    agents.unshift(application); writeJsonArray(agentsPath, agents);
    return NextResponse.json({ message: "Agent application submitted successfully ✅", application });
  } catch (error) {
    console.error("CREATE BECOME AGENT APPLICATION ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
