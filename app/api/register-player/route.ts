
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { createReferral } from "@/lib/bonus";
import { normalizePhoneWithCountry } from "@/lib/countries";
import { hashPassword } from "@/lib/security";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { dataPath, normalize, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plainPassword = String(body.password || "").trim();
    if (!String(body.username || "").trim() || !String(body.email || "").trim() || !String(body.phone || "").trim() || !plainPassword) {
      return NextResponse.json({ message: "Username, email, phone and password are required" }, { status: 400 });
    }
    const hashedPassword = await hashPassword(plainPassword);

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        const emailExists = await prisma.user.findFirst({ where: { email: String(body.email).trim() } });
        if (emailExists) return NextResponse.json({ message: "Email already exists" }, { status: 400 });
        const usernameExists = await prisma.user.findFirst({ where: { username: String(body.username || "").trim() } });
        if (usernameExists) return NextResponse.json({ message: "Username already exists" }, { status: 400 });

        let assignedAgentId = "";
        if (String(body.agent_code || "").trim()) {
          const match = await prisma.agent.findFirst({ where: { referralCode: String(body.agent_code).trim(), status: "account_created" } });
          if (!match) return NextResponse.json({ message: "Invalid agent code" }, { status: 400 });
          assignedAgentId = String(match.id);
        }

        const created = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: String(body.email).trim(),
              username: String(body.username || "").trim(),
              passwordHash: hashedPassword,
              role: "PLAYER",
              playerStatus: "inactive",
              assignedAgentId,
            },
          });
          const player = await tx.player.create({
            data: {
              userId: user.id,
              firstName: String(body.first_name || ""),
              lastName: String(body.last_name || ""),
              username: String(body.username || "").trim(),
              phone: normalizePhoneWithCountry(body.phone || "", body.country || "Morocco"),
              city: String(body.city || ""),
              country: String(body.country || "Morocco"),
              dateOfBirth: String(body.date_of_birth || ""),
              status: "inactive",
              assignedAgentId,
              referredBy: assignedAgentId || null,
            },
          });
          if (assignedAgentId) {
            await tx.activation.create({
              data: {
                agentId: assignedAgentId,
                playerUserId: user.id,
                playerEmail: user.email,
                username: user.username,
                passwordPlain: plainPassword,
                whatsapp: player.phone,
                status: "pending_activation",
              },
            });
          }
          return { user, player };
        });

        if (assignedAgentId) {
          createReferral({ player_user_id: created.user.id, player_email: created.user.email, referred_by_agent_id: assignedAgentId, first_order_reward_amount: 0 });
          createNotification({ targetRole: "agent", targetId: assignedAgentId, title: "New player linked by code", message: `${created.user.email} joined using your referral code.` });
        }

        createNotification({ targetRole: "player", targetId: created.user.id, title: "Account created", message: assignedAgentId ? "Your account was created and linked to your selected agent." : "Your account was created. Choose an agent to continue." });

        return NextResponse.json({
          message: assignedAgentId ? "Player account created and linked to agent ✅" : "Player account created successfully ✅",
          user: {
            id: created.user.id,
            email: created.user.email,
            username: created.user.username,
            password: created.user.passwordHash,
            role: "player",
            player_status: created.user.playerStatus,
            assigned_agent_id: created.user.assignedAgentId,
            created_at: created.user.createdAt,
          },
          nextStep: assignedAgentId ? "dashboard" : "select-agent",
        });
      }
    }

    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const agentsPath = dataPath("agents.json");
    const activationsPath = dataPath("activations.json");
    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const agents = readJsonArray<any>(agentsPath);
    const activations = readJsonArray<any>(activationsPath);

    if (users.some((item) => normalize(item.email) === normalize(body.email))) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }
    if (users.some((item) => normalize(item.username || "") === normalize(body.username || ""))) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    let assignedAgentId = "";
    if (String(body.agent_code || "").trim()) {
      const match = agents.find((item) => normalize(item.referral_code || "") === normalize(body.agent_code) && item.status === "account_created");
      if (!match) {
        return NextResponse.json({ message: "Invalid agent code" }, { status: 400 });
      }
      assignedAgentId = String(match.id);
    }

    const user = {
      id: uid("player-user"),
      email: String(body.email).trim(),
      username: String(body.username || "").trim(),
      password: hashedPassword,
      role: "player",
      player_status: "inactive",
      assigned_agent_id: assignedAgentId,
      created_at: nowIso(),
    };

    const player = {
      id: uid("player"),
      user_id: user.id,
      first_name: body.first_name || "",
      last_name: body.last_name || "",
      username: body.username || "",
      phone: normalizePhoneWithCountry(body.phone || "", body.country || "Morocco"),
      city: body.city || "",
      country: body.country || "Morocco",
      date_of_birth: body.date_of_birth || "",
      status: "inactive",
      assigned_agent_id: assignedAgentId,
      reassigned_from_agent_id: "",
      reassignment_count: 0,
      reassigned_at: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    activations.unshift({
      id: uid("activation"),
      agentId: assignedAgentId,
      playerUserId: user.id,
      playerEmail: user.email,
      username: user.username,
      password: plainPassword,
      passwordPlain: plainPassword,
      whatsapp: player.phone,
      status: assignedAgentId ? "pending_activation" : "awaiting_agent_selection",
      messageText: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    users.push(user);
    players.push(player);
    writeJsonArray(usersPath, users);
    writeJsonArray(playersPath, players);
    writeJsonArray(activationsPath, activations);

    if (assignedAgentId) {
      createReferral({ player_user_id: user.id, player_email: user.email, referred_by_agent_id: assignedAgentId, first_order_reward_amount: 0 });
      createNotification({ targetRole: "agent", targetId: assignedAgentId, title: "New player linked by code", message: `${user.email} joined using your referral code.` });
    }

    createNotification({ targetRole: "player", targetId: user.id, title: "Account created", message: assignedAgentId ? "Your account was created and linked to your selected agent." : "Your account was created. Choose an agent to continue." });

    return NextResponse.json({
      message: assignedAgentId ? "Player account created and linked to agent ✅" : "Player account created successfully ✅",
      user,
      nextStep: assignedAgentId ? "dashboard" : "select-agent",
    });
  } catch (error) {
    console.error("REGISTER PLAYER ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
