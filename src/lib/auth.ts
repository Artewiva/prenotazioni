import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "riserva_session";
const SECRET = process.env.SESSION_SECRET || "riserva-demo-secret-v1";
const TTL_MS = 7 * 24 * 3600 * 1000;

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(pw, salt, 64, (e, b) => (e ? rej(e) : res(b))),
  );
  return `${salt}:${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (calc.length !== expected.length) return false;
  return crypto.timingSafeEqual(calc, expected);
}

function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function setSession(userId: number): Promise<void> {
  const token = sign({ u: userId, exp: Date.now() + TTL_MS });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.u !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    const rows = await db.select().from(users).where(eq(users.id, payload.u));
    const u = rows[0];
    if (!u || !u.active) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role };
  } catch {
    return null;
  }
}
