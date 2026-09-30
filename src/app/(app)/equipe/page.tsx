"use client";

import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";
import type { Role, User } from "@/lib/types";
import { api, errMsg } from "@/lib/client";
import {
  Button,
  Confirm,
  EmptyState,
  Field,
  Input,
  IconButton,
  PageHeader,
  Select,
  Skeleton,
  Toggle,
} from "@/components/ui";
import { IconPlus, IconTrash, IconUsers } from "@/components/icons";
import { useToast } from "@/components/toast";

export default function TeamPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [meRole, setMeRole] = useState<Role>("manager");

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager" as Role });
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ users: User[]; me: number }>("/api/users")
      .then((r) => {
        if (!active) return;
        setUsers(r.users);
        setMeId(r.me);
        return api<{ user: { role: Role } }>("/api/auth/me");
      })
      .then((me) => {
        if (active && me) setMeRole(me.user.role);
      })
      .catch(() => {
        /* ignora */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = meRole === "admin";

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Nome non valido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Email non valida";
    if (form.password.length < 6) errs.password = "Minimo 6 caratteri";
    setFormErr(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const r = await api<{ user: User }>("/api/users", {
        method: "POST",
        body: form,
      });
      setUsers((list) => [...list, r.user]);
      setForm({ name: "", email: "", password: "", role: "manager" });
      setAdding(false);
      toast("success", `Utente ${r.user.name} aggiunto al team`);
    } catch (err) {
      const msg = errMsg(err);
      if (msg.toLowerCase().includes("email")) setFormErr({ email: msg });
      else toast("error", msg);
    } finally {
      setBusy(false);
    }
  }

  function patchUser(u: User) {
    setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));
  }

  function toggleActive(u: User) {
    if (u.id === meId) return;
    const prev = u.active;
    patchUser({ ...u, active: !prev });
    api<{ user: User }>(`/api/users/${u.id}`, { method: "PATCH", body: { active: !prev } })
      .then((r) => {
        patchUser(r.user);
        toast("success", `${u.name} ${r.user.active ? "attivato" : "disattivato"}`);
      })
      .catch((e) => {
        patchUser({ ...u, active: prev });
        toast("error", errMsg(e));
      });
  }

  function changeRole(u: User, role: Role) {
    if (u.id === meId) return;
    const prev = u.role;
    patchUser({ ...u, role });
    api<{ user: User }>(`/api/users/${u.id}`, { method: "PATCH", body: { role } })
      .then((r) => patchUser(r.user))
      .catch((e) => {
        patchUser({ ...u, role: prev });
        toast("error", errMsg(e));
      });
  }

  function confirmDelete() {
    if (!deleting) return;
    const u = deleting;
    const snapshot = users;
    setUsers((list) => list.filter((x) => x.id !== u.id));
    setDeleteBusy(true);
    api(`/api/users/${u.id}`, { method: "DELETE" })
      .then(() => toast("success", `Utente ${u.name} eliminato`))
      .catch((e) => {
        setUsers(snapshot);
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
        title="Equipaggio"
        subtitle="Le persone che accedono alla dashboard"
        actions={
          isAdmin && (
            <Button variant="accent" size="sm" onClick={() => setAdding((v) => !v)}>
              <IconPlus size={15} strokeWidth={2.4} />
              Nuovo membro
            </Button>
          )
        }
      />

      {!isAdmin && (
        <div className="mb-4 rounded-xl border border-line bg-card px-4 py-3 text-[12.5px] text-soft shadow-card">
          Hai il ruolo <strong className="text-ink">Manager</strong>: puoi consultare
          l&apos;equipaggio, ma solo un amministratore può modificarlo.
        </div>
      )}

      {isAdmin && adding && (
        <form
          onSubmit={addUser}
          className="mb-4 rounded-xl border border-terra/25 bg-card p-4 shadow-card animate-rise"
        >
          <h2 className="mb-3 font-display text-[16px] font-semibold">Nuovo membro del team</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome e cognome" error={formErr.name}>
              <Input
                placeholder="Es. Marco Bindi"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Email" error={formErr.email}>
              <Input
                type="email"
                placeholder="nome@ristorante.it"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Password" error={formErr.password} hint="Minimo 6 caratteri">
              <Input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </Field>
            <Field label="Ruolo">
              <Select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="accent" loading={busy}>
              Aggiungi
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-18 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-line bg-card shadow-card">
          <EmptyState
            icon={<IconUsers size={24} />}
            title="Nessun membro nel team"
            text="Aggiungi la prima persona con accesso alla dashboard."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
          <ul className="divide-y divide-linesoft">
            {users.map((u) => {
              const isSelf = u.id === meId;
              return (
                <li
                  key={u.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-3.5",
                    !u.active && "opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-semibold",
                      isSelf ? "bg-terra text-white" : "bg-pine text-cream",
                    )}
                  >
                    {initials(u.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13.5px] font-bold">
                      <span className="truncate">{u.name}</span>
                      {isSelf && (
                        <span className="rounded-full bg-terrasoft px-2 py-0.5 text-[10px] font-bold text-terradark">
                          Tu
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[12px] text-soft">{u.email}</p>
                  </div>
                  {isAdmin && !isSelf ? (
                    <Select
                      className="w-auto py-1.5 text-[12px]"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                    >
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </Select>
                  ) : (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold",
                        u.role === "admin" ? "bg-terrasoft text-terradark" : "bg-linesoft text-soft",
                      )}
                    >
                      {u.role === "admin" ? "Admin" : "Manager"}
                    </span>
                  )}
                  <div className="flex items-center gap-2.5">
                    <Toggle
                      checked={u.active}
                      onChange={() => toggleActive(u)}
                      label={`Attiva ${u.name}`}
                    />
                    {isAdmin && !isSelf && (
                      <IconButton
                        onClick={() => setDeleting(u)}
                        title="Elimina utente"
                        className="hover:bg-badsoft hover:text-bad"
                      >
                        <IconTrash size={15} />
                      </IconButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Confirm
        open={!!deleting}
        title="Eliminare l'utente?"
        text={
          deleting
            ? `${deleting.name} (${deleting.email}) perderà subito l'accesso alla dashboard.`
            : ""
        }
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
