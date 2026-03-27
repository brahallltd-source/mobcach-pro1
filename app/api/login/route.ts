
import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { dataPath, normalize, readJsonArray } from "@/lib/json";
import { signSessionToken, verifyPassword } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();
    const cleanIdentifier = normalize(identifier || "");
    let user: any = null;

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        const users = await prisma.user.findMany();
        user = users.find((item) => normalize(item.username || "") === cleanIdentifier || normalize(item.email || "") === cleanIdentifier) || null;
        if (user && !(await verifyPassword(String(password), String(user.passwordHash || "")))) user = null;
        if (user) {
          const role = String(user.role).toLowerCase();
          const publicUser = {
            id: user.id,
            email: user.email,
            username: user.username,
            role,
            player_status: user.playerStatus || undefined,
            assigned_agent_id: user.assignedAgentId || undefined,
            agentId: user.agentId || undefined,
            permissions: user.permissions || undefined,
            created_at: user.createdAt,
          };
          const token = await signSessionToken({ id: user.id, role, email: user.email, username: user.username });
          const res = NextResponse.json({ user: publicUser });
          res.cookies.set("mobcash_session", token, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 60 * 60 * 24 * 7 });
          return res;
        }
      }
    }

    const users = readJsonArray<any>(dataPath("users.json"));
    const players = readJsonArray<any>(dataPath("players.json"));
    const agents = readJsonArray<any>(dataPath("agents.json"));

    for (const item of users) {
      const emailMatch = normalize(item.email || "") === cleanIdentifier;
      const usernameMatch = normalize(item.username || "") === cleanIdentifier;
      let match = emailMatch || usernameMatch;
      if (!match && item.role === "player") {
        const player = players.find((row) => row.user_id === item.id);
        match = normalize(player?.username || "") === cleanIdentifier;
      }
      if (!match && item.role === "agent") {
        const agent = agents.find((row) => String(row.id) === String(item.agentId));
        const agentUsername = agent?.username || String(agent?.email || "").split("@")[0];
        match = normalize(agentUsername) === cleanIdentifier;
      }
      if (!match) continue;
      const ok = await verifyPassword(String(password), String(item.password || ""));
      if (!ok) continue;
      user = item;
      break;
    }

    if (!user) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    const token = await signSessionToken({ id: user.id, role: user.role, email: user.email, username: user.username });
    const res = NextResponse.json({ user });
    res.cookies.set("mobcash_session", token, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
