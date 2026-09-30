import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "manager"] }).notNull().default("manager"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const restaurantTables = pgTable("restaurant_tables", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  zone: text("zone").notNull().default("Sala"),
  seats: integer("seats").notNull().default(2),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    party: integer("party").notNull().default(2),
    tableId: integer("table_id")
      .notNull()
      .references(() => restaurantTables.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    time: text("time").notNull(), // HH:MM
    status: text("status", {
      enum: ["in_attesa", "confermata", "in_corso", "completata", "cancellata"],
    }).notNull().default("in_attesa"),
    source: text("source", {
      enum: ["telefono", "web", "walk_in"],
    }).notNull().default("telefono"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("reservations_date_idx").on(t.date)],
);

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  restaurantName: text("restaurant_name").notNull().default("Osteria della Loggia"),
  phone: text("phone").notNull().default("055 1234567"),
  whatsappNumber: text("whatsapp_number").notNull().default("393401234567"),
  openingHour: text("opening_hour").notNull().default("17:30"),
  closingHour: text("closing_hour").notNull().default("23:30"),
  slotMinutes: integer("slot_minutes").notNull().default(30),
  waTemplate: text("wa_template").notNull().default(
    "Ciao {nome}, ecco il promemoria della tua prenotazione da {ristorante}: {data} alle {ora}, {tavolo} per {coperti} coperti. A presto! — Lo staff",
  ),
});
