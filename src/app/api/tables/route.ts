import { NextResponse } from "next/server";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { reservations, restaurantTables } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const rows = await db
    .select()
    .from(restaurantTables)
    .orderBy(asc(restaurantTables.number));

  const counts = new Map<number, number>();
  if (date) {
    const cs = await db
      .select({ tableId: reservations.tableId, c: count() })
      .from(reservations)
      .where(
        and(
          eq(reservations.date, date),
          ne(reservations.status, "cancellata"),
        ),
      )
      .groupBy(reservations.tableId);
    cs.forEach((r) => counts.set(r.tableId, r.c));
  }

  return NextResponse.json({
    tables: rows.map((t) => ({ ...t, dayCount: counts.get(t.id) ?? 0 })),
  });
}

export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const number = Number(body.number);
  const zone = String(body.zone ?? "").trim();
  const seats = Number(body.seats);
  const notes = body.notes ? String(body.notes).trim().slice(0, 200) : null;

  if (!Number.isInteger(number) || number < 1 || number > 999)
    return NextResponse.json({ error: "Numero di tavolo non valido" }, { status: 400 });
  if (!zone || zone.length > 30)
    return NextResponse.json({ error: "Indica la zona (es. Sala, Terrazza)" }, { status: 400 });
  if (!Number.isInteger(seats) || seats < 1 || seats > 24)
    return NextResponse.json({ error: "Posti non validi (1–24)" }, { status: 400 });

  const dup = await db
    .select({ id: restaurantTables.id })
    .from(restaurantTables)
    .where(eq(restaurantTables.number, number));
  if (dup.length) {
    return NextResponse.json(
      { error: `Esiste già un tavolo con il numero ${number}` },
      { status: 409 },
    );
  }

  const inserted = await db
    .insert(restaurantTables)
    .values({ number, zone, seats, notes, active: body.active !== false })
    .returning();
  return NextResponse.json({ table: { ...inserted[0], dayCount: 0 } });
}
