"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDaysISO,
  buildWaUrl,
  capitalize,
  fillTemplate,
  formatLong,
  todayISO,
} from "@/lib/utils";
import type { Reservation, Settings, Source, Status, Table } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import {
  Button,
  Confirm,
  EmptyState,
  Input,
  IconButton,
  PageHeader,
  Skeleton,
  StatusPill,
} from "@/components/ui";
import {
  IconGlobe,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSearch,
  IconTable,
  IconTrash,
  IconUsers,
  IconWhatsApp,
} from "@/components/icons";
import { ReservationModal } from "@/components/reservation-modal";
import { useToast } from "@/components/toast";
import { cn, SOURCE_META, STATUS_META, STATUS_ORDER } from "@/lib/utils";

type StatusFilter = Status | "tutte";

const SOURCE_ICON: Record<Source, typeof IconPhone> = {
  telefono: IconPhone,
  web: IconGlobe,
  walk_in: IconUsers,
};

export default function ReservationsPage() {
  const toast = useToast();
  const today = todayISO();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(addDaysISO(today, -7));
  const [to, setTo] = useState(addDaysISO(today, 14));
  const [status, setStatus] = useState<StatusFilter>("tutte");
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [modal, setModal] = useState<{ reservation: Reservation | null } | null>(null);
  const [deleting, setDeleting] = useState<Reservation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const params = new URLSearchParams();
  if (from) params.set("dateFrom", from);
  if (to) params.set("dateTo", to);
  if (status !== "tutte") params.set("status", status);
  if (query) params.set("q", query);
  const requestQuery = params.toString();
  const loading = loadedQuery !== requestQuery;

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    Promise.all([
      api<{ tables: Table[] }>("/api/tables"),
      api<{ settings: Settings }>("/api/settings"),
    ])
      .then(([t, s]) => {
        setTables(t.tables);
        setSettings(s.settings);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    api<{ reservations: Reservation[] }>(`/api/reservations?${requestQuery}`)
      .then((r) => {
        if (!active) return;
        setRows(r.reservations);
        setLoadedQuery(requestQuery);
      })
      .catch(() => {
        if (active) setLoadedQuery(requestQuery);
      });
    return () => {
      active = false;
    };
  }, [requestQuery]);

  const hasFilters = status !== "tutte" || query !== "" || from !== "" || to !== "";

  function handleSaved(r: Reservation, isNew: boolean) {
    setRows((list) => {
      const next = list.filter((x) => x.id !== r.id);
      if (isNew || !list.some((x) => x.id === r.id)) next.push(r);
      return next.sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
      );
    });
  }

  function sendWhatsApp(r: Reservation) {
    if (!settings) return;
    const msg = fillTemplate(settings.waTemplate, {
      nome: r.customerName.split(" ")[0],
      ristorante: settings.restaurantName,
      data: formatLong(r.date),
      ora: r.time,
      tavolo: `Tavolo ${r.tableNumber}${r.tableZone ? ` · ${r.tableZone}` : ""}`,
      coperti: String(r.party),
    });
    window.open(buildWaUrl(r.phone, msg), "_blank", "noopener");
    toast("info", `WhatsApp aperto per ${r.customerName}`);
  }

  function confirmDelete() {
    if (!deleting) return;
    const r = deleting;
    const snapshot = rows;
    setRows((list) => list.filter((x) => x.id !== r.id));
    setDeleteBusy(true);
    api(`/api/reservations/${r.id}`, { method: "DELETE" })
      .then(() => toast("success", "Prenotazione eliminata"))
      .catch((e) => {
        setRows(snapshot);
        toast("error", errMsg(e));
      })
      .finally(() => {
        setDeleteBusy(false);
        setDeleting(null);
      });
  }

  const clearFilters = () => {
    setQ("");
    setQuery("");
    setStatus("tutte");
    setFrom(addDaysISO(today, -7));
    setTo(addDaysISO(today, 14));
  };

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
      ),
    [rows],
  );

  return (
    <>
      <PageHeader
        title="Prenotazioni"
        subtitle={
          loading
            ? "Caricamento…"
            : `${rows.length} prenotazioni nel periodo selezionato`
        }
        actions={
          <Button
            variant="accent"
            size="sm"
            onClick={() => setModal({ reservation: null })}
            disabled={!settings}
          >
            <IconPlus size={15} strokeWidth={2.4} />
            Nuova prenotazione
          </Button>
        }
      />

      {/* Filtri */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3 shadow-card">
        <div className="relative min-w-[180px] flex-1">
          <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            className="pl-9"
            placeholder="Cerca cliente o telefono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Input
          type="date"
          className="w-auto"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-xs font-semibold text-faint">→</span>
        <Input
          type="date"
          className="w-auto"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(["tutte", ...STATUS_ORDER] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors",
                status === s
                  ? "border-transparent bg-pine text-cream"
                  : "border-line bg-card text-soft hover:border-soft/40",
              )}
            >
              {s === "tutte" ? "Tutte" : STATUS_META[s].label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-[12px] font-bold text-terra hover:text-terradark"
          >
            Pulisci filtri
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-card shadow-card">
          <EmptyState
            icon={<IconSearch size={24} />}
            title="Nessun risultato"
            text="Nessuna prenotazione corrisponde ai filtri correnti. Prova ad allargare il periodo o crea una nuova prenotazione."
            action={
              <div className="flex gap-2">
                {hasFilters && (
                  <Button variant="ghost" onClick={clearFilters}>
                    Pulisci filtri
                  </Button>
                )}
                <Button
                  variant="accent"
                  onClick={() => setModal({ reservation: null })}
                  disabled={!settings}
                >
                  <IconPlus size={15} strokeWidth={2.4} />
                  Nuova prenotazione
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {/* Tabella desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-card md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-linesoft bg-paper/70 text-[10.5px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 font-bold">Data e ora</th>
                  <th className="px-3 py-3 font-bold">Cliente</th>
                  <th className="px-3 py-3 font-bold">Coperti</th>
                  <th className="px-3 py-3 font-bold">Tavolo</th>
                  <th className="hidden px-3 py-3 font-bold xl:table-cell">Fonte</th>
                  <th className="px-3 py-3 font-bold">Stato</th>
                  <th className="px-4 py-3 text-right font-bold">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linesoft">
                {sorted.map((r) => {
                  const SourceIcon = SOURCE_ICON[r.source];
                  return (
                    <tr key={r.id} className="group transition-colors hover:bg-paper/60">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-bold tabular-nums">{r.time}</span>
                        <span className="ml-2 text-soft capitalize">
                          {formatLong(r.date)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block font-semibold">{r.customerName}</span>
                        <span className="block text-[11.5px] text-faint">{r.phone}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums">{r.party}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-soft">
                        T{r.tableNumber}
                        <span className="ml-1 text-[11px] text-faint">· {r.tableZone}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 xl:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-soft">
                          <SourceIcon size={14} className="text-faint" />
                          {SOURCE_META[r.source].label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                          <IconButton
                            onClick={() => sendWhatsApp(r)}
                            title="Invia WhatsApp"
                            className="hover:bg-[#dcf8c6] hover:text-[#1f8f5f]"
                          >
                            <IconWhatsApp size={16} />
                          </IconButton>
                          <IconButton
                            onClick={() => setModal({ reservation: r })}
                            title="Modifica"
                          >
                            <IconPencil size={15} />
                          </IconButton>
                          <IconButton
                            onClick={() => setDeleting(r)}
                            title="Elimina"
                            className="hover:bg-badsoft hover:text-bad"
                          >
                            <IconTrash size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Card mobile */}
          <div className="space-y-2 md:hidden">
            {sorted.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-line bg-card p-3.5 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold">{r.customerName}</p>
                    <p className="text-[11.5px] text-faint">{r.phone}</p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-soft">
                  <span className="tabular-nums font-bold text-ink">{r.time}</span>
                  <span className="capitalize">{formatLong(r.date)}</span>
                  <span className="inline-flex items-center gap-1">
                    <IconTable size={13} className="text-faint" />
                    T{r.tableNumber} · {r.tableZone}
                  </span>
                  <span>{r.party} coperti</span>
                </div>
                {r.notes && (
                  <p className="mt-2 rounded-lg bg-paper px-2.5 py-1.5 text-[11.5px] italic text-soft">
                    {r.notes}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-linesoft pt-2.5">
                  <Button variant="whatsapp" size="sm" onClick={() => sendWhatsApp(r)}>
                    <IconWhatsApp size={14} />
                    WhatsApp
                  </Button>
                  <IconButton
                    onClick={() => setModal({ reservation: r })}
                    title="Modifica"
                  >
                    <IconPencil size={15} />
                  </IconButton>
                  <IconButton
                    onClick={() => setDeleting(r)}
                    title="Elimina"
                    className="hover:bg-badsoft hover:text-bad"
                  >
                    <IconTrash size={15} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {settings && modal && (
        <ReservationModal
          open
          onClose={() => setModal(null)}
          reservation={modal.reservation}
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
            ? `La prenotazione di ${deleting.customerName} (${capitalize(formatLong(deleting.date))} alle ${deleting.time}) verrà rimossa definitivamente.`
            : ""
        }
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
