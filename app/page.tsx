"use client";

import { useEffect, useId, useState } from "react";
import {
  ActivityIcon,
  BeakerIcon,
  TrashIcon,
  ZapIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Unit = "s" | "min" | "h";

const UNIT_MS: Record<Unit, number> = {
  s: 1_000,
  min: 60_000,
  h: 3_600_000,
};

const UNIT_LABEL: Record<Unit, string> = {
  s: "s",
  min: "min",
  h: "h",
};

type MassUnit = "ug" | "mg" | "g";

const MASS_LABEL: Record<MassUnit, string> = {
  ug: "µg",
  mg: "mg",
  g: "g",
};

type Dose = {
  amount: number;
  takenAt: number;
};

type Measurement = {
  id: string;
  name: string;
  halfLife: number;
  unit: Unit;
  massUnit: MassUnit;
  doses: Dose[]; // au moins une dose ; doses[0] = dose initiale
};

export default function Home() {
  const [name, setName] = useState("");
  const [halfLife, setHalfLife] = useState("");
  const [unit, setUnit] = useState<Unit>("h");
  const [dose, setDose] = useState("");
  const [massUnit, setMassUnit] = useState<MassUnit>("mg");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const nameId = useId();
  const halfId = useId();
  const doseId = useId();

  // Tick d'une seconde — pilote la décroissance affichée
  useEffect(() => {
    if (measurements.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [measurements.length]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const halfValue = Number.parseFloat(halfLife);
    const doseValue = Number.parseFloat(dose);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Indiquez le nom de la molécule.");
      return;
    }
    if (!Number.isFinite(halfValue) || halfValue <= 0) {
      setError("La demi-vie doit être un nombre strictement positif.");
      return;
    }
    if (!Number.isFinite(doseValue) || doseValue <= 0) {
      setError("La dose initiale doit être un nombre strictement positif.");
      return;
    }
    setError(null);
    setMeasurements((prev) => [
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        name: trimmed,
        halfLife: halfValue,
        unit,
        massUnit,
        doses: [{ amount: doseValue, takenAt: Date.now() }],
      },
      ...prev,
    ]);
    setName("");
    setHalfLife("");
    setDose("");
  }

  function remove(id: string) {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }

  function clearAll() {
    setMeasurements([]);
  }

  function addDose(id: string, amount: number) {
    setMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, doses: [...m.doses, { amount, takenAt: Date.now() }] }
          : m,
      ),
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 sm:py-24">
      <div className="w-full max-w-4xl space-y-12">
        {/* ────── HERO ────── */}
        <section className="space-y-4 text-center sm:text-left">
          <span className="inline-flex items-center gap-2 rounded-sm border border-[var(--neon-pink)]/60 bg-[color-mix(in_oklch,var(--neon-pink),transparent_88%)] px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-[var(--neon-pink)] [text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_30%)] shadow-[0_0_12px_color-mix(in_oklch,var(--neon-pink),transparent_70%)]">
            <ActivityIcon className="size-3" /> SYS://halflife.exe
          </span>
          <h1 className="font-heading text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            <span className="block text-[var(--neon-white)] [text-shadow:0_0_10px_color-mix(in_oklch,var(--neon-pink),transparent_25%),0_0_24px_color-mix(in_oklch,var(--neon-pink),transparent_55%),0_0_48px_color-mix(in_oklch,var(--neon-purple),transparent_55%)]">
              HALF—LIFE
            </span>
            <span className="mt-2 block bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] bg-clip-text text-transparent">
              CYBER—DECAY
            </span>
          </h1>
          <p className="max-w-2xl font-mono text-base text-[oklch(0.85_0.05_310)]">
            &gt; Lance une mesure pour suivre l&apos;élimination d&apos;une
            molécule en temps réel. Le taux sanguin et le nombre de demi-vies
            écoulées sont mis à jour chaque seconde.
          </p>
        </section>

        {/* ────── FORMULAIRE ────── */}
        <section>
          <header className="flex items-baseline justify-between border-b border-[var(--neon-pink)]/30 pb-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--neon-pink)] [text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_30%)]">
              ▌ 01 // nouvelle_mesure
            </h2>
          </header>

          <form
            onSubmit={add}
            noValidate
            className="mt-5 space-y-5 rounded-md border border-[var(--neon-purple)]/30 bg-card/60 p-6 shadow-[inset_0_0_30px_color-mix(in_oklch,var(--neon-purple),transparent_85%)] backdrop-blur-sm sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label
                  htmlFor={nameId}
                  className="font-mono text-xs uppercase tracking-widest text-[var(--neon-cyan)] [text-shadow:0_0_6px_color-mix(in_oklch,var(--neon-cyan),transparent_50%)]"
                >
                  Molécule
                </Label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex. Paracétamol, caféine, ibuprofène…"
                  className="h-12 border-[var(--neon-pink)]/40 bg-[oklch(0.08_0.04_295)/60%] text-base text-[var(--neon-white)] placeholder:text-muted-foreground focus-visible:border-[var(--neon-pink)] focus-visible:ring-[var(--neon-pink)]/40"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor={halfId}
                  className="font-mono text-xs uppercase tracking-widest text-[var(--neon-cyan)] [text-shadow:0_0_6px_color-mix(in_oklch,var(--neon-cyan),transparent_50%)]"
                >
                  Demi-vie
                </Label>
                <div className="flex items-stretch gap-2">
                  <Input
                    id={halfId}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={halfLife}
                    onChange={(e) => setHalfLife(e.target.value)}
                    placeholder="ex. 2"
                    className="h-12 w-full min-w-0 border-[var(--neon-pink)]/40 bg-[oklch(0.08_0.04_295)/60%] text-base text-[var(--neon-white)] placeholder:text-muted-foreground focus-visible:border-[var(--neon-pink)] focus-visible:ring-[var(--neon-pink)]/40 sm:w-32"
                  />
                  <div
                    role="radiogroup"
                    aria-label="Unité de la demi-vie"
                    className="inline-flex items-stretch overflow-hidden rounded-md border border-[var(--neon-cyan)]/40"
                  >
                    {(["s", "min", "h"] as const).map((u) => {
                      const active = unit === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setUnit(u)}
                          className={
                            "px-3 font-mono text-xs uppercase tracking-widest transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--neon-cyan)] " +
                            (active
                              ? "bg-[var(--neon-cyan)] text-[oklch(0.10_0.04_295)] shadow-[inset_0_0_12px_color-mix(in_oklch,white,transparent_60%)]"
                              : "bg-transparent text-[var(--neon-cyan)] hover:bg-[color-mix(in_oklch,var(--neon-cyan),transparent_85%)]")
                          }
                        >
                          {UNIT_LABEL[u]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor={doseId}
                className="font-mono text-xs uppercase tracking-widest text-[var(--neon-cyan)] [text-shadow:0_0_6px_color-mix(in_oklch,var(--neon-cyan),transparent_50%)]"
              >
                Dose initiale
              </Label>
              <div className="flex items-stretch gap-2">
                <Input
                  id={doseId}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="ex. 1000"
                  className="h-12 w-full min-w-0 border-[var(--neon-pink)]/40 bg-[oklch(0.08_0.04_295)/60%] text-base text-[var(--neon-white)] placeholder:text-muted-foreground focus-visible:border-[var(--neon-pink)] focus-visible:ring-[var(--neon-pink)]/40 sm:w-40"
                />
                <div
                  role="radiogroup"
                  aria-label="Unité de la dose"
                  className="inline-flex items-stretch overflow-hidden rounded-md border border-[var(--neon-pink)]/40"
                >
                  {(["ug", "mg", "g"] as const).map((u) => {
                    const active = massUnit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMassUnit(u)}
                        className={
                          "px-3 font-mono text-xs uppercase tracking-widest transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--neon-pink)] " +
                          (active
                            ? "bg-[var(--neon-pink)] text-[oklch(0.10_0.04_295)] shadow-[inset_0_0_12px_color-mix(in_oklch,white,transparent_60%)]"
                            : "bg-transparent text-[var(--neon-pink)] hover:bg-[color-mix(in_oklch,var(--neon-pink),transparent_85%)]")
                        }
                      >
                        {MASS_LABEL[u]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-[oklch(0.65_0.30_25)]/60 bg-[oklch(0.65_0.30_25)]/10 px-4 py-2 font-mono text-sm text-[oklch(0.85_0.20_25)] [text-shadow:0_0_6px_color-mix(in_oklch,oklch(0.65_0.30_25),transparent_40%)]"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button type="submit" size="lg" className="sm:flex-1">
                <ZapIcon /> Mesurer
              </Button>
              {measurements.length > 0 && (
                <Button
                  type="button"
                  variant="outline-cyan"
                  size="lg"
                  onClick={clearAll}
                >
                  <TrashIcon /> Tout effacer
                </Button>
              )}
            </div>
          </form>
        </section>

        {/* ────── LISTE DES MESURES ────── */}
        <section>
          <header className="flex items-baseline justify-between border-b border-[var(--neon-cyan)]/30 pb-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--neon-cyan)] [text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-cyan),transparent_30%)]">
              ▌ 02 // mesures_actives
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              [{measurements.length.toString().padStart(2, "0")}] live
            </span>
          </header>

          {measurements.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-[var(--neon-purple)]/40 bg-card/30 p-10 text-center backdrop-blur-sm">
              <BeakerIcon className="mx-auto size-10 text-[var(--neon-purple)] [filter:drop-shadow(0_0_10px_color-mix(in_oklch,var(--neon-purple),transparent_30%))]" />
              <p className="mt-3 font-mono text-sm uppercase tracking-widest text-muted-foreground">
                aucune mesure en cours
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                renseignez une molécule et cliquez sur{" "}
                <span className="text-[var(--neon-pink)]">[ MESURER ]</span>
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {measurements.map((m) => (
                <MeasurementRow
                  key={m.id}
                  m={m}
                  onRemove={remove}
                  onAddDose={addDose}
                />
              ))}
            </ul>
          )}
        </section>

        <footer className="border-t border-[var(--neon-pink)]/20 pt-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // C(t) = C₀ × (½)^(t / t½) //
        </footer>
      </div>
    </main>
  );
}

/* ── Carte de mesure : recalcule à chaque tick + permet d'ajouter une dose ─ */

function MeasurementRow({
  m,
  onRemove,
  onAddDose,
}: {
  m: Measurement;
  onRemove: (id: string) => void;
  onAddDose: (id: string, amount: number) => void;
}) {
  const [extraDose, setExtraDose] = useState("");
  const [doseError, setDoseError] = useState<string | null>(null);

  const now = Date.now();
  const startedAt = m.doses[0].takenAt;
  const halfLifeMs = m.halfLife * UNIT_MS[m.unit];
  const halfLivesSinceStart = (now - startedAt) / halfLifeMs;

  // Somme : chaque dose décroît indépendamment depuis sa propre prise
  const remainingDose = m.doses.reduce((sum, d) => {
    const halfLives = (now - d.takenAt) / halfLifeMs;
    return sum + d.amount * Math.pow(0.5, halfLives);
  }, 0);
  const cumulativeDose = m.doses.reduce((sum, d) => sum + d.amount, 0);
  const remainingPct = (remainingDose / cumulativeDose) * 100;

  // Couleur du glow selon le taux restant : pink (haut) → purple (mid) → cyan (bas)
  const glowColor =
    remainingPct > 50
      ? "var(--neon-pink)"
      : remainingPct > 12.5
        ? "var(--neon-purple)"
        : "var(--neon-cyan)";

  function handleAddDose(e: React.FormEvent) {
    e.preventDefault();
    const v = Number.parseFloat(extraDose);
    if (!Number.isFinite(v) || v <= 0) {
      setDoseError("Dose invalide");
      return;
    }
    setDoseError(null);
    onAddDose(m.id, v);
    setExtraDose("");
  }

  return (
    <li
      className="group relative overflow-hidden rounded-md border border-[var(--neon-pink)]/30 bg-card/70 backdrop-blur-sm transition-shadow"
      style={{
        boxShadow: `0 0 20px color-mix(in oklch, ${glowColor}, transparent 75%)`,
      }}
    >
      {/* En-tête : nom + bouton supprimer */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--neon-purple)]/20 bg-[oklch(0.08_0.04_295)/60%] px-5 py-3">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-heading text-xl font-bold uppercase tracking-wide text-[var(--neon-white)]"
            style={{
              textShadow: `0 0 8px color-mix(in oklch, ${glowColor}, transparent 35%), 0 0 18px color-mix(in oklch, ${glowColor}, transparent 60%)`,
            }}
          >
            {m.name}
          </h3>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            t½ = {m.halfLife} {UNIT_LABEL[m.unit]} · {m.doses.length} prise
            {m.doses.length > 1 ? "s" : ""} · cumul ={" "}
            {formatDose(cumulativeDose)} {MASS_LABEL[m.massUnit]}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(m.id)}
          aria-label={`Supprimer la mesure de ${m.name}`}
        >
          <TrashIcon />
        </Button>
      </div>

      {/* Corps : quantité + taux + n × t½ + barre + ajout dose */}
      <div className="space-y-4 p-5">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
            Quantité restante dans le sang
          </p>
          <p
            className="mt-1 font-mono text-5xl font-bold tabular-nums sm:text-6xl"
            style={{
              color: glowColor,
              textShadow: `0 0 10px color-mix(in oklch, ${glowColor}, transparent 25%), 0 0 28px color-mix(in oklch, ${glowColor}, transparent 50%)`,
            }}
          >
            {formatDose(remainingDose)}
            <span className="ml-2 text-2xl text-muted-foreground">
              {MASS_LABEL[m.massUnit]}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            sur {formatDose(cumulativeDose)} {MASS_LABEL[m.massUnit]} administré
            {m.doses.length > 1 ? "s au total" : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
              Taux sanguin
            </p>
            <p
              className="mt-1 font-mono text-3xl font-bold tabular-nums sm:text-4xl"
              style={{
                color: glowColor,
                textShadow: `0 0 8px color-mix(in oklch, ${glowColor}, transparent 30%), 0 0 22px color-mix(in oklch, ${glowColor}, transparent 55%)`,
              }}
            >
              {remainingPct.toFixed(2)}
              <span className="ml-1 text-lg text-muted-foreground">%</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
              Demi-vies écoulées
            </p>
            <p
              className="mt-1 font-mono text-3xl font-bold tabular-nums sm:text-4xl"
              style={{
                color: "var(--neon-cyan)",
                textShadow:
                  "0 0 8px color-mix(in oklch, var(--neon-cyan), transparent 30%), 0 0 22px color-mix(in oklch, var(--neon-cyan), transparent 55%)",
              }}
            >
              {halfLivesSinceStart.toFixed(2)}
              <span className="ml-1 text-lg text-muted-foreground">× t½</span>
            </p>
          </div>
        </div>

        {/* Barre de décroissance */}
        <div>
          <div
            className="h-3 w-full overflow-hidden rounded-full border border-[var(--neon-pink)]/20 bg-[oklch(0.08_0.04_295)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(remainingPct.toFixed(2))}
            aria-label={`Taux restant pour ${m.name}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${Math.max(Math.min(remainingPct, 100), 0)}%`,
                background: `linear-gradient(90deg, ${glowColor}, var(--neon-purple))`,
                boxShadow: `0 0 10px ${glowColor}, 0 0 22px color-mix(in oklch, ${glowColor}, transparent 50%)`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <span>écoulé : {formatElapsed(now - startedAt)}</span>
            <span>
              démarré : {new Date(startedAt).toLocaleTimeString("fr-FR")}
            </span>
          </div>
        </div>

        {/* Historique des prises */}
        {m.doses.length > 1 && (
          <details className="rounded-md border border-[var(--neon-purple)]/20 bg-[oklch(0.08_0.04_295)/40%] p-3">
            <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.25em] text-[var(--neon-purple)] [text-shadow:0_0_6px_color-mix(in_oklch,var(--neon-purple),transparent_50%)]">
              ▸ historique des {m.doses.length} prises
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {m.doses.map((d, i) => (
                <li
                  key={d.takenAt}
                  className="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <span>
                    <span className="text-[var(--neon-cyan)]">
                      #{i + 1}
                    </span>{" "}
                    · {new Date(d.takenAt).toLocaleTimeString("fr-FR")}
                  </span>
                  <span className="tabular-nums text-[var(--neon-pink)]">
                    +{formatDose(d.amount)} {MASS_LABEL[m.massUnit]}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Ajout d'une dose à cette mesure */}
        <form
          onSubmit={handleAddDose}
          className="flex flex-col gap-2 border-t border-[var(--neon-purple)]/20 pt-4 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor={`add-dose-${m.id}`}>
            Ajouter une dose à {m.name}
          </label>
          <div className="flex flex-1 items-stretch gap-2">
            <Input
              id={`add-dose-${m.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={extraDose}
              onChange={(e) => {
                setExtraDose(e.target.value);
                if (doseError) setDoseError(null);
              }}
              placeholder={`+ dose en ${MASS_LABEL[m.massUnit]}`}
              aria-invalid={doseError != null}
              className="h-11 flex-1 border-[var(--neon-purple)]/40 bg-[oklch(0.08_0.04_295)/60%] font-mono text-sm text-[var(--neon-white)] placeholder:text-muted-foreground focus-visible:border-[var(--neon-purple)] focus-visible:ring-[var(--neon-purple)]/40"
            />
            <span className="inline-flex items-center rounded-md border border-[var(--neon-purple)]/30 bg-[oklch(0.08_0.04_295)/60%] px-3 font-mono text-xs uppercase tracking-widest text-[var(--neon-purple)]">
              {MASS_LABEL[m.massUnit]}
            </span>
          </div>
          <Button type="submit" variant="purple" size="default">
            <ZapIcon /> Ajouter dose
          </Button>
          {doseError && (
            <span
              role="alert"
              className="font-mono text-xs text-[oklch(0.85_0.20_25)]"
            >
              {doseError}
            </span>
          )}
        </form>
      </div>
    </li>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

/** Formate une dose en gardant une précision lisible quel que soit l'ordre de grandeur. */
function formatDose(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(4);
  if (abs >= 0.0001) return value.toFixed(6);
  return value.toExponential(2);
}
