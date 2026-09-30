import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, hashPassword } from "@/lib/auth";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.id));
  return NextResponse.json({
    users: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    me: me.id,
  });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json(
      { error: "Solo un amministratore può creare utenti" },
      { status: 403 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : "manager";

  if (name.length < 2) return NextResponse.json({ error: "Nome non valido" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Email non valida" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "La password deve avere almeno 6 caratteri" }, { status: 400 });

  const dup = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (dup.length) {
    return NextResponse.json({ error: "Esiste già un utente con questa email" }, { status: 409 });
  }

  const inserted = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password), role, active: true })
    .returning();
  const u = inserted[0];
  return NextResponse.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
    },
  });
}
