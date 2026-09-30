import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reservations, restaurantTables } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { id } = await params;
  const tableId = Number(id);
  const current = (
    await db.select().from(restaurantTables).where(eq(restaurantTables.id, tableId))
  )[0];
  if (!current) return NextResponse.json({ error: "Tavolo non trovato" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.number !== undefined) {
    const number = Number(body.number);
    if (!Number.isInteger(number) || number < 1 || number > 999) {
      return NextResponse.json({ error: "Numero di tavolo non valido" }, { status: 400 });
    }
    const dup = await db
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(eq(restaurantTables.number, number));
    if (dup.some((d) => d.id !== tableId)) {
      return NextResponse.json(
        { error: `Esiste già un tavolo con il numero ${number}` },
        { status: 409 },
      );
    }
    patch.number = number;
  }
  if (body.zone !== undefined) {
    const zone = String(body.zone ?? "").trim();
    if (!zone || zone.length > 30) {
      return NextResponse.json({ error: "Zona non valida" }, { status: 400 });
    }
    patch.zone = zone;
  }
  if (body.seats !== undefined) {
    const seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 24) {
      return NextResponse.json({ error: "Posti non validi (1–24)" }, { status: 400 });
    }
    patch.seats = seats;
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.notes !== undefined) {
    patch.notes = body.notes ? String(body.notes).trim().slice(0, 200) : null;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const updated = await db
    .update(restaurantTables)
    .set(patch)
    .where(eq(restaurantTables.id, tableId))
    .returning();
  return NextResponse.json({ table: { ...updated[0], dayCount: 0 } });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { id } = await params;
  const tableId = Number(id);

  const [c] = await db
    .select({ c: sql<number>`count(*)` })
    .from(reservations)
    .where(eq(reservations.tableId, tableId));
  if (c && c.c > 0) {
    return NextResponse.json(
      {
        error: `Il tavolo ha ancora ${c.c} prenotazione${c.c === 1 ? "" : "i"}: spostale o cancellale prima di eliminarlo.`,
      },
      { status: 409 },
    );
  }

  const deleted = await db
    .delete(restaurantTables)
    .where(eq(restaurantTables.id, tableId))
    .returning({ id: restaurantTables.id });
  if (!deleted.length) {
    return NextResponse.json({ error: "Tavolo non trovato" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
