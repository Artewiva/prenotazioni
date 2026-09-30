import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reservations, restaurantTables } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  findConflict,
  listReservations,
  tableNumber,
  validateReservation,
} from "@/lib/reservations-service";

export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const url = new URL(req.url);
  const rows = await listReservations({
    date: url.searchParams.get("date"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    status: url.searchParams.get("status"),
    q: url.searchParams.get("q"),
  });
  return NextResponse.json({ reservations: rows });
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

  const { data, error } = validateReservation(body, false);
  if (error || !data) return NextResponse.json({ error }, { status: 400 });

  const tableRows = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.id, data.tableId!));
  if (!tableRows[0]) return NextResponse.json({ error: "Tavolo non trovato" }, { status: 404 });
  if (!tableRows[0].active) {
    return NextResponse.json(
      { error: `Il tavolo ${tableRows[0].number} è disattivato. Attivalo prima di prenotarlo.` },
      { status: 409 },
    );
  }

  const conflict = await findConflict(data.tableId!, data.date!, data.time!);
  if (conflict) {
    return NextResponse.json(
      {
        error: `Tavolo ${tableRows[0].number} già occupato il ${data.date} alle ${data.time}`,
      },
      { status: 409 },
    );
  }

  const inserted = await db
    .insert(reservations)
    .values({
      customerName: data.customerName!,
      phone: data.phone!,
      email: data.email ?? null,
      party: data.party!,
      tableId: data.tableId!,
      date: data.date!,
      time: data.time!,
      status: data.status!,
      source: data.source!,
      notes: data.notes ?? null,
    })
    .returning();

  return NextResponse.json({
    reservation: {
      ...inserted[0],
      tableNumber: tableRows[0].number,
      tableZone: tableRows[0].zone,
      tableSeats: tableRows[0].seats,
    },
  });
}
