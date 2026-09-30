"use client";

import { useEffect, useMemo, useState } from "react";
import { cn, todayISO } from "@/lib/utils";
import type { Table } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import {
  Button,
  Confirm,
  EmptyState,
  Field,
  Input,
  IconButton,
  Modal,
  PageHeader,
  SeatDots,
  Skeleton,
  Toggle,
} from "@/components/ui";
import { IconPencil, IconPlus, IconTable, IconTrash } from "@/components/icons";
import { useToast } from "@/components/toast";

interface TableRow extends Table {
  dayCount: number;
}

interface TableForm {
  number: string;
  zone: string;
  seats: string;
  notes: string;
  active: boolean;
}

const EMPTY_FORM: TableForm = { number: "", zone: "", seats: "2", notes: "", active: true };

export default function TablesPage() {
  const toast = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ table: TableRow | null } | null>(null);
  const [form, setForm] = useState<TableForm>(EMPTY_FORM);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<TableRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const today = todayISO();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ tables: TableRow[] }>(`/api/tables?date=${today}`);
      setTables(r.tables);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [today]);

  const zones = useMemo(() => {
    const order: string[] = [];
    tables.forEach((t) => {
      if (!order.includes(t.zone)) order.push(t.zone);
    });
    return order;
  }, [tables]);

  function openCreate() {
    const used = tables.map((t) => t.number);
    const next = used.length ? Math.max(...used) + 1 : 1;
    setForm({ ...EMPTY_FORM, number: String(next), zone: zones[0] ?? "Sala" });
    setFormErr({});
    setModal({ table: null });
  }

  function openEdit(t: TableRow) {
    setForm({
      number: String(t.number),
      zone: t.zone,
      seats: String(t.seats),
      notes: t.notes ?? "",
      active: t.active,
    });
    setFormErr({});
    setModal({ table: t });
  }

  function patchList(t: TableRow) {
    setTables((list) => {
      const exists = list.some((x) => x.id === t.id);
      const next = exists
        ? list.map((x) => (x.id === t.id ? { ...x, ...t } : x))
        : [...list, { ...t, dayCount: 0 }];
      return next.sort((a, b) => a.number - b.number);
    });
  }

  async function save() {
    const t = modal?.table;
    const payload = {
      number: Number(form.number),
      zone: form.zone.trim(),
      seats: Number(form.seats),
      notes: form.notes.trim() || null,
      active: form.active,
    };
    const errs: Record<string, string> = {};
    if (!Number.isInteger(payload.number) || payload.number < 1)
      errs.number = "Numero non valido";
    if (!payload.zone) errs.zone = "Indica la zona";
    if (!Number.isInteger(payload.seats) || payload.seats < 1 || payload.seats > 24)
      errs.seats = "1–24";
    setFormErr(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const r = t
        ? await api<{ table: TableRow }>(`/api/tables/${t.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await api<{ table: TableRow }>("/api/tables", { method: "POST", body: payload });
      toast(
        "success",
        t ? `Tavolo ${r.table.number} aggiornato` : `Tavolo ${r.table.number} creato`,
      );
      patchList({ ...r.table, dayCount: t ? (t.dayCount ?? 0) : 0 });
      setModal(null);
    } catch (err) {
      toast("error", errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleTable(t: TableRow) {
    const prev = t.active;
    patchList({ ...t, active: !prev });
    api<{ table: TableRow }>(`/api/tables/${t.id}`, {
      method: "PATCH",
      body: { active: !prev },
    })
      .then((r) => {
        patchList({ ...r.table, dayCount: t.dayCount ?? 0 });
        toast("success", `Tavolo ${t.number} ${r.table.active ? "attivato" : "disattivato"}`);
      })
      .catch((e) => {
        patchList({ ...t, active: prev });
        toast("error", errMsg(e));
      });
  }

  function confirmDelete() {
    if (!deleting) return;
    const t = deleting;
    const snapshot = tables;
    setTables((list) => list.filter((x) => x.id !== t.id));
    setDeleteBusy(true);
    api(`/api/tables/${t.id}`, { method: "DELETE" })
      .then(() => toast("success", `Tavolo ${t.number} eliminato`))
      .catch((e) => {
        setTables(snapshot);
        toast("error", errMsg(e));
      })
      .finally(() => {
        setDeleteBusy(false);
        setDeleting(null);
      });
  }

  return (
    <>
      <PageHeader
        title="Tavoli"
        subtitle={
          loading
            ? "Caricamento…"
            : `${tables.filter((t) => t.active).length} attivi su ${tables.length} totali`
        }
        actions={
          <Button variant="accent" size="sm" onClick={openCreate}>
            <IconPlus size={15} strokeWidth={2.4} />
            Nuovo tavolo
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-bad/25 bg-badsoft px-4 py-3 text-sm font-medium text-bad">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="rounded-xl border border-line bg-card shadow-card">
          <EmptyState
            icon={<IconTable size={24} />}
            title="Nessun tavolo configurato"
            text="Aggiungi il primo tavolo per iniziare a assegnare le prenotazioni."
            action={
              <Button variant="accent" onClick={openCreate}>
                <IconPlus size={15} strokeWidth={2.4} />
                Nuovo tavolo
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {zones.map((zone) => (
            <section key={zone}>
              <h2 className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-soft">
                {zone}
                <span className="rounded-full bg-linesoft px-2 py-0.5 text-[10.5px] tabular-nums">
                  {tables.filter((t) => t.zone === zone).length}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tables
                  .filter((t) => t.zone === zone)
                  .map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "group rounded-xl border border-line bg-card p-4 shadow-card transition hover:border-soft/30 animate-rise",
                        !t.active && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-display text-[26px] font-semibold leading-none">
                            T{t.number}
                          </span>
                          <span className="rounded-full bg-linesoft px-2 py-0.5 text-[10.5px] font-bold text-soft">
                            {t.zone}
                          </span>
                          {!t.active && (
                            <span className="rounded-full bg-badsoft px-2 py-0.5 text-[10.5px] font-bold text-bad">
                              Disattivato
                            </span>
                          )}
                        </div>
                        <Toggle
                          checked={t.active}
                          onChange={() => toggleTable(t)}
                          label={`Attiva tavolo ${t.number}`}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <SeatDots n={t.seats} />
                        <span className="text-[11.5px] font-semibold text-soft">
                          {t.seats} posti
                        </span>
                      </div>
                      <div className="mt-3">
                        {(t.dayCount ?? 0) > 0 ? (
                          <span className="inline-flex rounded-full bg-oksoft px-2.5 py-1 text-[11px] font-bold text-ok tabular-nums">
                            {t.dayCount} prenotazioni oggi
                          </span>
                        ) : t.active ? (
                          <span className="inline-flex rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-faint">
                            Nessuna prenotazione oggi
                          </span>
                        ) : null}
                      </div>
                      {t.notes && (
                        <p className="mt-2 truncate text-[11.5px] italic text-faint">
                          {t.notes}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-linesoft pt-2.5 opacity-70 transition group-hover:opacity-100">
                        <Button variant="subtle" size="sm" onClick={() => openEdit(t)}>
                          <IconPencil size={13} />
                          Modifica
                        </Button>
                        <IconButton
                          onClick={() => setDeleting(t)}
                          title="Elimina tavolo"
                          className="hover:bg-badsoft hover:text-bad"
                        >
                          <IconTrash size={15} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Modale creazione/modifica */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.table ? `Modifica tavolo ${modal.table.number}` : "Nuovo tavolo"}
        subtitle="Zona, posti e note operative"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Annulla
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              {modal?.table ? "Salva modifiche" : "Crea tavolo"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numero" error={formErr.number}>
            <Input
              type="number"
              min={1}
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            />
          </Field>
          <Field label="Zona" error={formErr.zone}>
            <Input
              list="zone-options"
              placeholder="Sala, Terrazza, Cantina…"
              value={form.zone}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
            />
            <datalist id="zone-options">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </Field>
          <Field label="Posti" error={formErr.seats}>
            <Input
              type="number"
              min={1}
              max={24}
              value={form.seats}
              onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
            />
          </Field>
          <Field label="Note (opzionale)">
            <Input
              placeholder="Es. accanto alla finestra"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-line bg-paper/60 px-3.5 py-3 sm:col-span-2">
            <div>
              <p className="text-[13px] font-bold">Tavolo attivo</p>
              <p className="text-[11.5px] text-soft">
                I tavoli disattivati non sono assegnabili alle prenotazioni.
              </p>
            </div>
            <Toggle
              checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))}
              label="Tavolo attivo"
            />
          </div>
        </div>
      </Modal>

      <Confirm
        open={!!deleting}
        title="Eliminare il tavolo?"
        text={
          deleting
            ? `Il tavolo ${deleting.number} (${deleting.zone}) verrà rimosso dal piano. L'operazione sarà bloccata se il tavolo ha ancora prenotazioni collegate.`
            : ""
        }
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
