import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, hashPassword } from "@/lib/auth";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await params;
  const userId = Number(id);
  const current = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!current) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const isSelf = userId === me.id;
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2) return NextResponse.json({ error: "Nome non valido" }, { status: 400 });
    patch.name = name;
  }
  if (body.role !== undefined) {
    if (me.role !== "admin")
      return NextResponse.json({ error: "Solo un amministratore può modificare i ruoli" }, { status: 403 });
    if (isSelf && body.role !== "admin")
      return NextResponse.json({ error: "Non puoi demettere te stesso" }, { status: 400 });
    patch.role = body.role === "admin" ? "admin" : "manager";
  }
  if (body.active !== undefined) {
    if (isSelf) return NextResponse.json({ error: "Non puoi disattivare te stesso" }, { status: 400 });
    if (me.role !== "admin")
      return NextResponse.json({ error: "Solo un amministratore può disattivare utenti" }, { status: 403 });
    // Evita di spegnere l'ultimo admin attivo
    if (body.active === false && current.role === "admin") {
      const admins = await db
        .select({ id: users.id, active: users.active })
        .from(users)
        .where(eq(users.role, "admin"));
      const activeAdmins = admins.filter((a) => a.active && a.id !== userId).length;
      if (activeAdmins === 0)
        return NextResponse.json(
          { error: "Deve rimanere almeno un amministratore attivo" },
          { status: 409 },
        );
    }
    patch.active = Boolean(body.active);
  }
  if (body.password !== undefined) {
    const password = String(body.password ?? "");
    if (password.length < 6)
      return NextResponse.json({ error: "La password deve avere almeno 6 caratteri" }, { status: 400 });
    patch.passwordHash = await hashPassword(password);
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const updated = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  const u = updated[0];
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

export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Solo un amministratore può eliminare utenti" }, { status: 403 });
  }
  const { id } = await params;
  const userId = Number(id);
  if (userId === me.id) {
    return NextResponse.json({ error: "Non puoi eliminare te stesso" }, { status: 400 });
  }
  const current = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!current) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  if (current.role === "admin" && current.active) {
    const admins = await db
      .select({ id: users.id, active: users.active })
      .from(users)
      .where(eq(users.role, "admin"));
    const activeAdmins = admins.filter((a) => a.active && a.id !== userId).length;
    if (activeAdmins === 0) {
      return NextResponse.json(
        { error: "Deve rimanere almeno un amministratore attivo" },
        { status: 409 },
      );
    }
  }
  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
