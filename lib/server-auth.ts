
import { cookies } from "next/headers";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { dataPath, normalize, readJsonArray } from "@/lib/json";
import { verifySessionToken } from "@/lib/security";

export type SessionUser = {
  id: string;
  role: string;
  email: string;
  username?: string;
  permissions?: string[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("mobcash_session")?.value;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    const role = String(payload.role || "");
    const id = String(payload.id || "");
    const email = String(payload.email || "");
    const username = String(payload.username || "");

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return null;
        return {
          id: user.id,
          role: String(user.role).toLowerCase(),
          email: user.email,
          username: user.username,
          permissions: Array.isArray(user.permissions) ? user.permissions as string[] : undefined,
        };
      }
    }

    const users = readJsonArray<any>(dataPath("users.json"));
    const user = users.find((item) => item.id === id || normalize(item.email || "") === normalize(email));
    if (!user) return null;
    return {
      id: user.id,
      role: String(user.role || "").toLowerCase(),
      email: user.email,
      username: user.username,
      permissions: Array.isArray(user.permissions) ? user.permissions : undefined,
    };
  } catch {
    return null;
  }
}

export function hasAdminPermission(user: SessionUser | null, permission: string) {
  if (!user || user.role !== "admin") return false;
  if (!user.permissions || !user.permissions.length) return true;
  return user.permissions.includes(permission) || user.permissions.includes("full_access");
}

export async function requireAdminPermission(permission: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }
  if (!hasAdminPermission(user, permission)) {
    return { ok: false as const, status: 403, message: "Forbidden: missing permission" };
  }
  return { ok: true as const, user };
}
