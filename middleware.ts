
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/security";

const protectedPrefixes = ["/admin", "/agent", "/player"];
const publicPrefixes = ["/login", "/register/player", "/apply/agent", "/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) return NextResponse.next();
  const needsAuth = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("mobcash_session")?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  try {
    const payload = await verifySessionToken(token);
    const role = String(payload.role || "");
    if (pathname.startsWith("/admin") && role !== "admin") return NextResponse.redirect(new URL("/login", req.url));
    if (pathname.startsWith("/agent") && role !== "agent") return NextResponse.redirect(new URL("/login", req.url));
    if (pathname.startsWith("/player") && role !== "player") return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  } catch {
    const url = new URL("/login", req.url);
    const res = NextResponse.redirect(url);
    res.cookies.set("mobcash_session", "", { path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/agent/:path*", "/player/:path*"],
};
