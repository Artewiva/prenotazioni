"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildWaUrl,
  cn,
  fillTemplate,
  formatLong,
  slotsFor,
  STATUS_META,
  STATUS_ORDER,
  timeToMin,
  todayISO,
} from "@/lib/utils";
import type { Reservation, Settings, Source, Status, Table } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { IconTrash, IconWhatsApp } from "./icons";
import { useToast } from "./toast";

interface FormState {
  customerName: string;
  phone: string;
  email: string;
  party: string;
  tableId: string;
  date: string;
  time: string;
  status: Status;
  source: Source;
  notes: string;
}

export function ReservationModal({
  open,
  onClose,
  reservation,
  prefill,
  tables,
  settings,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  reservation?: Reservation | null;
  prefill?: { date?: string; time?: string; tableId?: number } | null;
  tables: Table[];
  settings: Settings;
  onSaved: (r: Reservation, isNew: boolean) => void;
  onDelete?: (r: Reservation) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    customerName: "",
    phone: "",
    email: "",
    party: "2",
    tableId: "",
    date: todayISO(),
    time: settings.openingHour,
    status: "in_attesa",
    source: "telefono",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const activeTables = tables.filter((t) => t.active);
  const slots = useMemo(() => {
    const s = slotsFor(settings.openingHour, settings.closingHour, settings.slotMinutes);
    if (reservation && !s.includes(reservation.time)) {
      return [...s, reservation.time].sort((a, b) => timeToMin(a) - timeToMin(b));
    }
    return s;
  }, [settings, reservation]);

  useEffect(() => {
    if (!open) return;
    const tableId = reservation
      ? reservation.tableId
      : prefill?.tableId ?? activeTables[0]?.id ?? tables[0]?.id ?? 0;
    const date = reservation?.date ?? prefill?.date ?? todayISO();
    let time = reservation?.time ?? prefill?.time;
    if (!time) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const isToday = date === todayISO();
      time =
        slots.find((s) => !isToday || timeToMin(s) >= nowMin) ?? slots[0] ?? "20:00";
    }
    setForm({
      customerName: reservation?.customerName ?? "",
      phone: reservation?.phone ?? "",
      email: reservation?.email ?? "",
      party: String(reservation?.party ?? 2),
      tableId: String(tableId),
      date,
      time,
      status: reservation?.status ?? "in_attesa",
      source: reservation?.source ?? "telefono",
      notes: reservation?.notes ?? "",
    });
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id]);

  const selectedTable = tables.find((t) => t.id === Number(form.tableId));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  /** Cambio di stato ottimistico: aggiorna subito UI e invia in background. */
  function applyStatus(status: Status) {
    if (!reservation) return;
    if (status === reservation.status) return;
    const previous = reservation.status;
    setForm((f) => ({ ...f, status }));
    onSaved({ ...reservation, status }, false);
    api<{ reservation: Reservation }>(`/api/reservations/${reservation.id}`, {
      method: "PATCH",
      body: { status },
    }).then((res) => {
        toast("success", `Stato aggiornato: ${STATUS_META[status].label}`);
        onSaved(res.reservation, false);
      })
      .catch((e) => {
        setForm((f) => ({ ...f, status: previous }));
        onSaved({ ...reservation, status: previous }, false);
        toast("error", `Riportato a ${STATUS_META[previous].label}. ${errMsg(e)}`);
      });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (form.customerName.trim().length < 2) e.customerName = "Inserisci il nome";
    if (form.phone.replace(/[^\d]/g, "").length < 6) e.phone = "Telefono non valido";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Email non valida";
    const party = Number(form.party);
    if (!Number.isInteger(party) || party < 1 || party > 30) e.party = "Coperti 1–30";
    if (!form.tableId) e.tableId = "Scegli un tavolo";
    if (!form.date) e.date = "Scegli la data";
    if (!form.time) e.time = "Scegli l'orario";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      party: Number(form.party),
      tableId: Number(form.tableId),
      date: form.date,
      time: form.time,
      status: form.status,
      source: form.source,
      notes: form.notes.trim() || null,
    };
    try {
      const res = reservation
        ? await api<{ reservation: Reservation }>(`/api/reservations/${reservation.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await api<{ reservation: Reservation }>("/api/reservations", {
            method: "POST",
            body: payload,
          });
      toast("success", reservation ? "Prenotazione aggiornata" : "Prenotazione creata");
      onSaved(res.reservation, !reservation);
      onClose();
    } catch (err) {
      toast("error", errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  function sendWhatsApp() {
    if (!reservation) return;
    const msg = fillTemplate(settings.waTemplate, {
      nome: reservation.customerName.split(" ")[0],
      ristorante: settings.restaurantName,
      data: formatLong(reservation.date),
      ora: reservation.time,
      tavolo: `Tavolo ${reservation.tableNumber}${
        reservation.tableZone ? ` · ${reservation.tableZone}` : ""
      }`,
      coperti: String(reservation.party),
    });
    window.open(buildWaUrl(reservation.phone, msg), "_blank", "noopener");
    toast("info", "WhatsApp aperto con il messaggio pronto all'invio");
  }

  const partyWarn =
    selectedTable && Number(form.party) > selectedTable.seats
      ? `Attenzione: il tavolo ${selectedTable.number} ha solo ${selectedTable.seats} posti`
      : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={reservation ? "Modifica prenotazione" : "Nuova prenotazione"}
      subtitle={
        reservation
          ? `${reservation.customerName} · ${formatLong(reservation.date)} alle ${reservation.time}`
          : "Compila i dati dell'ospite e assegna il tavolo"
      }
      footer={
        <>
          {reservation && onDelete && (
            <Button
              variant="ghost"
              className="mr-auto text-bad hover:bg-badsoft"
              onClick={() => {
                onClose();
                onDelete(reservation);
              }}
            >
              <IconTrash size={15} />
              Elimina
            </Button>
          )}
          {reservation && (
            <Button variant="whatsapp" onClick={sendWhatsApp}>
              <IconWhatsApp size={16} />
              Invia WhatsApp
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" form="res-form" variant="accent" loading={saving}>
            {reservation ? "Salva modifiche" : "Crea prenotazione"}
          </Button>
        </>
      }
    >
      <form id="res-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Cliente"
          error={errors.customerName}
          className="sm:col-span-2"
        >
          <Input
            placeholder="Nome e cognome"
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Telefono" error={errors.phone} hint="Servito per il promemoria WhatsApp">
          <Input
            placeholder="333 1234567"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>

        <Field label="Email (opzionale)" error={errors.email}>
          <Input
            type="email"
            placeholder="ospite@email.it"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <Field label="Data" error={errors.date}>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>

        <Field label="Orario" error={errors.time}>
          <Select value={form.time} onChange={(e) => set("time", e.target.value)}>
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Coperti" error={errors.party} hint={partyWarn}>
          <Input
            type="number"
            min={1}
            max={30}
            value={form.party}
            onChange={(e) => set("party", e.target.value)}
          />
        </Field>

        <Field label="Tavolo" error={errors.tableId}>
          <Select
            value={form.tableId}
            onChange={(e) => set("tableId", e.target.value)}
          >
            <option value="" disabled>
              Seleziona…
            </option>
            {tables.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.active}>
                Tavolo {t.number} · {t.zone} · {t.seats} posti
                {!t.active ? " (disattivato)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Stato">
          {reservation ? (
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => applyStatus(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-1.5 text-[11.5px] font-bold transition-all",
                    form.status === s
                      ? cn(STATUS_META[s].pill, "border-transparent shadow-sm")
                      : "border-line bg-card text-faint hover:text-soft hover:border-soft/40",
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          ) : (
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as Status)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Fonte">
          <Select
            value={form.source}
            onChange={(e) => set("source", e.target.value as Source)}
          >
            <option value="telefono">Telefono</option>
            <option value="web">Web</option>
            <option value="walk_in">Di persona</option>
          </Select>
        </Field>

        <Field label="Note" className="sm:col-span-2" hint="Allergie, ricorrenze, preferenze del tavolo…">
          <Textarea
            placeholder="Es. Allergia al glutine, tavolo vicino alla finestra"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
