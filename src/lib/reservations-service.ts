import { and, asc, eq, gte, like, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { reservations, restaurantTables } from "@/db/schema";
import type { Reservation, Source, Status } from "./types";

export const STATUSES: Status[] = [
  "in_attesa",
  "confermata",
  "in_corso",
  "completata",
  "cancellata",
];
export const SOURCES: Source[] = ["telefono", "web", "walk_in"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function withTable<T extends { r: typeof reservations.$inferSelect; t: typeof restaurantTables.$inferSelect | null }>(row: T): Reservation {
  return {
    id: row.r.id,
    customerName: row.r.customerName,
    phone: row.r.phone,
    email: row.r.email,
    party: row.r.party,
    tableId: row.r.tableId,
    tableNumber: row.t?.number ?? 0,
    tableZone: row.t?.zone ?? "",
    tableSeats: row.t?.seats ?? 0,
    date: row.r.date,
    time: row.r.time,
    status: row.r.status,
    source: row.r.source,
    notes: row.r.notes,
    createdAt: row.r.createdAt.toISOString(),
    updatedAt: row.r.updatedAt.toISOString(),
  };
}

export async function listReservations(params: {
  date?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
  q?: string | null;
}): Promise<Reservation[]> {
  const conds = [];
  if (params.date) conds.push(eq(reservations.date, params.date));
  if (params.dateFrom) conds.push(gte(reservations.date, params.dateFrom));
  if (params.dateTo) conds.push(lte(reservations.date, params.dateTo));
  if (params.status && STATUSES.includes(params.status as Status)) {
    conds.push(eq(reservations.status, params.status as Status));
  }
  if (params.q) {
    const likeQ = `%${params.q.replace(/[%_]/g, "")}%`;
    conds.push(
      or(like(reservations.customerName, likeQ), like(reservations.phone, likeQ)),
    );
  }
  const rows = await db
    .select({ r: reservations, t: restaurantTables })
    .from(reservations)
    .leftJoin(restaurantTables, eq(reservations.tableId, restaurantTables.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(reservations.date), asc(reservations.time), asc(reservations.id));
  return rows.map(withTable);
}

export async function getReservation(id: number): Promise<Reservation | null> {
  const rows = await db
    .select({ r: reservations, t: restaurantTables })
    .from(reservations)
    .leftJoin(restaurantTables, eq(reservations.tableId, restaurantTables.id))
    .where(eq(reservations.id, id));
  return rows[0] ? withTable(rows[0]) : null;
}

export interface ReservationInput {
  customerName: string;
  phone: string;
  email: string | null;
  party: number;
  tableId: number;
  date: string;
  time: string;
  status: Status;
  source: Source;
  notes: string | null;
}

export function validateReservation(
  body: Record<string, unknown>,
  partial: boolean,
): { data: Partial<ReservationInput> | null; error?: string } {
  const out: Partial<ReservationInput> = {};

  if (partial && body.customerName === undefined) {
    if (!Object.keys(body).length) return { data: null, error: "Nessun campo da aggiornare" };
  }

  if (body.customerName !== undefined || !partial) {
    const v = String(body.customerName ?? "").trim();
    if (v.length < 2) return { data: null, error: "Il nome del cliente è obbligatorio" };
    if (v.length > 60) return { data: null, error: "Nome troppo lungo" };
    out.customerName = v;
  }

  if (body.phone !== undefined || !partial) {
    const v = String(body.phone ?? "").trim();
    if (v.replace(/[^\d]/g, "").length < 6)
      return { data: null, error: "Inserisci un telefono valido (servito per il WhatsApp)" };
    out.phone = v;
  }

  if (body.email !== undefined) {
    const v = String(body.email ?? "").trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return { data: null, error: "Email non valida" };
    out.email = v || null;
  }

  if (body.party !== undefined || !partial) {
    const v = Number(body.party);
    if (!Number.isInteger(v) || v < 1 || v > 30)
      return { data: null, error: "Numero di coperti non valido (1–30)" };
    out.party = v;
  }

  if (body.tableId !== undefined || !partial) {
    const v = Number(body.tableId);
    if (!Number.isInteger(v) || v < 1) return { data: null, error: "Seleziona un tavolo" };
    out.tableId = v;
  }

  if (body.date !== undefined || !partial) {
    const v = String(body.date ?? "");
    if (!DATE_RE.test(v)) return { data: null, error: "Data non valida" };
    out.date = v;
  }

  if (body.time !== undefined || !partial) {
    const v = String(body.time ?? "");
    if (!TIME_RE.test(v)) return { data: null, error: "Orario non valido" };
    out.time = v;
  }

  if (body.status !== undefined || !partial) {
    const v = String(body.status ?? "in_attesa");
    if (!STATUSES.includes(v as Status)) return { data: null, error: "Stato non valido" };
    out.status = v as Status;
  }

  if (body.source !== undefined || !partial) {
    const v = String(body.source ?? "telefono");
    if (!SOURCES.includes(v as Source)) return { data: null, error: "Fonte non valida" };
    out.source = v as Source;
  }

  if (body.notes !== undefined) {
    const v = String(body.notes ?? "").trim();
    out.notes = v ? v.slice(0, 400) : null;
  }

  return { data: out };
}

/** Se c'è una prenotazione attiva (non cancellata) sullo stesso slot, restituisce il suo id. */
export async function findConflict(
  tableId: number,
  date: string,
  time: string,
  excludeId?: number,
): Promise<number | null> {
  const conds = [
    eq(reservations.tableId, tableId),
    eq(reservations.date, date),
    eq(reservations.time, time),
    ne(reservations.status, "cancellata"),
  ];
  if (excludeId) conds.push(ne(reservations.id, excludeId));
  const rows = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(...conds));
  return rows.length ? rows[0].id : null;
}

export async function tableNumber(tableId: number): Promise<number | null> {
  const rows = await db
    .select({ number: restaurantTables.number })
    .from(restaurantTables)
    .where(eq(restaurantTables.id, tableId));
  return rows[0]?.number ?? null;
}
