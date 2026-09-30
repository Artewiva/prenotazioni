"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  capitalize,
  cn,
  formatLong,
  monthLabel,
  slotsFor,
  toISODate,
  todayISO,
} from "@/lib/utils";
import type { Reservation, Settings, Table } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import {
  Button,
  Confirm,
  IconButton,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@/components/icons";
import { ReservationModal } from "@/components/reservation-modal";
import { useToast } from "@/components/toast";
import { STATUS_META, STATUS_ORDER } from "@/lib/utils";

const WEEKHEAD = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

type ModalState =
  | { mode: "new"; date: string; time: string; tableId?: number }
  | { mode: "edit"; reservation: Reservation }
  | null;

export default function CalendarPage() {
  const toast = useToast();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(todayISO());
  const [tables, setTables] = useState<Table[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [monthRes, setMonthRes] = useState<Reservation[]>([]);
  const [dayRes, setDayRes] = useState<Reservation[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [error, setError] = useState("");
  const [bump, setBump] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<Reservation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const today = todayISO();

  useEffect(() => {
    Promise.all([
      api<{ tables: Table[] }>("/api/tables"),
      api<{ settings: Settings }>("/api/settings"),
    ])
      .then(([t, s]) => {
        setTables(t.tables);
        setSettings(s.settings);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  // Mese (per i badge di conteggio)
  useEffect(() => {
    const start = toISODate(new Date(cursor.y, cursor.m, 1));
    const end = toISODate(new Date(cursor.y, cursor.m + 1, 0));
    api<{ reservations: Reservation[] }>(
      `/api/reservations?dateFrom=${start}&dateTo=${end}`,
    )
      .then((r) => setMonthRes(r.reservations))
      .catch(() => {});
  }, [cursor, bump]);

  // Giorno selezionato
  useEffect(() => {
    setLoadingDay(true);
    api<{ reservations: Reservation[] }>(`/api/reservations?date=${selected}`)
      .then((r) => {
        setDayRes(
          [...r.reservations].sort((a, b) => a.time.localeCompare(b.time)),
        );
        setLoadingDay(false);
      })
      .catch((e) => {
        setError(errMsg(e));
        setLoadingDay(false);
      });
  }, [selected, bump]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(cursor.y, cursor.m, 1 - startOffset + i);
      return { iso: toISODate(d), inMonth: d.getMonth() === cursor.m, day: d.getDate() };
    });
  }, [cursor]);

  const monthCounts = useMemo(() => {
    const map = new Map<string, number>();
    monthRes.forEach((r) => {
      if (r.status === "cancellata") return;
      map.set(r.date, (map.get(r.date) ?? 0) + 1);
    });
    return map;
  }, [monthRes]);

  const slots = settings
    ? slotsFor(settings.openingHour, settings.closingHour, settings.slotMinutes)
    : [];

  const byCell = useMemo(() => {
    const map = new Map<string, Reservation>();
    dayRes.forEach((r) => map.set(`${r.tableId}|${r.time}`, r));
    return map;
  }, [dayRes]);

  const dayActive = dayRes.filter((r) => r.status !== "cancellata");
  const dayCovered = dayActive.reduce((a, r) => a + r.party, 0);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function handleSaved(r: Reservation, isNew: boolean) {
    if (r.date === selected) {
      setDayRes((list) => {
        const next = list.filter((x) => x.id !== r.id);
        next.push(r);
        return next.sort((a, b) => a.time.localeCompare(b.time));
      });
    }
    setBump((b) => b + 1);
    void isNew;
  }

  function confirmDelete() {
    if (!deleting) return;
    const r = deleting;
    const snapshot = dayRes;
    setDayRes((list) => list.filter((x) => x.id !== r.id));
    setDeleteBusy(true);
    api(`/api/reservations/${r.id}`, { method: "DELETE" })
      .then(() => {
        toast("success", "Prenotazione eliminata");
        setBump((b) => b + 1);
      })
      .catch((e) => {
        setDayRes(snapshot);
        toast("error", errMsg(e));
      })
      .finally(() => {
        setDeleteBusy(false);
        setDeleting(null);
      });
  }

  if (error && !dayRes.length) {
    return (
      <>
        <PageHeader title="Calendario" subtitle="Pianifica le serate per giorno, ora e tavolo" />
        <div className="rounded-xl border border-bad/25 bg-badsoft p-6 text-center">
          <p className="text-sm font-semibold text-bad">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Calendario"
        subtitle="Pianifica le serate per giorno, ora e tavolo"
        actions={
          <Button
            variant="accent"
            size="sm"
            onClick={() => setModal({ mode: "new", date: selected, time: slots[0] })}
          >
            <IconPlus size={15} strokeWidth={2.4} />
            Prenota per {selected === today ? "oggi" : capitalize(formatLong(selected))}
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-bad/25 bg-badsoft px-4 py-3 text-sm font-medium text-bad">
          {error}
        </div>
      )}

      {/* Mese */}
      <div className="rounded-xl border border-line bg-card p-4 shadow-card animate-rise">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold capitalize">
            {monthLabel(cursor.y, cursor.m)}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => {
              const d = new Date();
              setCursor({ y: d.getFullYear(), m: d.getMonth() });
              setSelected(todayISO());
            }}>
              Oggi
            </Button>
            <IconButton onClick={() => shiftMonth(-1)} aria-label="Mese precedente">
              <IconChevronLeft size={18} />
            </IconButton>
            <IconButton onClick={() => shiftMonth(1)} aria-label="Mese successivo">
              <IconChevronRight size={18} />
            </IconButton>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKHEAD.map((w) => (
            <div
              key={w}
              className="pb-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-faint"
            >
              {w}
            </div>
          ))}
          {cells.map((cell) => {
            const n = monthCounts.get(cell.iso) ?? 0;
            const isSel = cell.iso === selected;
            const isToday = cell.iso === today;
            return (
              <button
                key={cell.iso}
                onClick={() => setSelected(cell.iso)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[13px] font-semibold transition-colors",
                  cell.inMonth ? "text-ink hover:bg-linesoft" : "text-faint/60 hover:bg-linesoft/50",
                  isSel && "bg-pine text-cream hover:bg-pine",
                  isToday && !isSel && "ring-1 ring-inset ring-terra/70",
                )}
              >
                {cell.day}
                {n > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[9.5px] font-bold leading-4 tabular-nums",
                      isSel ? "bg-cream/25 text-cream" : "bg-terrasoft text-terradark",
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Board del giorno */}
      <div className="mt-4 rounded-xl border border-line bg-card shadow-card animate-rise">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-linesoft px-4 py-3">
          <h2 className="font-display text-[17px] font-semibold capitalize">
            {formatLong(selected)}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-soft">
            <span className="rounded-full bg-linesoft px-2.5 py-1 tabular-nums">
              {dayActive.length} prenotazioni
            </span>
            <span className="rounded-full bg-linesoft px-2.5 py-1 tabular-nums">
              {dayCovered} coperti
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {STATUS_ORDER.filter((s) => s !== "cancellata").map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-soft">
                <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>

        {loadingDay ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-6 text-center text-sm text-soft">
            Nessun tavolo configurato: aggiungilo dalla sezione{" "}
            <span className="font-bold text-ink">Tavoli</span> per usare la board.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {dayRes.length === 0 && (
              <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-dashed border-line bg-paper/60 px-3.5 py-2.5 text-[12.5px] text-soft">
                <IconCalendar size={16} className="shrink-0 text-faint" />
                Nessuna prenotazione per questo giorno: clicca su una cella libera per crearne una.
              </div>
            )}
            <div
              className="grid min-w-[860px]"
              style={{
                gridTemplateColumns: `76px repeat(${tables.length}, minmax(148px, 1fr))`,
              }}
            >
              <div className="border-b border-r border-linesoft bg-paper/70 px-2 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-faint">
                Ora
              </div>
              {tables.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "border-b border-r border-linesoft bg-paper/70 px-2.5 py-2",
                    !t.active && "opacity-50",
                  )}
                >
                  <span className="font-display text-[14px] font-semibold">
                    T{t.number}
                  </span>
                  <span className="ml-1.5 text-[10.5px] font-medium text-soft">
                    {t.zone} · {t.seats} posti
                  </span>
                  {!t.active && (
                    <span className="ml-1 text-[9px] font-bold uppercase text-faint">off</span>
                  )}
                </div>
              ))}

              {slots.map((time) => (
                <Fragment key={time}>
                  <div className="border-b border-r border-linesoft px-2 py-1.5 text-right text-[11.5px] font-bold tabular-nums text-soft">
                    {time}
                  </div>
                  {tables.map((t) => {
                    const r = byCell.get(`${t.id}|${time}`);
                    return (
                      <div
                        key={t.id}
                        className="group relative min-h-[46px] border-b border-r border-linesoft p-1"
                      >
                        {r ? (
                          <button
                            onClick={() => setModal({ mode: "edit", reservation: r })}
                            className={cn(
                              "h-full w-full rounded-lg border px-2 py-1.5 text-left transition hover:-translate-y-px hover:shadow-sm",
                              STATUS_META[r.status].cell,
                              r.status === "cancellata" && "opacity-55",
                            )}
                            title={`${r.customerName} · ${r.party} coperti`}
                          >
                            <span
                              className={cn(
                                "block truncate text-[12px] font-bold leading-tight",
                                r.status === "cancellata" && "line-through",
                              )}
                            >
                              {r.customerName}
                            </span>
                            <span className="block truncate text-[10.5px] text-soft">
                              {r.party} coperti · {STATUS_META[r.status].label}
                            </span>
                          </button>
                        ) : t.active ? (
                          <button
                            onClick={() =>
                              setModal({ mode: "new", date: selected, time, tableId: t.id })
                            }
                            aria-label={`Prenota T${t.number} alle ${time}`}
                            className="flex h-full w-full items-center justify-center rounded-lg opacity-0 transition group-hover:bg-linesoft group-hover:opacity-100"
                          >
                            <IconPlus size={16} className="text-faint" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {settings && modal && (
        <ReservationModal
          open
          onClose={() => setModal(null)}
          reservation={modal.mode === "edit" ? modal.reservation : null}
          prefill={
            modal.mode === "new"
              ? { date: modal.date, time: modal.time, tableId: modal.tableId }
              : null
          }
          tables={tables}
          settings={settings}
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
