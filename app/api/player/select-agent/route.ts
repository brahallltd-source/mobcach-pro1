import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { uid } from "@/lib/json";
import { dataPath, normalize, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { playerEmail, agentId } = await req.json();
    if (!playerEmail || !agentId) return NextResponse.json({ message: "playerEmail and agentId are required" }, { status: 400 });

    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const agentsPath = dataPath("agents.json");
    const activationsPath = dataPath("activations.json");

    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const agents = readJsonArray<any>(agentsPath);
    const activations = readJsonArray<any>(activationsPath);

    const userIndex = users.findIndex((item) => normalize(item.email) === normalize(playerEmail) && item.role === "player");
    if (userIndex === -1) return NextResponse.json({ message: "Player not found" }, { status: 404 });

    const playerIndex = players.findIndex((item) => item.user_id === users[userIndex].id);
    if (playerIndex === -1) return NextResponse.json({ message: "Player profile not found" }, { status: 404 });

    const agent = agents.find((item) => String(item.id) === String(agentId) && item.status === "account_created");
    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    users[userIndex] = { ...users[userIndex], assigned_agent_id: String(agentId) };
    players[playerIndex] = { ...players[playerIndex], assigned_agent_id: String(agentId), referred_by: players[playerIndex]?.referred_by || "", updated_at: nowIso() };

    const ordersPath = dataPath("orders.json");
    const orders = readJsonArray<any>(ordersPath);
    orders.unshift({
      id: uid("link-thread"),
      agentId: String(agentId),
      playerEmail: String(playerEmail),
      amount: 0,
      gosport365_username: "",
      status: "linked_waiting_first_order",
      created_at: nowIso(),
      updated_at: nowIso(),
      system_thread: true,
      messages: [
        {
          senderRole: "system",
          message: "You have been linked successfully to your selected agent. You can now start your first recharge order from the Achat page.",
          created_at: nowIso(),
        }
      ],
    });

    const existingActivationIndex = activations.findIndex((item) => String(item.playerUserId) === String(users[userIndex].id));
    const activationRecord = {
      id: existingActivationIndex >= 0 ? activations[existingActivationIndex].id : uid("activation"),
      agentId: String(agentId),
      playerUserId: String(users[userIndex].id),
      playerEmail: String(users[userIndex].email || playerEmail),
      username: String(users[userIndex].username || players[playerIndex]?.username || ""),
      password: String((existingActivationIndex >= 0 ? (activations[existingActivationIndex].passwordPlain || activations[existingActivationIndex].password) : "") || ""),
      passwordPlain: String((existingActivationIndex >= 0 ? (activations[existingActivationIndex].passwordPlain || activations[existingActivationIndex].password) : "") || ""),
      whatsapp: String(players[playerIndex]?.phone || ""),
      status: "pending_activation",
      messageText: String(existingActivationIndex >= 0 ? activations[existingActivationIndex].messageText || "" : ""),
      created_at: existingActivationIndex >= 0 ? activations[existingActivationIndex].created_at : nowIso(),
      updated_at: nowIso(),
    };
    if (existingActivationIndex >= 0) activations[existingActivationIndex] = activationRecord;
    else activations.unshift(activationRecord);

    writeJsonArray(usersPath, users);
    writeJsonArray(playersPath, players);
    writeJsonArray(ordersPath, orders);
    writeJsonArray(activationsPath, activations);

    createNotification({
      targetRole: "agent",
      targetId: String(agentId),
      title: "New linked player",
      message: `${playerEmail} selected you as preferred agent.`,
    });
    createNotification({
      targetRole: "player",
      targetId: String(users[userIndex].id),
      title: "Agent linked successfully",
      message: "Your account is now linked to the selected agent. You can start the recharge flow immediately.",
    });

    return NextResponse.json({
      message: "Agent selected successfully ✅",
      user: users[userIndex],
      player: players[playerIndex],
    });
  } catch (error) {
    console.error("SELECT AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
