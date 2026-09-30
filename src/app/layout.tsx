import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ensureSeeded } from "@/lib/seed";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Riserva — Gestione prenotazioni ristorante",
  description:
    "Strumento di prenotazione ristorante e dashboard per il team: calendario, tavoli e promemoria WhatsApp.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  try {
    await ensureSeeded();
  } catch {
    // Il seed non deve mai bloccare il render: i dati compariranno al prossimo avvio.
  }
  return (
    <html lang="it">
      <body className={`${fraunces.variable} ${manrope.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
