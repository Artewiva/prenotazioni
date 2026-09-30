import { db } from "@/db";
import { reservations, restaurantTables, settings, users } from "@/db/schema";
import { hashPassword } from "./auth";
import { addDaysISO, todayISO } from "./utils";
import type { Status, Source } from "./types";

const TABLES = [
  { number: 1, zone: "Sala", seats: 2, notes: null as string | null },
  { number: 2, zone: "Sala", seats: 2, notes: null },
  { number: 3, zone: "Sala", seats: 4, notes: null },
  { number: 4, zone: "Sala", seats: 4, notes: "Accanto alla finestra" },
  { number: 5, zone: "Sala", seats: 6, notes: null },
  { number: 6, zone: "Sala", seats: 8, notes: "Tavolo grande per gruppi" },
  { number: 7, zone: "Terrazza", seats: 2, notes: null },
  { number: 8, zone: "Terrazza", seats: 4, notes: null },
  { number: 9, zone: "Terrazza", seats: 4, notes: "Angolo riservato" },
  { number: 10, zone: "Cantina", seats: 6, notes: "Ideale per serate intime" },
];

const GUESTS: Array<[string, string]> = [
  ["Giulia Bianchi", "3331234567"],
  ["Marco Rossi", "3405551122"],
  ["Sara Conti", "3478889900"],
  ["Luca Ferrari", "3394442211"],
  ["Elena Greco", "3482223344"],
  ["Davide Rinaldi", "3357776655"],
  ["Martina Esposito", "3491110022"],
  ["Alessandro Colombo", "3389998877"],
  ["Federica Romano", "3465554433"],
  ["Paolo De Santis", "3373332211"],
  ["Chiara Marino", "3458887766"],
  ["Roberto Villa", "3346665544"],
  ["Anna Barbieri", "3421234560"],
  ["Matteo Galdi", "3399871234"],
  ["Francesca Vitale", "3401112233"],
  ["Giorgio Sala", "3364445566"],
];

const NOTES = [
  null,
  null,
  "Tavolo vicino alla finestra, per favore",
  "Allergia alle arachidi",
  "Compleanno: portare il tortino di cioccolato",
  "Cliente abituale, preferisce la cantina",
  null,
  "Ritardo previsto di 15 minuti",
  null,
  "Cena romantica: candele sul tavolo",
];

const SOURCES: Source[] = ["telefono", "telefono", "web", "web", "walk_in"];
const TIMES = [
  "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00",
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function statusFor(offset: number, i: number, rnd: () => number): Status {
  if (offset < 0) return rnd() < 0.14 ? "cancellata" : "completata";
  if (offset === 0) {
    if (i < 2) return "completata";
    if (i === 2) return "in_corso";
    return rnd() < 0.4 ? "in_attesa" : "confermata";
  }
  return rnd() < 0.35 ? "in_attesa" : "confermata";
}

export async function ensureSeeded(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) return;

  const today = todayISO();
  const rnd = mulberry32(20250601);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]!;

  const adminHash = await hashPassword("admin123");
  const managerHash = await hashPassword("hostess123");

  const reservationRows: Array<{
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
  }> = [];

  await db.transaction(async (tx) => {
    await tx.insert(users).values([
      {
        name: "Alessandro Ricci",
        email: "admin@riserva.app",
        passwordHash: adminHash,
        role: "admin",
        active: true,
      },
      {
        name: "Giulia Ferri",
        email: "hostess@riserva.app",
        passwordHash: managerHash,
        role: "manager",
        active: true,
      },
    ]);

    const insertedTables = await tx
      .insert(restaurantTables)
      .values(TABLES)
      .returning({ id: restaurantTables.id, number: restaurantTables.number });
    const byNumber = new Map(insertedTables.map((t) => [t.number, t.id]));

    for (let offset = -3; offset <= 6; offset++) {
      const date = addDaysISO(today, offset);
      const count = 4 + Math.floor(rnd() * 3);
      const used = new Set<string>();
      for (let i = 0; i < count; i++) {
        let table = pick(TABLES);
        let time = pick(TIMES);
        let guard = 0;
        while (used.has(`${table.number}-${time}`) && guard++ < 30) {
          table = pick(TABLES);
          time = pick(TIMES);
        }
        if (used.has(`${table.number}-${time}`)) continue;
        used.add(`${table.number}-${time}`);

        const [name, phone] = pick(GUESTS);
        reservationRows.push({
          customerName: name,
          phone,
          email: rnd() < 0.3 ? `${name.toLowerCase().replace(/\s+/g, ".")}@email.it` : null,
          party: Math.min(1 + Math.floor(rnd() * 5), table.seats),
          tableId: byNumber.get(table.number)!,
          date,
          time,
          status: statusFor(offset, i, rnd),
          source: pick(SOURCES),
          notes: pick(NOTES),
        });
      }
    }

    await tx.insert(reservations).values(reservationRows);

    await tx.insert(settings).values([
      {
        restaurantName: "Osteria della Loggia",
        phone: "055 2345678",
        whatsappNumber: "393401234567",
        openingHour: "17:30",
        closingHour: "23:30",
        slotMinutes: 30,
        waTemplate:
          "Ciao {nome}, ecco il promemoria della tua prenotazione da {ristorante}: {data} alle {ora}, {tavolo} per {coperti} coperti. A presto! — Lo staff",
      },
    ]);
  });
}
