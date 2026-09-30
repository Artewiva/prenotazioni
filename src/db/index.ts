import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsMemoryPool?: Pool;
};

// Local preview fallback: keep these tables aligned with src/db/schema.ts.
function createMemoryPool(): Pool {
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  memoryDb.public.none(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'manager',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE restaurant_tables (
      id SERIAL PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      zone TEXT NOT NULL DEFAULT 'Sala',
      seats INTEGER NOT NULL DEFAULT 2,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE reservations (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      party INTEGER NOT NULL DEFAULT 2,
      table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_attesa',
      source TEXT NOT NULL DEFAULT 'telefono',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX reservations_date_idx ON reservations(date);

    CREATE TABLE settings (
      id SERIAL PRIMARY KEY,
      restaurant_name TEXT NOT NULL DEFAULT 'Osteria della Loggia',
      phone TEXT NOT NULL DEFAULT '055 1234567',
      whatsapp_number TEXT NOT NULL DEFAULT '393401234567',
      opening_hour TEXT NOT NULL DEFAULT '17:30',
      closing_hour TEXT NOT NULL DEFAULT '23:30',
      slot_minutes INTEGER NOT NULL DEFAULT 30,
      wa_template TEXT NOT NULL DEFAULT 'Ciao {nome}, ecco il promemoria della tua prenotazione da {ristorante}: {data} alle {ora}, {tavolo} per {coperti} coperti. A presto! — Lo staff'
    );
  `);

  const { Pool: MemoryPool } = memoryDb.adapters.createPg();
  const pool = new MemoryPool() as unknown as Pool;
  const runQuery = pool.query.bind(pool) as (
    query: unknown,
    ...args: unknown[]
  ) => unknown;

  // Drizzle's pg driver requests row arrays and custom type parsers, which pg-mem lacks.
  Object.defineProperty(pool, "query", {
    configurable: true,
    value: (query: unknown, ...args: unknown[]) => {
      if (typeof query === "string") return runQuery(query, ...args);

      const config = query as { rowMode?: string; types?: unknown } & Record<string, unknown>;
      const arrayMode = config.rowMode === "array";
      const safeConfig = { ...config, rowMode: undefined, types: undefined };
      const mapResult = (result: unknown) => {
        if (!arrayMode || !result || typeof result !== "object") return result;
        const response = result as { rows?: Array<Record<string, unknown>> };
        return {
          ...result,
          rows: response.rows?.map((row) => Object.values(row)) ?? [],
        };
      };

      const callbackIndex = args.findIndex((arg) => typeof arg === "function");
      if (callbackIndex >= 0) {
        const callback = args[callbackIndex] as (
          error: unknown,
          result?: unknown,
        ) => void;
        args[callbackIndex] = (error: unknown, result?: unknown) =>
          callback(error, mapResult(result));
        return runQuery(safeConfig, ...args);
      }

      const result = runQuery(safeConfig, ...args);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        return (result as Promise<unknown>).then(mapResult);
      }
      return mapResult(result);
    },
  });

  return pool;
}

let pool: Pool;
if (databaseUrl) {
  pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({ connectionString: databaseUrl });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
} else if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  throw new Error("DATABASE_URL is required in production");
} else {
  pool = globalForDb.__arenaNextJsMemoryPool ?? createMemoryPool();
  globalForDb.__arenaNextJsMemoryPool = pool;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "DATABASE_URL is not set; using an in-memory database for development. Data will reset when the server restarts.",
    );
  }
}

export const db = drizzle(pool);
export { pool };
