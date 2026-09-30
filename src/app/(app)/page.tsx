"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  addDaysISO,
  capitalize,
  formatLong,
  relativeLabel,
  slotsFor,
  timeToMin,
  todayISO,
} from "@/lib/utils";
import type { Reservation, Settings, Table } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import {
  Button,
  Confirm,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusPill,
} from "@/components/ui";
import {
  IconCalendar,
  IconClock,
  IconPlus,
  IconTable,
  IconUsers,
  IconWhatsApp,
} from "@/components/icons";
import { ReservationModal } from "@/components/reservation-modal";
import { useToast } from "@/components/toast";

interface DashData {
  today: Reservation[];
  week: Reservation[];
  tables: Table[];
  settings: Settings;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-card animate-rise">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-soft">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="mt-1 font-display text-[30px] font-semibold leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-faint">{sub}</p>
    </div>
  );
}

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ reservation: Reservation | null } | null>(null);
  const [deleting, setDeleting] = useState<Reservation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const today = todayISO();
  const weekEnd = addDaysISO(today, 6);

  async function load() {
    setError("");
    try {
      const [t, w, tb, s] = await Promise.all([
        api<{ reservations: Reservation[] }>(`/api/reservations?date=${today}`),
        api<{ reservations: Reservation[] }>(
          `/api/reservations?dateFrom=${today}&dateTo=${weekEnd}`,
        ),
        api<{ tables: Table[] }>("/api/tables"),
        api<{ settings: Settings }>("/api/settings"),
      ]);
      setData({ today: t.reservations, week: w.reservations, tables: tb.tables, settings: s.settings });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  useEffect(() => {
    load();
  }, [today, weekEnd]);

  function handleSaved(r: Reservation, isNew: boolean) {
    setData((d) => {
      if (!d) return d;
      let todayList = d.today.filter((x) => x.id !== r.id);
      if (r.date === today) todayList = [...todayList, r].sort((a, b) => a.time.localeCompare(b.time));
      let weekList = d.week.filter((x) => x.id !== r.id);
      if (r.date >= today && r.date <= weekEnd) weekList = [...weekList, r];
      return { ...d, today: todayList, week: weekList };
    });
    void isNew;
  }

  function handleDeleted(r: Reservation) {
    setData((d) =>
      d
        ? {
            ...d,
            today: d.today.filter((x) => x.id !== r.id),
            week: d.week.filter((x) => x.id !== r.id),
          }
        : d,
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    const r = deleting;
    handleDeleted(r);
    setDeleteBusy(true);
    try {
      await api(`/api/reservations/${r.id}`, { method: "DELETE" });
      toast("success", "Prenotazione eliminata");
    } catch (e) {
      setData((d) =>
        d
          ? {
              ...d,
              today: d.today.some((x) => x.id === r.id)
                ? d.today
                : [...d.today, r].sort((a, b) => a.time.localeCompare(b.time)),
            }
          : d,
      );
      toast("error", errMsg(e));
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Panoramica" subtitle="La serata in un colpo d'occhio" />
        <div className="rounded-xl border border-bad/25 bg-badsoft p-6 text-center">
          <p className="text-sm font-semibold text-bad">{error}</p>
          <Button variant="ghost" className="mt-4" onClick={load}>
            Riprova
          </Button>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Panoramica" subtitle="La serata in un colpo d'occhio" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[110px]" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-[380px]" />
          <div className="space-y-4">
            <Skeleton className="h-[220px]" />
            <Skeleton className="h-[140px]" />
          </div>
        </div>
      </>
    );
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const active = data.today.filter((r) => r.status !== "cancellata");
  const covered = active.reduce((a, r) => a + r.party, 0);
  const incoming = active.filter(
    (r) =>
      timeToMin(r.time) >= nowMin &&
      (r.status === "confermata" || r.status === "in_attesa"),
  );
  const activeTables = data.tables.filter((t) => t.active).length;
  const slotCount = slotsFor(
    data.settings.openingHour,
    data.settings.closingHour,
    data.settings.slotMinutes,
  ).length;
  const occ =
    activeTables > 0 && slotCount > 0
      ? Math.min(100, Math.round((active.length / (activeTables * slotCount)) * 100))
      : 0;

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(today, i);
    const count = data.week.filter(
      (r) => r.date === iso && r.status !== "cancellata",
    ).length;
    return { iso, count, label: i === 0 ? "oggi" : WEEKDAY_SHORT[parseDay(iso)] };
  });
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <>
      <PageHeader
        title="Panoramica"
        subtitle={`${capitalize(formatLong(today))} · ${data.settings.restaurantName}`}
        actions={
          <Link href="/calendario">
            <Button variant="ghost" size="sm">
              <IconCalendar size={15} />
              Apri il calendario
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Prenotazioni oggi"
          value={String(active.length)}
          sub={`su ${activeTables} tavoli attivi`}
          icon={<IconCalendar size={16} />}
          tone="bg-terrasoft text-terradark"
        />
        <StatCard
          label="Coperti previsti"
          value={String(covered)}
          sub="ospiti per tutta la giornata"
          icon={<IconUsers size={16} />}
          tone="bg-oksoft text-ok"
        />
        <StatCard
          label="In arrivo"
          value={String(incoming.length)}
          sub="confermate o in attesa, dall'ora attuale"
          icon={<IconClock size={16} />}
          tone="bg-warnsoft text-warn"
        />
        <StatCard
          label="Occupazione"
          value={`${occ}%`}
          sub="slot impegnati su quelli totali"
          icon={<IconTable size={16} />}
          tone="bg-linesoft text-soft"
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        {/* Prenotazioni di oggi */}
        <div className="rounded-xl border border-line bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-linesoft px-4 py-3">
            <h2 className="font-display text-[16px] font-semibold">Prenotazioni di oggi</h2>
            <span className="rounded-full bg-linesoft px-2.5 py-1 text-[11px] font-bold text-soft tabular-nums">
              {active.length}
            </span>
          </div>

          {active.length === 0 ? (
            <EmptyState
              icon={<IconCalendar size={24} />}
              title="Nessuna prenotazione per oggi"
              text="Crea la prima prenotazione per questa serata o controlla gli altri giorni dal calendario."
              action={
                <Button variant="accent" onClick={() => setModal({ reservation: null })}>
                  <IconPlus size={15} strokeWidth={2.4} />
                  Nuova prenotazione
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-linesoft">
              {data.today
                .filter((r) => r.status !== "cancellata")
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((r) => {
                  const diff = (r.date === today)
                    ? r.time.localeCompare(
                        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
                      )
                    : 1;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => setModal({ reservation: r })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-paper/70"
                      >
                        <span className="w-12 shrink-0 text-[15px] font-bold tabular-nums">
                          {r.time}
                        </span>
                        {r.date === today && (
                          <span
                            className={
                              diff > 0
                                ? "shrink-0 rounded-full bg-oksoft px-2 py-0.5 text-[10px] font-bold text-ok"
                                : "shrink-0 rounded-full bg-warnsoft px-2 py-0.5 text-[10px] font-bold text-warn"
                            }
                          >
                            {relativeLabel(r.date, r.time)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">
                            {r.customerName}
                          </span>
                          <span className="block truncate text-[11.5px] text-soft">
                            T{r.tableNumber} · {r.tableZone} · {r.party} coperti
                          </span>
                        </span>
                        <StatusPill status={r.status} />
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        {/* Colonna destra */}
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-card p-4 shadow-card">
            <h2 className="font-display text-[16px] font-semibold">Prossimi 7 giorni</h2>
            <div className="mt-4 flex h-36 items-end gap-2">
              {days.map((d) => (
                <div key={d.iso} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] font-bold tabular-nums text-soft">{d.count}</span>
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        d.label === "oggi" ? "bg-terra" : "bg-pine/80"
                      }`}
                      style={{ height: `${Math.max(6, (d.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      d.label === "oggi" ? "text-terra" : "text-faint"
                    }`}
                  >
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              Prenotazioni attive, cancellate escluse.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dcf8c6] text-[#1f8f5f]">
                <IconWhatsApp size={18} />
              </span>
              <div>
                <h3 className="text-[13.5px] font-bold">Promemoria WhatsApp</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-soft">
                  Da ogni prenotazione puoi aprire WhatsApp con il messaggio già
                  compilato: data, ora, tavolo e coperti.
                </p>
                <Link
                  href="/impostazioni"
                  className="mt-2 inline-block text-[12px] font-bold text-terra hover:text-terradark"
                >
                  Personalizza il template →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <ReservationModal
          open
          onClose={() => setModal(null)}
          reservation={modal.reservation}
          tables={data.tables}
          settings={data.settings}
          onSaved={handleSaved}
          onDelete={(r) => {
            setModal(null);
            setDeleting(r);
          }}
        />
      )}

      <Confirm
        open={!!deleting}
        title="Eliminare la prenotazione?"
        text={
          deleting
            ? `La prenotazione di ${deleting.customerName} (${formatLong(deleting.date)} alle ${deleting.time}) verrà rimossa definitivamente.`
            : ""
        }
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function parseDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
