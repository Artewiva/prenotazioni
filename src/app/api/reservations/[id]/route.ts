import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  findConflict,
  getReservation,
  tableNumber,
  validateReservation,
} from "@/lib/reservations-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { id } = await params;
  const resId = Number(id);
  if (!Number.isInteger(resId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  const current = await getReservation(resId);
  if (!current) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const { data, error } = validateReservation(body, true);
  if (error || !data) return NextResponse.json({ error }, { status: 400 });

  const nextTableId = data.tableId ?? current.tableId;
  const nextDate = data.date ?? current.date;
  const nextTime = data.time ?? current.time;
  if (
    (nextTableId !== current.tableId || nextDate !== current.date || nextTime !== current.time) &&
    data.status !== "cancellata"
  ) {
    const conflict = await findConflict(nextTableId, nextDate, nextTime, current.id);
    if (conflict) {
      const num = await tableNumber(nextTableId);
      return NextResponse.json(
        { error: `Tavolo ${num ?? "?"} già occupato il ${nextDate} alle ${nextTime}` },
        { status: 409 },
      );
    }
  }

  const updated = await db
    .update(reservations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(reservations.id, current.id))
    .returning();

  const fresh = await getReservation(current.id);
  void updated;
  if (!fresh) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }
  return NextResponse.json({ reservation: fresh });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { id } = await params;
  const resId = Number(id);
  const deleted = await db
    .delete(reservations)
    .where(eq(reservations.id, resId))
    .returning({ id: reservations.id });
  if (!deleted.length) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
