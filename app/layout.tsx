import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
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
