import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const rows = await db.select().from(settings).orderBy(settings.id).limit(1);
  const s = rows[0];
  if (!s) {
    return NextResponse.json({
      error: "Impostazioni non inizializzate",
    });
  }
  return NextResponse.json({
    settings: {
      restaurantName: s.restaurantName,
      phone: s.phone,
      whatsappNumber: s.whatsappNumber,
      openingHour: s.openingHour,
      closingHour: s.closingHour,
      slotMinutes: s.slotMinutes,
      waTemplate: s.waTemplate,
    },
  });
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PUT(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Solo un amministratore può modificare le impostazioni" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.restaurantName !== undefined) {
    const v = String(body.restaurantName ?? "").trim();
    if (v.length < 2 || v.length > 60)
      return NextResponse.json({ error: "Nome ristorante non valido" }, { status: 400 });
    patch.restaurantName = v;
  }
  if (body.phone !== undefined) {
    const v = String(body.phone ?? "").trim();
    if (v.length < 4) return NextResponse.json({ error: "Telefono non valido" }, { status: 400 });
    patch.phone = v;
  }
  if (body.whatsappNumber !== undefined) {
    const v = String(body.whatsappNumber ?? "").replace(/[^\d]/g, "");
    if (v.length < 9 || v.length > 15)
      return NextResponse.json({ error: "Numero WhatsApp non valido (usa il formato internazionale, es. 39...)" }, { status: 400 });
    patch.whatsappNumber = v;
  }
  if (body.openingHour !== undefined) {
    const v = String(body.openingHour ?? "");
    if (!TIME_RE.test(v)) return NextResponse.json({ error: "Apertura non valida" }, { status: 400 });
    patch.openingHour = v;
  }
  if (body.closingHour !== undefined) {
    const v = String(body.closingHour ?? "");
    if (!TIME_RE.test(v)) return NextResponse.json({ error: "Chiusura non valida" }, { status: 400 });
    patch.closingHour = v;
  }
  if (body.slotMinutes !== undefined) {
    const v = Number(body.slotMinutes);
    if (![15, 30, 45, 60].includes(v))
      return NextResponse.json({ error: "Durata slot non valida" }, { status: 400 });
    patch.slotMinutes = v;
  }
  if (body.waTemplate !== undefined) {
    const v = String(body.waTemplate ?? "");
    if (v.length < 10 || v.length > 500)
      return NextResponse.json({ error: "Template WhatsApp non valido" }, { status: 400 });
    patch.waTemplate = v;
  }

  const existing = await db.select().from(settings).orderBy(settings.id).limit(1);
  if (existing[0]) {
    await db.update(settings).set(patch).where(eq(settings.id, existing[0].id));
  } else {
    await db.insert(settings).values({ ...patch });
  }

  const rows = await db.select().from(settings).orderBy(settings.id).limit(1);
  const s = rows[0];
  return NextResponse.json({
    settings: {
      restaurantName: s.restaurantName,
      phone: s.phone,
      whatsappNumber: s.whatsappNumber,
      openingHour: s.openingHour,
      closingHour: s.closingHour,
      slotMinutes: s.slotMinutes,
      waTemplate: s.waTemplate,
    },
  });
}
