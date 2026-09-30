import type { Source, Status } from "./types";

export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const DAY_NAMES = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
const MONTHS_SHORT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

export function formatLong(iso: string): string {
  const d = parseISO(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minToTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function slotsFor(opening: string, closing: string, step: number): string[] {
  const out: string[] = [];
  const start = timeToMin(opening);
  const end = timeToMin(closing);
  for (let t = start; t < end; t += step) out.push(minToTime(t));
  if (out.length === 0) out.push(opening);
  return out;
}

/** Minuti (positivi se nel futuro) tra adesso e date+time. */
export function minutesUntil(iso: string, time: string): number {
  const target = parseISO(iso).getTime() + timeToMin(time) * 60000;
  return Math.round((target - Date.now()) / 60000);
}

export function relativeLabel(iso: string, time: string): string {
  const diff = minutesUntil(iso, time);
  if (diff > 90) return `tra ${Math.floor(diff / 60)}h ${pad(diff % 60)}m`;
  if (diff > 15) return `tra ${diff} min`;
  if (diff >= -10) return "in questi minuti";
  if (diff >= -90) return `in ritardo di ${-diff} min`;
  return "in ritardo";
}

/** Normalizza un numero telefonico italiano al formato internazionale per wa.me */
export function waDigits(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "39" + d.slice(1);
  else if (d.startsWith("3") && d.length === 10) d = "39" + d;
  return d;
}

export function buildWaUrl(number: string, message: string): string {
  return `https://wa.me/${waDigits(number)}?text=${encodeURIComponent(message)}`;
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const STATUS_META: Record<
  Status,
  { label: string; pill: string; dot: string; cell: string }
> = {
  in_attesa: {
    label: "In attesa",
    pill: "bg-warnsoft text-warn",
    dot: "bg-warn",
    cell: "bg-warnsoft/60 border-warn/30",
  },
  confermata: {
    label: "Confermata",
    pill: "bg-oksoft text-ok",
    dot: "bg-ok",
    cell: "bg-oksoft/60 border-ok/30",
  },
  in_corso: {
    label: "In corso",
    pill: "bg-terrasoft text-terradark",
    dot: "bg-terra",
    cell: "bg-terrasoft/70 border-terra/40",
  },
  completata: {
    label: "Completata",
    pill: "bg-linesoft text-soft",
    dot: "bg-faint",
    cell: "bg-linesoft/70 border-line",
  },
  cancellata: {
    label: "Cancellata",
    pill: "bg-badsoft text-bad",
    dot: "bg-bad",
    cell: "bg-badsoft/50 border-bad/25",
  },
};

export const STATUS_ORDER: Status[] = [
  "in_attesa",
  "confermata",
  "in_corso",
  "completata",
  "cancellata",
];

export const SOURCE_META: Record<Source, { label: string; icon: string }> = {
  telefono: { label: "Telefono", icon: "phone" },
  web: { label: "Web", icon: "globe" },
  walk_in: { label: "Di persona", icon: "users" },
};
