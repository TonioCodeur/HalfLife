"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { all, create, type BigNumber } from "mathjs";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  MoleculeIcon,
  getSuggestedMolecules,
  lookupMolecule,
  type MoleculeMeta,
} from "./molecules";

/* ──────────────────────────────────────────────────────────────────
   MATHJS — précision arbitraire pour la décroissance
   ────────────────────────────────────────────────────────────── */
const math = create(all, { number: "BigNumber", precision: 50 });
const BN_ZERO = math.bignumber(0);
const BN_HALF = math.bignumber("0.5");
const BN_HUNDRED = math.bignumber(100);

type Unit = "s" | "min" | "h";
const UNIT_MS: Record<Unit, number> = {
  s: 1_000,
  min: 60_000,
  h: 3_600_000,
};
const UNIT_LABEL: Record<Unit, string> = { s: "s", min: "min", h: "h" };

type MassUnit = "ug" | "mg" | "g";
const MASS_LABEL: Record<MassUnit, string> = {
  ug: "µg",
  mg: "mg",
  g: "g",
};

type Dose = { amount: number; takenAt: number };
type Measurement = {
  id: string;
  name: string;
  halfLife: number;
  unit: Unit;
  massUnit: MassUnit;
  doses: Dose[];
};

const ELIMINATION_THRESHOLD = math.bignumber("1e-6");

/* ──────────────────────────────────────────────────────────────────
   STORAGE
   ────────────────────────────────────────────────────────────── */
const NAME_HISTORY_KEY = "halflife.molecule-history.v1";
const NAME_HISTORY_MAX = 30;
const MEASUREMENTS_KEY = "halflife.measurements.v1";
const THEME_KEY = "halflife.theme.v2";

type ThemeMode = "light" | "dark" | "auto";

function isValidMeasurement(x: unknown): x is Measurement {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  if (
    typeof m.id !== "string" ||
    typeof m.name !== "string" ||
    typeof m.halfLife !== "number" ||
    !Number.isFinite(m.halfLife) ||
    m.halfLife <= 0 ||
    (m.unit !== "s" && m.unit !== "min" && m.unit !== "h") ||
    (m.massUnit !== "ug" && m.massUnit !== "mg" && m.massUnit !== "g") ||
    !Array.isArray(m.doses) ||
    m.doses.length === 0
  ) {
    return false;
  }
  return m.doses.every((d) => {
    if (!d || typeof d !== "object") return false;
    const dose = d as Record<string, unknown>;
    return (
      typeof dose.amount === "number" &&
      Number.isFinite(dose.amount) &&
      dose.amount > 0 &&
      typeof dose.takenAt === "number" &&
      Number.isFinite(dose.takenAt)
    );
  });
}

/* ──────────────────────────────────────────────────────────────────
   DECAY MATH
   ────────────────────────────────────────────────────────────── */
type DecayResult = {
  remaining: BigNumber;
  cumulative: BigNumber;
  fraction: BigNumber;
};

function computeDecay(m: Measurement, now: number): DecayResult {
  const halfLifeMs = math
    .bignumber(m.halfLife)
    .times(math.bignumber(UNIT_MS[m.unit]));
  let remaining = BN_ZERO;
  let cumulative = BN_ZERO;
  for (const d of m.doses) {
    const elapsed = math.bignumber(now - d.takenAt);
    const halfLives = elapsed.div(halfLifeMs);
    const fraction = math.pow(BN_HALF, halfLives) as BigNumber;
    const amount = math.bignumber(d.amount);
    remaining = math.add(
      remaining,
      math.multiply(amount, fraction),
    ) as BigNumber;
    cumulative = math.add(cumulative, amount) as BigNumber;
  }
  const fraction = cumulative.gt(0) ? remaining.div(cumulative) : BN_ZERO;
  return { remaining, cumulative, fraction };
}

function computePeakAtLastDose(m: Measurement): BigNumber {
  const halfLifeMs = math
    .bignumber(m.halfLife)
    .times(math.bignumber(UNIT_MS[m.unit]));
  const lastTakenAt = m.doses[m.doses.length - 1].takenAt;
  let peak = BN_ZERO;
  for (const d of m.doses) {
    const elapsed = math.bignumber(lastTakenAt - d.takenAt);
    const halfLives = elapsed.div(halfLifeMs);
    const fraction = math.pow(BN_HALF, halfLives) as BigNumber;
    const amount = math.bignumber(d.amount);
    peak = math.add(peak, math.multiply(amount, fraction)) as BigNumber;
  }
  return peak;
}

function isMeasurementFinished(m: Measurement, now: number): boolean {
  return computeDecay(m, now).fraction.lt(ELIMINATION_THRESHOLD);
}

function halfLivesSinceLastDose(m: Measurement, now: number): number {
  const halfLifeMs = math
    .bignumber(m.halfLife)
    .times(math.bignumber(UNIT_MS[m.unit]));
  const lastTakenAt = m.doses[m.doses.length - 1].takenAt;
  return math.bignumber(now - lastTakenAt).div(halfLifeMs).toNumber();
}

/* ──────────────────────────────────────────────────────────────────
   NOTIFICATIONS NAVIGATEUR
   ────────────────────────────────────────────────────────────── */
function canNotify(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}

function notifyHalfLife(
  m: Measurement,
  bucket: number,
  remainingDose: number,
  pct: number,
) {
  if (!canNotify()) return;
  const plural = bucket > 1 ? "s" : "";
  new Notification(`⌬ Halflife · ${m.name}`, {
    body: `${bucket} demi-vie${plural} écoulée${plural} depuis la dernière dose · ${formatDose(remainingDose)} ${MASS_LABEL[m.massUnit]} restants (${pct.toFixed(1)} %)`,
    tag: `halflife-${m.id}-${bucket}`,
    icon: "/favicon.ico",
  });
}

function notifyEliminated(m: Measurement) {
  if (!canNotify()) return;
  new Notification(`✗ Halflife · Élimination terminée`, {
    body: `${m.name} a été entièrement éliminée du sang.`,
    tag: `eliminated-${m.id}`,
    icon: "/favicon.ico",
    requireInteraction: true,
  });
}

type NotifPerm = NotificationPermission | "unsupported";
const permissionListeners = new Set<() => void>();
function subscribePermission(cb: () => void) {
  permissionListeners.add(cb);
  return () => permissionListeners.delete(cb);
}
function getPermissionSnapshot(): NotifPerm {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}
function getServerPermissionSnapshot(): NotifPerm {
  return "default";
}
function notifyPermissionChanged() {
  permissionListeners.forEach((cb) => cb());
}

/* ── Store externe : prefers-color-scheme ──────────────────────────
 * Évite setState-in-effect : la souscription au matchMedia se fait
 * via la callback de useSyncExternalStore. */
function subscribeColorScheme(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getColorSchemeSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function getServerColorSchemeSnapshot(): boolean {
  return false;
}

/* ──────────────────────────────────────────────────────────────────
   APP
   ────────────────────────────────────────────────────────────── */
export function HalflifeApp() {
  /* ── Form state ── */
  const [name, setName] = useState("");
  const [halfLife, setHalfLife] = useState("");
  const [unit, setUnit] = useState<Unit>("h");
  const [dose, setDose] = useState("");
  const [massUnit, setMassUnit] = useState<MassUnit>("mg");
  const [error, setError] = useState<string | null>(null);

  /* ── Persisted state ── */
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [nameHistory, setNameHistory] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /* ── Tick (1Hz) ── */
  const [now, setNow] = useState<number>(() => Date.now());

  /* ── Theme (light / dark / auto) ── */
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const systemDark = useSyncExternalStore(
    subscribeColorScheme,
    getColorSchemeSnapshot,
    getServerColorSchemeSnapshot,
  );
  const effectiveTheme = theme === "auto" ? (systemDark ? "dark" : "light") : theme;

  /* ── Notifications ── */
  const notifPermission = useSyncExternalStore(
    subscribePermission,
    getPermissionSnapshot,
    getServerPermissionSnapshot,
  );
  const notificationStateRef = useRef<
    Map<string, { lastWholeBucket: number; eliminationNotified: boolean }>
  >(new Map());

  const nameId = useId();
  const halfId = useId();
  const doseId = useId();
  const datalistId = useId();

  /* ── Hydratation localStorage ── */
  useEffect(() => {
    let nextHistory: string[] | null = null;
    let nextMeasurements: Measurement[] | null = null;
    let nextTheme: ThemeMode | null = null;

    try {
      const raw = localStorage.getItem(NAME_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          nextHistory = parsed
            .filter((x): x is string => typeof x === "string" && x.length > 0)
            .slice(0, NAME_HISTORY_MAX);
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(MEASUREMENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          nextMeasurements = parsed.filter(isValidMeasurement);
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark" || t === "auto") nextTheme = t;
    } catch {
      /* ignore */
    }

    /* eslint-disable react-hooks/set-state-in-effect -- hydratation
     * post-mount depuis localStorage : pas d'alternative sans risquer
     * un mismatch d'hydratation SSR. */
    if (nextHistory) setNameHistory(nextHistory);
    if (nextMeasurements) setMeasurements(nextMeasurements);
    if (nextTheme) setTheme(nextTheme);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /* ── Persistance ── */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(measurements));
    } catch {
      /* ignore */
    }
  }, [measurements, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, hydrated]);

  /* ── Sync data-theme sur <html> ── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  /* ── Tick 1Hz ── */
  const anyActive = measurements.some((m) => !isMeasurementFinished(m, now));
  useEffect(() => {
    if (!anyActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyActive]);

  /* ── Notification permission ── */
  async function requestNotifications() {
    if (notifPermission !== "default") return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      await Notification.requestPermission();
      notifyPermissionChanged();
    } catch {
      /* Safari peut throw — ignorer */
    }
  }

  /* ── Détection des transitions notifs ── */
  useEffect(() => {
    if (notifPermission !== "granted") return;
    const tracker = notificationStateRef.current;
    for (const m of measurements) {
      let st = tracker.get(m.id);
      if (!st) {
        st = {
          lastWholeBucket: Math.floor(halfLivesSinceLastDose(m, now)),
          eliminationNotified: isMeasurementFinished(m, now),
        };
        tracker.set(m.id, st);
        continue;
      }
      if (!st.eliminationNotified && isMeasurementFinished(m, now)) {
        notifyEliminated(m);
        st.eliminationNotified = true;
        continue;
      }
      const halfLivesNow = halfLivesSinceLastDose(m, now);
      const bucket = Math.floor(halfLivesNow);
      if (bucket > st.lastWholeBucket) {
        const decay = computeDecay(m, now);
        const remainingDose = decay.remaining.toNumber();
        const pct = (decay.fraction.times(BN_HUNDRED) as BigNumber).toNumber();
        notifyHalfLife(m, bucket, remainingDose, pct);
        st.lastWholeBucket = bucket;
      }
    }
  }, [notifPermission, measurements, now]);

  /* ── Drag-and-drop ── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMeasurements((items) => {
      const oldIndex = items.findIndex((m) => m.id === active.id);
      const newIndex = items.findIndex((m) => m.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  /* ── Form actions ── */
  function rememberName(value: string) {
    setNameHistory((prev) => {
      const lower = value.toLowerCase();
      const filtered = prev.filter((x) => x.toLowerCase() !== lower);
      const next = [value, ...filtered].slice(0, NAME_HISTORY_MAX);
      try {
        localStorage.setItem(NAME_HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const halfValue = Number.parseFloat(halfLife);
    const doseValue = Number.parseFloat(dose);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Indique le nom de la molécule.");
      return;
    }
    if (!Number.isFinite(halfValue) || halfValue <= 0) {
      setError("Demi-vie invalide.");
      return;
    }
    if (!Number.isFinite(doseValue) || doseValue <= 0) {
      setError("Dose initiale invalide.");
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
    rememberName(trimmed);
    setName("");
    setHalfLife("");
    setDose("");
  }

  function remove(id: string) {
    notificationStateRef.current.delete(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }
  function clearAll() {
    notificationStateRef.current.clear();
    setMeasurements([]);
  }
  function addDose(id: string, amount: number) {
    notificationStateRef.current.set(id, {
      lastWholeBucket: 0,
      eliminationNotified: false,
    });
    setMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, doses: [...m.doses, { amount, takenAt: Date.now() }] }
          : m,
      ),
    );
  }
  function applySuggestion(meta: MoleculeMeta) {
    setName(meta.name);
    setHalfLife(String(meta.halfLife));
    setUnit(meta.unit);
  }

  /* ── Stats ── */
  let totalActive = 0;
  let totalEliminated = 0;
  for (const m of measurements) {
    if (isMeasurementFinished(m, now)) totalEliminated++;
    else totalActive++;
  }

  const recognized = lookupMolecule(name);
  const suggestions = getSuggestedMolecules();

  return (
    <div className="hl-app">
      {/* ── TOPBAR ───────────────────────────────────────────── */}
      <header className="hl-topbar">
        <div className="topbar-brand">
          <span className="logo" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="6" r="2" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="6" cy="18" r="2" />
              <circle cx="18" cy="18" r="2" />
              <circle cx="12" cy="12" r="2" />
              <line x1="6" y1="6" x2="12" y2="12" />
              <line x1="18" y1="6" x2="12" y2="12" />
              <line x1="12" y1="12" x2="6" y2="18" />
              <line x1="12" y1="12" x2="18" y2="18" />
            </svg>
          </span>
          <span className="name">
            HALFLIFE<span className="dim">.exe</span>
          </span>
          <span className="tag accent" style={{ marginLeft: 12 }}>
            <span className="dot" />
            <span>v.2.6 // pharmacokinetics</span>
          </span>
        </div>
        <div className="topbar-meta">
          <span className="kbd">
            <span className="status-dot" />
            {anyActive ? `${totalActive} sys.live` : "idle"}
          </span>
          <div className="theme-toggle" role="radiogroup" aria-label="Thème">
            {(
              [
                {
                  v: "light",
                  label: "LIGHT",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                    </svg>
                  ),
                },
                {
                  v: "auto",
                  label: "AUTO",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  v: "dark",
                  label: "DARK",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ),
                },
              ] as const
            ).map((b) => (
              <button
                key={b.v}
                type="button"
                className={theme === b.v ? "active" : ""}
                onClick={() => setTheme(b.v)}
                aria-pressed={theme === b.v}
              >
                {b.icon}
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside className="hl-sidebar" aria-label="Nouvelle mesure">
        <div className="section-label">
          <span className="glow-text">▌ 01 // nouvelle_mesure</span>
          <span className="num">[NEW]</span>
        </div>

        <form onSubmit={add} noValidate>
          <div className="field">
            <div className="field-label">
              <span>▌ Molécule</span>
              {recognized && (
                <span className="hint" style={{ color: "var(--accent-bright)" }}>
                  ↻ {recognized.name} reconnu
                </span>
              )}
            </div>
            <input
              id={nameId}
              className="tx"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Caféine, paracétamol…"
              autoComplete="off"
              list={nameHistory.length > 0 ? datalistId : undefined}
            />
            {nameHistory.length > 0 && (
              <datalist id={datalistId}>
                {nameHistory.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}
          </div>

          <div className="field">
            <div className="field-label">
              <span>▌ Demi-vie (t½)</span>
            </div>
            <div className="row-units">
              <input
                id={halfId}
                className="tx"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={halfLife}
                onChange={(e) => setHalfLife(e.target.value)}
                placeholder="ex. 5"
              />
              <div
                className="unit-toggle"
                role="radiogroup"
                aria-label="Unité de la demi-vie"
              >
                {(["s", "min", "h"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={unit === u}
                    className={unit === u ? "active" : ""}
                    onClick={() => setUnit(u)}
                  >
                    {UNIT_LABEL[u]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <div className="field-label">
              <span>▌ Dose initiale</span>
            </div>
            <div className="row-units">
              <input
                id={doseId}
                className="tx"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="ex. 200"
              />
              <div
                className="unit-toggle"
                role="radiogroup"
                aria-label="Unité de la dose"
              >
                {(["ug", "mg", "g"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={massUnit === u}
                    className={massUnit === u ? "active" : ""}
                    onClick={() => setMassUnit(u)}
                  >
                    {MASS_LABEL[u]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="error-msg">
              ⚠ {error}
            </div>
          )}

          <div className="actions">
            <button type="submit" className="hl-btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Lancer la mesure
            </button>
            {measurements.length > 0 && (
              <button type="button" className="hl-btn ghost" onClick={clearAll}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
                Tout effacer
              </button>
            )}
          </div>
        </form>

        {/* SUGGESTIONS */}
        <div className="suggestions">
          <div className="section-label" style={{ borderBottom: "none", marginBottom: 6 }}>
            <span>▌ molécules connues</span>
            <span className="num">[{suggestions.length}]</span>
          </div>
          <p className="kbd" style={{ margin: "0 0 8px", fontSize: 9 }}>
            cliquez pour pré-remplir
          </p>
          <div className="suggestions-grid">
            {suggestions.map((meta) => (
              <button
                key={meta.key}
                type="button"
                className="suggestion"
                onClick={() => applySuggestion(meta)}
              >
                <span className="mol-mini">
                  <MoleculeIcon name={meta.name} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="label">{meta.name}</span>
                  <span className="meta">
                    t½ {meta.halfLife}
                    {meta.unit}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* MODÈLE */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--fg-mute)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            lineHeight: 1.8,
          }}
        >
          <div>{"// modèle"}</div>
          <div
            style={{
              color: "var(--fg-dim)",
              marginTop: 4,
              letterSpacing: "0.05em",
              textTransform: "none",
              fontSize: 11,
            }}
          >
            C(t) = Σ Cᵢ · (½)^((t − tᵢ) / t½)
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <main className="hl-main">
        <div className="main-head">
          <div>
            {/* h1 SEO complet en sr-only ; copie visible décorative */}
            <h1 className="glow-text">
              <span className="sr-only">
                Halflife — Calculateur de demi-vie pharmacocinétique en temps
                réel pour médicaments et molécules
              </span>
              <span aria-hidden="true">
                Tableau de bord — décroissance temps réel
              </span>
            </h1>
            <div className="sub">
              ▸ pharmacocinétique · 1 Hz · BigNumber 50 chiffres
            </div>
          </div>
          <div className="main-stats">
            <div className="stat">
              <div className="v">{String(totalActive).padStart(2, "0")}</div>
              <div className="l">Actives</div>
            </div>
            <div className="stat cyan">
              <div className="v">{String(totalEliminated).padStart(2, "0")}</div>
              <div className="l">Éliminées</div>
            </div>
            <div className="stat pink">
              <div className="v">{String(measurements.length).padStart(2, "0")}</div>
              <div className="l">Total</div>
            </div>
          </div>
        </div>

        {/* Bandeau notifs */}
        {notifPermission === "default" && (
          <div className="notif-bar" role="status">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="txt">
              Active les <b>notifications</b> pour être alerté à chaque demi-vie
              écoulée et quand une molécule est entièrement éliminée.
            </span>
            <button
              type="button"
              className="hl-btn primary sm"
              onClick={requestNotifications}
            >
              Activer
            </button>
          </div>
        )}
        {notifPermission === "denied" && (
          <div className="notif-bar" role="status" style={{ background: "transparent" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--cyan)" }}>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
              <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
              <path d="M18 8a6 6 0 0 0-9.91-4.6" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <span className="txt" style={{ color: "var(--cyan)" }}>
              Notifications bloquées par le navigateur — autorise halflife.exe
              dans les réglages.
            </span>
          </div>
        )}

        {measurements.length === 0 ? (
          <EmptyState />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={measurements.map((m) => m.id)}
              strategy={rectSortingStrategy}
            >
              <ul
                className="cards"
                aria-label={`${measurements.length} mesure${measurements.length > 1 ? "s" : ""} en cours`}
              >
                {measurements.map((m) => (
                  <MeasurementCard
                    key={m.id}
                    m={m}
                    now={now}
                    onRemove={remove}
                    onAddDose={addDose}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   EMPTY STATE
   ────────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-art">
        <svg
          viewBox="0 0 220 180"
          style={{ width: "100%", height: "100%", color: "var(--accent-bright)" }}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="empty-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="110" cy="90" rx="100" ry="70" fill="url(#empty-glow)" />
          {/* Caféine centrale géante */}
          <g
            transform="translate(70 50) scale(1.25)"
            stroke="currentColor"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter:
                "drop-shadow(0 0 calc(8px * var(--glow)) currentColor)",
            }}
          >
            <path d="M22 28 L36 20 L50 28 L50 44 L36 52 L22 44 Z" />
            <path d="M50 28 L66 26 L70 40 L62 46 L50 44" />
            <path d="M24 30 L34 24" />
            <path d="M52 30 L52 42" />
            <path d="M36 20 L36 12" />
            <path d="M22 44 L14 50" />
            <path d="M62 46 L66 56" />
          </g>
          {/* Particules dispersées */}
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const r = 60 + (i % 3) * 8;
            const x = 110 + Math.cos(ang) * r;
            const y = 90 + Math.sin(ang) * r * 0.6;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={1 + (i % 2)}
                fill="currentColor"
                opacity={0.3 + (i % 3) * 0.15}
              >
                <animate
                  attributeName="opacity"
                  values="0.2;0.8;0.2"
                  dur={`${2 + i * 0.3}s`}
                  repeatCount="indefinite"
                />
              </circle>
            );
          })}
        </svg>
      </div>
      <h2 className="glow-text">Aucune mesure en cours</h2>
      <p>
        renseigne une molécule à gauche et lance{" "}
        <span className="accent">[ MESURER ]</span>
      </p>
      <p style={{ marginTop: 4, color: "var(--fg-mute)", fontSize: 10 }}>
        {"// system idle · awaiting input"}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   DECAY GRAPH
   ────────────────────────────────────────────────────────────── */
function DecayGraph({ m, now }: { m: Measurement; now: number }) {
  const W = 400;
  const H = 110;
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const halfLifeMs = m.halfLife * UNIT_MS[m.unit];
  const start = m.doses[0].takenAt;
  const tMin = start;
  const tMax = start + Math.max(now - start, halfLifeMs * 4);
  const span = Math.max(tMax - tMin, 1);

  const cumTotal = m.doses.reduce((a, d) => a + d.amount, 0);
  function conc(t: number) {
    let r = 0;
    for (const d of m.doses) {
      if (t < d.takenAt) continue;
      r += d.amount * Math.pow(0.5, (t - d.takenAt) / halfLifeMs);
    }
    return cumTotal > 0 ? r / cumTotal : 0;
  }

  const N = 80;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const t = tMin + (span * i) / N;
    const v = conc(t);
    const x = pad.l + ((W - pad.l - pad.r) * i) / N;
    const y = pad.t + (H - pad.t - pad.b) * (1 - v);
    pts.push([x, y]);
  }
  const nowIdx = Math.min(N, Math.max(0, Math.round(((now - tMin) / span) * N)));
  const past = pts.slice(0, nowIdx + 1).map(([x, y]) => `${x},${y}`).join(" L ");
  const fut = pts.slice(nowIdx).map(([x, y]) => `${x},${y}`).join(" L ");

  const fillPts = pts.slice(0, nowIdx + 1);
  const fillD =
    fillPts.length > 1
      ? `M ${fillPts[0][0]},${H - pad.b} L ${fillPts.map(([x, y]) => `${x},${y}`).join(" L ")} L ${fillPts[fillPts.length - 1][0]},${H - pad.b} Z`
      : "";

  const nowPt = pts[nowIdx];
  const doseMarkers = m.doses.map((d, i) => {
    const x = pad.l + ((W - pad.l - pad.r) * (d.takenAt - tMin)) / span;
    return { x, i };
  });
  const halfTicks: Array<{ x: number; k: number }> = [];
  for (let k = 1; k <= 6; k++) {
    const t = start + halfLifeMs * k;
    if (t > tMax) break;
    const x = pad.l + ((W - pad.l - pad.r) * (t - tMin)) / span;
    halfTicks.push({ x, k });
  }

  const gradId = `decay-grad-${m.id}`;

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={H - pad.b}
          y2={H - pad.b}
          stroke="var(--border)"
          strokeWidth="1"
        />
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={pad.t + (H - pad.t - pad.b) * 0.5}
          y2={pad.t + (H - pad.t - pad.b) * 0.5}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="2 3"
        />
        {halfTicks.map((t) => (
          <g key={t.k}>
            <line
              x1={t.x}
              x2={t.x}
              y1={pad.t}
              y2={H - pad.b}
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.7"
            />
            <text
              x={t.x}
              y={H - 4}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="8"
              fill="var(--fg-mute)"
              letterSpacing="0.1em"
            >
              {t.k}t½
            </text>
          </g>
        ))}
        {fillD && <path d={fillD} fill={`url(#${gradId})`} />}
        {past && (
          <path
            d={`M ${past}`}
            fill="none"
            stroke="var(--accent-bright)"
            strokeWidth="1.6"
            style={{
              filter:
                "drop-shadow(0 0 calc(4px * var(--glow)) var(--accent))",
            }}
          />
        )}
        {fut && (
          <path
            d={`M ${fut}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
        )}
        {doseMarkers.map((d) => (
          <g key={d.i}>
            <line
              x1={d.x}
              x2={d.x}
              y1={pad.t - 2}
              y2={H - pad.b}
              stroke="var(--pink)"
              strokeWidth="0.8"
              opacity="0.55"
            />
            <circle
              cx={d.x}
              cy={pad.t}
              r="2.5"
              fill="var(--pink)"
              style={{ filter: "drop-shadow(0 0 4px var(--pink))" }}
            />
          </g>
        ))}
        {nowPt && (
          <g>
            <line
              x1={nowPt[0]}
              x2={nowPt[0]}
              y1={pad.t}
              y2={H - pad.b}
              stroke="var(--cyan)"
              strokeWidth="1"
            />
            <circle
              cx={nowPt[0]}
              cy={nowPt[1]}
              r="3"
              fill="var(--cyan)"
              style={{ filter: "drop-shadow(0 0 6px var(--cyan))" }}
            />
            <circle
              cx={nowPt[0]}
              cy={nowPt[1]}
              r="6"
              fill="none"
              stroke="var(--cyan)"
              strokeWidth="0.5"
              opacity="0.6"
            >
              <animate attributeName="r" values="3;9;3" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MEASUREMENT CARD
   ────────────────────────────────────────────────────────────── */
function MeasurementCard({
  m,
  now,
  onRemove,
  onAddDose,
}: {
  m: Measurement;
  now: number;
  onRemove: (id: string) => void;
  onAddDose: (id: string, amount: number) => void;
}) {
  const [extra, setExtra] = useState("");
  const [doseError, setDoseError] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.id });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startedAt = m.doses[0].takenAt;
  const decay = computeDecay(m, now);
  const finished = decay.fraction.lt(ELIMINATION_THRESHOLD);
  const remaining = finished ? 0 : decay.remaining.toNumber();
  const cumulative = decay.cumulative.toNumber();
  const peak = computePeakAtLastDose(m);
  const displayFraction = peak.gt(0) ? decay.remaining.div(peak) : BN_ZERO;
  const displayPct = finished
    ? 0
    : (displayFraction.times(BN_HUNDRED) as BigNumber).toNumber();
  const halfLivesLast = halfLivesSinceLastDose(m, now);
  const decayProgress = 1 - decay.fraction.toNumber();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const v = Number.parseFloat(extra);
    if (!Number.isFinite(v) || v <= 0) {
      setDoseError("Dose invalide");
      return;
    }
    setDoseError(null);
    onAddDose(m.id, v);
    setExtra("");
  }

  return (
    <li
      ref={setNodeRef}
      className={
        "hl-card " +
        (isDragging ? "dragging " : "") +
        (finished ? "finished" : "glow")
      }
      style={sortableStyle}
    >
      <article aria-label={`Mesure de ${m.name}`}>
        <header className="card-head">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Réordonner la mesure ${m.name}`}
            className="drag-handle"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="6" r="1" />
              <circle cx="15" cy="6" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="9" cy="18" r="1" />
              <circle cx="15" cy="18" r="1" />
            </svg>
          </button>

          <div className="mol-icon">
            <MoleculeIcon name={m.name} decayProgress={decayProgress} />
          </div>

          <div className="title-block">
            <h3 className="glow-text">
              {m.name}
              {finished && <span className="badge-finished">◉ éliminé</span>}
            </h3>
            <div className="meta">
              t½ = {m.halfLife}
              {UNIT_LABEL[m.unit]}
              <span className="sep">·</span>
              {m.doses.length} prise{m.doses.length > 1 ? "s" : ""}
              <span className="sep">·</span>
              cumul {formatDose(cumulative)} {MASS_LABEL[m.massUnit]}
            </div>
          </div>

          <div className="actions-h">
            <button
              type="button"
              className="btn-icon"
              onClick={() => onRemove(m.id)}
              aria-label={`Supprimer la mesure de ${m.name}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </header>

        <div className="card-body">
          <div className="metric-block">
            <div className="l">▌ Quantité restante dans le sang</div>
            <div className="v">
              {formatDose(remaining)}
              <span className="u">{MASS_LABEL[m.massUnit]}</span>
            </div>
            <div className="sub">
              sur {formatDose(cumulative)} {MASS_LABEL[m.massUnit]} administré
              {m.doses.length > 1 ? "s" : ""}
            </div>
          </div>

          <DecayGraph m={m} now={now} />

          <div className="mini-stats">
            <div className="mini-stat accent">
              <div className="l">Taux sanguin</div>
              <div className="v">
                {displayPct.toFixed(2)}
                <span className="u">%</span>
              </div>
            </div>
            <div className="mini-stat cyan">
              <div className="l">
                Demi-vies écoulées{m.doses.length > 1 ? " ↻" : ""}
              </div>
              <div className="v">
                {halfLivesLast.toFixed(2)}
                <span className="u">× t½</span>
              </div>
            </div>
          </div>

          <div className="bar-wrap">
            <div
              className="bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(displayPct.toFixed(2))}
              aria-label={`Taux restant pour ${m.name}`}
            >
              <div
                className="fill"
                style={{ width: `${Math.max(0, Math.min(100, displayPct))}%` }}
              />
            </div>
            <div className="bar-meta">
              <span>écoulé : {formatElapsed(now - startedAt)}</span>
              <span>
                démarré : {new Date(startedAt).toLocaleTimeString("fr-FR")}
              </span>
            </div>
          </div>

          {m.doses.length > 1 && (
            <details className="history">
              <summary>historique des {m.doses.length} prises</summary>
              <ul>
                {m.doses.map((d, i) => (
                  <li key={`${d.takenAt}-${i}`}>
                    <span>
                      <span className="n">#{i + 1}</span> ·{" "}
                      {new Date(d.takenAt).toLocaleTimeString("fr-FR")}
                    </span>
                    <span className="a">
                      +{formatDose(d.amount)} {MASS_LABEL[m.massUnit]}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <form className="card-foot" onSubmit={handleAdd}>
          <label className="sr-only" htmlFor={`add-dose-${m.id}`}>
            Ajouter une dose à {m.name}
          </label>
          <input
            id={`add-dose-${m.id}`}
            className="tx"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={extra}
            onChange={(e) => {
              setExtra(e.target.value);
              if (doseError) setDoseError(null);
            }}
            placeholder={`+ dose en ${MASS_LABEL[m.massUnit]}`}
            aria-invalid={doseError != null}
          />
          <span className="unit-pill">{MASS_LABEL[m.massUnit]}</span>
          <button type="submit" className="hl-btn primary sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Ajouter
          </button>
          {doseError && (
            <span role="alert" style={{ color: "oklch(0.78 0.20 25)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {doseError}
            </span>
          )}
        </form>
      </article>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────
   FORMAT HELPERS
   ────────────────────────────────────────────────────────────── */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

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
