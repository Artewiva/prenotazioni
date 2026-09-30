"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { Button, Input, Field } from "@/components/ui";
import { IconAlert, IconCheck, IconArrowRight } from "@/components/icons";

function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="12.5" stroke="#c2502b" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="7" stroke="#f2ecdd" strokeWidth="1.7" />
      <path
        d="M16 7v-3M16 28v-3M7 16H4M28 16h-3"
        stroke="#c2502b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const FEATURES = [
  "Calendario giorno per giorno, slot per slot",
  "Piano tavoli con stati in tempo reale",
  "Promemoria WhatsApp con un click",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@riserva.app");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Pannello brand */}
      <div className="relative hidden overflow-hidden bg-pine lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(194,80,43,0.35), transparent 62%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-56 -left-32 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 60% 60%, rgba(47,74,56,0.9), transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <LogoMark size={38} />
          <div>
            <p className="font-display text-2xl font-semibold leading-none text-cream">
              Riserva
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-creamdim">
              Gestione prenotazioni
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-[44px] font-semibold leading-[1.08] text-cream">
            Tutte le tue serate,
            <br />
            in ordine.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-cream/70">
            Calendario, tavoli e squadra coordinati in un unico posto. Riserva,
            conferma e ricorda i tuoi ospiti senza perdere mai un tavolo.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-cream/85">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-terra/90 text-white">
                  <IconCheck size={12} strokeWidth={2.6} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-creamdim">
          Ambiente demo · dati di esempio rigenerati al primo avvio
        </p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <p className="font-display text-xl font-semibold">Riserva</p>
          </div>

          <h2 className="font-display text-[26px] font-semibold tracking-tight">
            Accedi alla dashboard
          </h2>
          <p className="mt-1.5 text-sm text-soft">
            Area riservata al team di sala e alla direzione.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="nome@ristorante.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-bad/25 bg-badsoft px-3.5 py-2.5 text-[13px] font-medium text-bad">
                <IconAlert size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" variant="accent" loading={busy} className="w-full">
              Entra
              {!busy && <IconArrowRight size={16} />}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-line bg-card p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wide text-soft">
              Accesso demo
            </p>
            <div className="mt-2 space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-soft">Admin</span>
                <code className="rounded bg-linesoft px-1.5 py-0.5 font-mono text-[12px] text-ink">
                  admin@riserva.app · admin123
                </code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-soft">Hostess</span>
                <code className="rounded bg-linesoft px-1.5 py-0.5 font-mono text-[12px] text-ink">
                  hostess@riserva.app · hostess123
                </code>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 text-[12.5px] font-semibold text-terra hover:text-terradark"
              onClick={() => {
                setEmail("admin@riserva.app");
                setPassword("admin123");
                setError("");
              }}
            >
              Usa le credenziali demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
