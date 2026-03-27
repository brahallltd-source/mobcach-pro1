
import { NextResponse } from "next/server";
import { dataPath, normalize, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { playerEmail } = await req.json();
    if (!playerEmail) return NextResponse.json({ message: "playerEmail is required" }, { status: 400 });
    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const userIndex = users.findIndex((item) => normalize(item.email) === normalize(playerEmail) && item.role === "player");
    if (userIndex === -1) return NextResponse.json({ message: "Player user not found" }, { status: 404 });
    const playerIndex = players.findIndex((item) => item.user_id === users[userIndex].id);
    if (playerIndex === -1) return NextResponse.json({ message: "Player profile not found" }, { status: 404 });
    users[userIndex] = { ...users[userIndex], assigned_agent_id: "" };
    players[playerIndex] = { ...players[playerIndex], assigned_agent_id: "" };
    writeJsonArray(usersPath, users);
    writeJsonArray(playersPath, players);
    return NextResponse.json({ message: "You can now choose a different agent", user: users[userIndex] });
  } catch (error) {
    console.error("CHANGE AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
