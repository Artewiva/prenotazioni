"use client";

import { useEffect, useState } from "react";
import { fillTemplate } from "@/lib/utils";
import type { Role, Settings } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { IconClock, IconInfo, IconSliders, IconWhatsApp } from "@/components/icons";
import { useToast } from "@/components/toast";

const PLACEHOLDERS = ["{nome}", "{ristorante}", "{data}", "{ora}", "{tavolo}", "{coperti}"];

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({
    restaurantName: "",
    phone: "",
    whatsappNumber: "",
    openingHour: "17:30",
    closingHour: "23:30",
    slotMinutes: "30",
    waTemplate: "",
  });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ settings: Settings }>("/api/settings"),
      api<{ user: { role: Role } }>("/api/auth/me"),
    ])
      .then(([s, me]) => {
        setSettings(s.settings);
        setRole(me.user.role);
        setForm({
          restaurantName: s.settings.restaurantName,
          phone: s.settings.phone,
          whatsappNumber: s.settings.whatsappNumber,
          openingHour: s.settings.openingHour,
          closingHour: s.settings.closingHour,
          slotMinutes: String(s.settings.slotMinutes),
          waTemplate: s.settings.waTemplate,
        });
      })
      .catch((e) => setLoadError(errMsg(e)));
  }, []);

  const readOnly = role !== "admin";

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await api<{ settings: Settings }>("/api/settings", {
        method: "PUT",
        body: {
          ...form,
          slotMinutes: Number(form.slotMinutes),
        },
      });
      setSettings(r.settings);
      toast("success", "Impostazioni salvate");
    } catch (e) {
      toast("error", errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Impostazioni" />
        <div className="rounded-xl border border-bad/25 bg-badsoft p-6 text-center text-sm font-semibold text-bad">
          {loadError}
        </div>
      </>
    );
  }

  if (!settings) {
    return (
      <>
        <PageHeader title="Impostazioni" />
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </>
    );
  }

  const preview = fillTemplate(form.waTemplate || settings.waTemplate, {
    nome: "Giulia",
    ristorante: form.restaurantName || settings.restaurantName,
    data: "giovedì 12 giugno",
    ora: "20:00",
    tavolo: "Tavolo 4 · Sala",
    coperti: "2",
  });

  return (
    <>
      <PageHeader
        title="Impostazioni"
        subtitle="Configurazione del ristorante, dell'orario e dei promemoria"
        actions={
          !readOnly && (
            <Button variant="accent" size="sm" onClick={save} loading={saving}>
              Salva impostazioni
            </Button>
          )
        }
      />

      {readOnly && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3 text-[12.5px] text-soft shadow-card">
          <IconInfo size={16} className="mt-0.5 shrink-0 text-faint" />
          Hai il ruolo Manager: le impostazioni sono in sola lettura. Solo un
          amministratore può modificarle.
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Ristorante */}
        <div className="rounded-xl border border-line bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-terrasoft text-terradark">
              <IconSliders size={16} />
            </span>
            <h2 className="font-display text-[16px] font-semibold">Ristorante</h2>
          </div>
          <div className="space-y-4">
            <Field label="Nome del ristorante">
              <Input
                value={form.restaurantName}
                disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefono fisso">
                <Input
                  value={form.phone}
                  disabled={readOnly}
                  placeholder="055 1234567"
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
              <Field
                label="Numero WhatsApp"
                hint="Formato internazionale senza + (es. 39...)"
              >
                <Input
                  value={form.whatsappNumber}
                  disabled={readOnly}
                  placeholder="393401234567"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsappNumber: e.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Orario */}
        <div className="rounded-xl border border-line bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-oksoft text-ok">
              <IconClock size={16} />
            </span>
            <h2 className="font-display text-[16px] font-semibold">Orario di servizio</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Apertura">
              <Input
                type="time"
                value={form.openingHour}
                disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, openingHour: e.target.value }))}
              />
            </Field>
            <Field label="Chiusura">
              <Input
                type="time"
                value={form.closingHour}
                disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, closingHour: e.target.value }))}
              />
            </Field>
            <Field label="Durata slot">
              <Select
                value={form.slotMinutes}
                disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, slotMinutes: e.target.value }))}
              >
                <option value="15">15 minuti</option>
                <option value="30">30 minuti</option>
                <option value="45">45 minuti</option>
                <option value="60">60 minuti</option>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            Le finestre di orario usate nel calendario e nel modulo di prenotazione
            vengono generate da questi valori.
          </p>
        </div>

        {/* WhatsApp */}
        <div className="rounded-xl border border-line bg-card p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#dcf8c6] text-[#1f8f5f]">
              <IconWhatsApp size={16} />
            </span>
            <h2 className="font-display text-[16px] font-semibold">
              Template del promemoria WhatsApp
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <Textarea
                className="min-h-[120px]"
                value={form.waTemplate}
                disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, waTemplate: e.target.value }))}
              />
              <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-soft">
                Variabili disponibili
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        waTemplate: f.waTemplate + " " + p,
                      }))
                    }
                    className="rounded-md bg-linesoft px-2 py-1 font-mono text-[11px] font-semibold text-soft transition hover:bg-terrasoft hover:text-terradark disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-soft">
                Anteprima
              </p>
              <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] p-3.5 shadow-sm">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">
                  {preview}
                </p>
                <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] font-medium text-black/40">
                  <span>20:45</span>
                  <IconWhatsApp size={12} />
                </div>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                Il messaggio si apre pronto nella chat WhatsApp del cliente: basta
                premere invio. Il numero del destinatario è quello salvato nella
                prenotazione.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={save} loading={saving}>
            Salva impostazioni
          </Button>
        </div>
      )}
    </>
  );
}
