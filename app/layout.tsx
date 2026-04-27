import type { Metadata } from "next";
import {
  Inter_Tight,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Halflife — Calculateur de demi-vie",
  description:
    "Estimez la quantité restante d'un médicament ou d'une molécule à partir de sa demi-vie. Interface accessible en thème violet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      // data-theme est piloté côté client → on supprime le warning d'hydratation
      suppressHydrationWarning
      className={`${interTight.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        {/* Art ASCII (décoratif, expression JS → pas de règle
            react/no-unescaped-entities qui s'applique). */}
        <pre
          aria-hidden="true"
          className="mx-auto w-fit overflow-x-auto whitespace-pre text-center font-mono text-[0.5rem] leading-tight text-[var(--neon-pink)]/45 [text-shadow:0_0_4px_color-mix(in_oklch,var(--neon-pink),transparent_75%)] sm:text-[0.6rem]"
        >
        <div className="text-left font-bold text-[var(--neon-pink)]/75 [text-shadow:0_0_6px_color-mix(in_oklch,var(--neon-pink),transparent_75%)]">
        {` _____           _       _____           _
|_   _|         (_)     /  __ \\         | |
  | | ___  _ __  _  ___ | /  \\/ ___   __| | ___
  | |/ _ \\| '_ \\| |/ _ \\| |    / _ \\ / _\` |/ _ \\
  | | (_) | | | | | (_) | \\__/\\ (_) | (_| |  __/
  \\_/\\___/|_| |_|_|\\___/ \\____/\\___/ \\__,_|\\___|`}
        </div>
        </pre>
      </body>
    </html>
  );
}
