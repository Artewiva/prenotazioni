import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const fraunces = localFont({
  src: "./fonts/fraunces-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-fraunces",
});

const manrope = localFont({
  src: "./fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Riserva — Gestione prenotazioni ristorante",
  description:
    "Strumento di prenotazione ristorante e dashboard per il team: calendario, tavoli e promemoria WhatsApp.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  try {
    const { ensureSeeded } = await import("@/lib/seed");
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
