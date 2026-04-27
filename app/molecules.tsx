/**
 * Bibliothèque SVG des molécules courantes — formules squelettiques
 * stylisées (cyberpunk, monochromes via `currentColor`).
 *
 * Convention :
 *  - viewBox 80×80
 *  - les liaisons utilisent `currentColor` → héritent de l'accent du thème
 *  - les hétéroatomes (N, O) ont une étiquette colorée + halo de fond
 */

import * as React from "react";

const ATOM_COLOR: Record<string, string> = {
  N: "var(--cyan)",
  O: "var(--pink)",
};

function S({ d, sw = 1.6 }: { d: string; sw?: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Atom({ x, y, label }: { x: number; y: number; label: string }) {
  const fill = ATOM_COLOR[label] ?? "currentColor";
  return (
    <g>
      <circle cx={x} cy={y} r={6} fill="var(--bg-deep, #000)" />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={9}
        fontWeight={700}
        fill={fill}
      >
        {label}
      </text>
    </g>
  );
}

function Caffeine() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M22 28 L36 20 L50 28 L50 44 L36 52 L22 44 Z" />
      <S d="M50 28 L66 26 L70 40 L62 46 L50 44" />
      <S d="M24 30 L34 24" />
      <S d="M52 30 L52 42" />
      <S d="M36 20 L36 12" />
      <S d="M22 44 L14 50" />
      <S d="M62 46 L66 56" />
      <Atom x={36} y={20} label="N" />
      <Atom x={22} y={44} label="N" />
      <Atom x={50} y={44} label="N" />
      <Atom x={50} y={28} label="O" />
      <Atom x={70} y={40} label="N" />
    </svg>
  );
}

function Paracetamol() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M16 40 L26 26 L42 26 L52 40 L42 54 L26 54 Z" />
      <S d="M18 40 L26 28" />
      <S d="M40 28 L50 40" />
      <S d="M16 40 L8 40" />
      <S d="M52 40 L62 30 L72 36" />
      <S d="M62 30 L62 22" />
      <Atom x={8} y={40} label="O" />
      <Atom x={62} y={30} label="N" />
      <Atom x={72} y={36} label="O" />
    </svg>
  );
}

function Ibuprofen() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M22 40 L32 26 L48 26 L58 40 L48 54 L32 54 Z" />
      <S d="M24 40 L32 28" />
      <S d="M46 28 L56 40" />
      <S d="M22 40 L14 36 L8 42" />
      <S d="M14 36 L14 28" />
      <S d="M58 40 L66 36 L70 44" />
      <S d="M66 36 L72 30" />
      <Atom x={70} y={44} label="O" />
      <Atom x={72} y={30} label="O" />
    </svg>
  );
}

function Nicotine() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M10 40 L20 26 L36 26 L46 40 L36 54 L20 54 Z" />
      <S d="M12 40 L20 28" />
      <S d="M34 28 L44 40" />
      <S d="M46 40 L60 32 L72 40 L66 54 L52 52 Z" />
      <Atom x={36} y={26} label="N" />
      <Atom x={60} y={32} label="N" />
      <S d="M60 32 L62 22" />
    </svg>
  );
}

function Aspirin() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M18 40 L28 26 L44 26 L54 40 L44 54 L28 54 Z" />
      <S d="M20 40 L28 28" />
      <S d="M42 28 L52 40" />
      <S d="M44 26 L52 18" />
      <S d="M52 18 L62 22" />
      <S d="M52 18 L52 8" />
      <S d="M28 54 L24 64" />
      <S d="M24 64 L14 66" />
      <Atom x={52} y={18} label="O" />
      <Atom x={62} y={22} label="O" />
      <Atom x={14} y={66} label="O" />
    </svg>
  );
}

function Ethanol() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M14 50 L30 38 L46 50 L62 38" />
      <Atom x={62} y={38} label="O" />
      <S d="M62 38 L70 32" />
    </svg>
  );
}

function Buprenorphine() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M14 44 L24 32 L38 32 L46 44 L38 56 L24 56 Z" />
      <S d="M16 44 L24 34" />
      <S d="M38 56 L52 60 L62 50 L58 38 L46 44" />
      <S d="M62 50 L72 46" />
      <S d="M52 60 L52 70" />
      <S d="M14 44 L8 50" />
      <Atom x={8} y={50} label="O" />
      <Atom x={52} y={70} label="N" />
    </svg>
  );
}

function Oxazepam() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M10 36 L20 24 L36 24 L46 36 L36 48 L20 48 Z" />
      <S d="M46 36 L58 30 L68 38 L66 50 L54 56 L44 50 L36 48" />
      <S d="M12 36 L20 26" />
      <S d="M34 26 L44 36" />
      <S d="M58 30 L60 20" />
      <S d="M68 38 L76 36" />
      <Atom x={36} y={24} label="N" />
      <Atom x={36} y={48} label="N" />
      <Atom x={60} y={20} label="O" />
    </svg>
  );
}

function Generic() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <S d="M22 40 L32 26 L48 26 L58 40 L48 54 L32 54 Z" />
      <S d="M24 40 L32 28" />
      <S d="M46 28 L56 40" />
      <S d="M48 54 L56 60" />
      <S d="M32 26 L26 18" />
      <circle
        cx={40}
        cy={40}
        r={22}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.6}
        strokeDasharray="2 3"
        opacity={0.5}
      />
    </svg>
  );
}

export type MoleculeUnit = "s" | "min" | "h";
export type MoleculeMeta = {
  key: string;
  name: string;
  halfLife: number;
  unit: MoleculeUnit;
  Icon: React.ComponentType;
};

const MOLECULE_INDEX: Record<string, MoleculeMeta> = {
  caffeine: { key: "caffeine", name: "Caféine", halfLife: 5, unit: "h", Icon: Caffeine },
  cafeine: { key: "caffeine", name: "Caféine", halfLife: 5, unit: "h", Icon: Caffeine },
  café: { key: "caffeine", name: "Caféine", halfLife: 5, unit: "h", Icon: Caffeine },
  paracetamol: { key: "paracetamol", name: "Paracétamol", halfLife: 2, unit: "h", Icon: Paracetamol },
  paracétamol: { key: "paracetamol", name: "Paracétamol", halfLife: 2, unit: "h", Icon: Paracetamol },
  acetaminophen: { key: "paracetamol", name: "Paracétamol", halfLife: 2, unit: "h", Icon: Paracetamol },
  ibuprofen: { key: "ibuprofen", name: "Ibuprofène", halfLife: 2, unit: "h", Icon: Ibuprofen },
  ibuprofène: { key: "ibuprofen", name: "Ibuprofène", halfLife: 2, unit: "h", Icon: Ibuprofen },
  nicotine: { key: "nicotine", name: "Nicotine", halfLife: 15, unit: "min", Icon: Nicotine },
  aspirin: { key: "aspirin", name: "Aspirine", halfLife: 3, unit: "h", Icon: Aspirin },
  aspirine: { key: "aspirin", name: "Aspirine", halfLife: 3, unit: "h", Icon: Aspirin },
  ethanol: { key: "ethanol", name: "Éthanol", halfLife: 30, unit: "min", Icon: Ethanol },
  éthanol: { key: "ethanol", name: "Éthanol", halfLife: 30, unit: "min", Icon: Ethanol },
  alcool: { key: "ethanol", name: "Éthanol", halfLife: 30, unit: "min", Icon: Ethanol },
  buprénorphine: { key: "buprenorphine", name: "Buprénorphine", halfLife: 40, unit: "h", Icon: Buprenorphine },
  buprenorphine: { key: "buprenorphine", name: "Buprénorphine", halfLife: 40, unit: "h", Icon: Buprenorphine },
  oxazepam: { key: "oxazepam", name: "Oxazépam", halfLife: 6, unit: "h", Icon: Oxazepam },
  oxazépam: { key: "oxazepam", name: "Oxazépam", halfLife: 6, unit: "h", Icon: Oxazepam },
};

export const SUGGESTED_MOLECULE_KEYS = [
  "caffeine",
  "paracetamol",
  "ibuprofen",
  "nicotine",
  "aspirin",
  "ethanol",
] as const;

export function lookupMolecule(name: string | null | undefined): MoleculeMeta | null {
  if (!name) return null;
  const k = name.toString().trim().toLowerCase().normalize("NFKC");
  if (!k) return null;
  if (MOLECULE_INDEX[k]) return MOLECULE_INDEX[k];
  for (const key of Object.keys(MOLECULE_INDEX)) {
    if (k.includes(key) || key.includes(k)) return MOLECULE_INDEX[key];
  }
  return null;
}

export function getSuggestedMolecules(): MoleculeMeta[] {
  return SUGGESTED_MOLECULE_KEYS.map((k) => MOLECULE_INDEX[k]);
}

/**
 * Affiche le squelette de la molécule reconnue (ou le générique sinon).
 * `decayProgress` ∈ [0,1] estompe progressivement le squelette et fait
 * apparaître des fragments dispersés (effet "décomposition").
 */
export function MoleculeIcon({
  name,
  decayProgress = 0,
}: {
  name: string;
  decayProgress?: number;
}) {
  const meta = lookupMolecule(name);
  const Icon = meta?.Icon ?? Generic;
  const fade = Math.max(0, Math.min(1, decayProgress));
  return (
    <div className="mol-icon-inner">
      <div
        style={{
          opacity: 1 - fade * 0.55,
          transition: "opacity 0.6s ease",
          width: "100%",
          height: "100%",
        }}
      >
        <Icon />
      </div>
      {fade > 0.05 && (
        <svg
          viewBox="0 0 80 80"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const ang = (i / 5) * Math.PI * 2;
            const r = 12 + fade * 22;
            const cx = 40 + Math.cos(ang) * r;
            const cy = 40 + Math.sin(ang) * r;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={1 + (1 - fade) * 1.2}
                fill="currentColor"
                opacity={0.7 - fade * 0.4}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
