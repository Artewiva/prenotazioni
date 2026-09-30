import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <ToastProvider>
      <AppShell
        user={{ id: user.id, name: user.name, email: user.email, role: user.role }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
