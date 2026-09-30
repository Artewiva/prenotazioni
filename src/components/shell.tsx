"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, formatLong, initials, todayISO } from "@/lib/utils";
import type { Settings, Table } from "@/lib/types";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";
import {
  IconCalendar,
  IconDashboard,
  IconList,
  IconLogout,
  IconMenu,
  IconPlus,
  IconSliders,
  IconTable,
  IconUsers,
  IconX,
} from "./icons";
import { Button, IconButton } from "./ui";
import { ReservationModal } from "./reservation-modal";
import { useToast } from "./toast";

function LogoMark({ size = 32 }: { size?: number }) {
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

const NAV = [
  { href: "/", label: "Panoramica", icon: IconDashboard },
  { href: "/calendario", label: "Calendario", icon: IconCalendar },
  { href: "/prenotazioni", label: "Prenotazioni", icon: IconList },
  { href: "/tavoli", label: "Tavoli", icon: IconTable },
  { href: "/equipe", label: "Equipaggio", icon: IconUsers },
  { href: "/impostazioni", label: "Impostazioni", icon: IconSliders },
];

function SidebarInner({
  user,
  onNavigate,
}: {
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* il redirect avviene comunque */
    }
    toast("info", "Sei uscito dall'applicazione");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-pine text-cream">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 pb-6 pt-6"
      >
        <LogoMark size={34} />
        <span>
          <span className="block font-display text-[19px] font-semibold leading-none">
            Riserva
          </span>
          <span className="mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.22em] text-creamdim">
            Gestione prenotazioni
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                active
                  ? "bg-pine3 text-cream"
                  : "text-cream/65 hover:bg-pine2 hover:text-cream",
              )}
            >
              {active && (
                <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-terra" />
              )}
              <Icon
                size={18}
                className={cn(
                  active ? "text-terra" : "text-creamdim group-hover:text-cream/80",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-pine2 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine3 font-display text-[13px] font-semibold text-cream">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">
              {user.name}
            </span>
            <span className="block text-[11px] capitalize text-creamdim">
              {user.role === "admin" ? "Amministratore" : "Manager"}
            </span>
          </span>
          <IconButton
            onClick={logout}
            disabled={loggingOut}
            className="text-creamdim hover:bg-pine2 hover:text-cream"
            aria-label="Esci"
            title="Esci"
          >
            <IconLogout size={17} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    tables: Table[];
    settings: Settings;
  } | null>(null);

  async function openNew() {
    setNewOpen(true);
    if (!modalData) {
      try {
        const [t, s] = await Promise.all([
          api<{ tables: Table[] }>("/api/tables"),
          api<{ settings: Settings }>("/api/settings"),
        ]);
        setModalData({ tables: t.tables, settings: s.settings });
      } catch {
        setNewOpen(false);
      }
    }
  }

  return (
    <div className="min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarInner user={user} />
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-pine/60 backdrop-blur-[2px] animate-fadein"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] shadow-pop animate-rise">
            <SidebarInner user={user} onNavigate={() => setDrawer(false)} />
            <button
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-5 text-creamdim hover:text-cream"
              aria-label="Chiudi menu"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setDrawer(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-soft hover:bg-linesoft lg:hidden"
              aria-label="Apri menu"
            >
              <IconMenu size={20} />
            </button>
            <p className="hidden text-[13px] font-medium capitalize text-soft sm:block">
              {formatLong(todayISO())}
            </p>
            <div className="flex-1" />
            <Button variant="accent" size="sm" onClick={openNew}>
              <IconPlus size={15} strokeWidth={2.4} />
              Nuova prenotazione
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-7">
          {children}
        </main>
      </div>

      {newOpen && modalData && (
        <ReservationModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          tables={modalData.tables}
          settings={modalData.settings}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
