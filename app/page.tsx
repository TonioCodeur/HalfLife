import type { Metadata, Viewport } from "next";

import { HalflifeApp } from "./halflife-app";

/* ── SEO ──────────────────────────────────────────────────────────────────
 * Ce fichier est un *server component* (pas de "use client") afin que les
 * exports `metadata` / `viewport` soient honorés par Next.js. Toute la
 * logique interactive vit dans `./halflife-app.tsx` (client component).
 *
 * Pour la mise en production, remplacez SITE_URL par l'URL canonique
 * réelle (les balises <link rel="canonical">, og:url et le JSON-LD en
 * dépendent).
 * ─────────────────────────────────────────────────────────────────────── */

const SITE_URL = "https://halflife.local";
const SITE_NAME = "Halflife";
const TITLE = "Halflife — Calculateur de demi-vie pharmacocinétique en temps réel";
const DESCRIPTION =
  "Calculez la concentration sanguine restante d'un médicament ou d'une molécule à partir de sa demi-vie. Doses multiples cumulées, calculs exacts BigNumber, notifications navigateur à chaque demi-vie écoulée, données persistées localement. Interface responsive mobile, tablette et desktop.";

const KEYWORDS = [
  "demi-vie",
  "calculateur demi-vie",
  "calculateur élimination médicament",
  "demi-vie médicament",
  "pharmacocinétique",
  "concentration sanguine",
  "demi-vie biologique",
  "calcul dose médicament",
  "cinétique d'élimination",
  "élimination molécule sang",
  "halflife calculator",
  "drug half-life calculator",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  generator: "Next.js",
  keywords: KEYWORDS,
  category: "health",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/",
    },
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1a0a2e" },
    { media: "(prefers-color-scheme: light)", color: "#1a0a2e" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/* ── JSON-LD : WebApplication ─────────────────────────────────────────────
 * Aide Google Rich Results / Bing / moteurs à comprendre que la page est
 * une application web gratuite dans la catégorie santé/pharmacocinétique.
 * ─────────────────────────────────────────────────────────────────────── */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: TITLE,
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Pharmacokinetics calculator",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  inLanguage: "fr-FR",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  featureList: [
    "Calcul exact de la décroissance via mathjs BigNumber (50 chiffres significatifs)",
    "Suivi en temps réel de la concentration sanguine d'une molécule",
    "Doses multiples cumulées — pharmacocinétique d'accumulation",
    "Notifications navigateur à chaque demi-vie franchie",
    "Notification distincte à l'élimination complète",
    "Persistance locale des mesures via localStorage",
    "Réordonnancement par drag-and-drop (clavier compatible)",
    "Interface responsive mobile, tablette et desktop",
    "Historique des molécules saisies avec suggestions",
  ],
};

export default function Page() {
  return (
    <>
      {/* Données structurées Schema.org injectées en head/body (Next
          sérialise et déduplique). Dangerously-set-inner-html est
          nécessaire : JSON-LD doit être du JSON brut, pas du JSX. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HalflifeApp />
    </>
  );
}
