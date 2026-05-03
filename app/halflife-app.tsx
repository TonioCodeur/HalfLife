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
import { toast } from "sonner";

import {
  MoleculeIcon,
  getSuggestedMolecules,
  lookupMolecule,
  type MoleculeMeta,
} from "./molecules";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

type ConfirmationPayload = {
  name: string;
  dose: number;
  massUnit: MassUnit;
  kind: "new" | "dose";
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
   FIREWORKS V2 — animation cyberpunk plein écran
   Tout est pré-calculé (pas de Math.random côté composant) pour rester
   SSR-safe et déterministe.
   ────────────────────────────────────────────────────────────── */

const FW_COLORS = [
  "var(--pink)",
  "var(--cyan)",
  "var(--accent-bright)",
  "var(--accent)",
  "oklch(0.95 0.05 290)", // bright glitch white
] as const;

/* 70 particules — explosion principale, 4 anneaux radiaux */
const FW_PARTICLES = Array.from({ length: 70 }, (_, i) => {
  const angle = (i / 70) * Math.PI * 2 + ((i % 5) * 0.18);
  // 4 ondes : 280px / 380px / 500px / 640px
  const ringR = [280, 380, 500, 640][i % 4];
  return {
    tx: parseFloat((Math.cos(angle) * ringR).toFixed(2)),
    ty: parseFloat((Math.sin(angle) * ringR).toFixed(2)),
    color: FW_COLORS[i % FW_COLORS.length],
    dur: 700 + (i % 7) * 100,        // 700 → 1300 ms
    delay: (i % 14) * 22,             // 0 → 286 ms stagger
    size: 2 + (i % 5) * 1.4,          // 2 → 7.6 px
  };
});

/* 24 micro-étincelles — 2e vague (1s après) */
const FW_SPARKS = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const r = 160 + (i % 3) * 60;
  return {
    tx: parseFloat((Math.cos(angle) * r).toFixed(2)),
    ty: parseFloat((Math.sin(angle) * r).toFixed(2)),
    color: FW_COLORS[(i + 1) % FW_COLORS.length],
    dur: 600 + (i % 4) * 80,
    delay: 950 + (i * 15),            // démarrage seconde vague
    size: 1.5 + (i % 3) * 1.1,
  };
});

/* 16 rayons radiaux (lignes du centre vers les bords) */
const FW_RAYS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * 360;
  return { angle, delay: 40 + (i % 4) * 30, color: FW_COLORS[i % 3] };
});

/* 6 anneaux concentriques (ondes de choc) */
const FW_SHOCKWAVES = [
  { delay: 0,    dur: 0.95, color: "var(--pink)",          start: 4 },
  { delay: 90,   dur: 1.05, color: "var(--cyan)",          start: 4 },
  { delay: 180,  dur: 1.15, color: "var(--accent-bright)", start: 3 },
  { delay: 320,  dur: 1.05, color: "var(--pink)",          start: 2 },
  { delay: 480,  dur: 0.95, color: "var(--cyan)",          start: 2 },
  { delay: 640,  dur: 0.85, color: "var(--accent-bright)", start: 1 },
] as const;

function hexPath(r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  });
  return `M ${pts.join(" L ")} Z`;
}

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
  new Notification(`⌬ ${m.name} · ${bucket} demi-vie${plural} écoulée${plural}`, {
    body: `Taux sanguin actuel : ${pct.toFixed(1)} %\nQuantité restante : ${formatDose(remainingDose)} ${MASS_LABEL[m.massUnit]}`,
    tag: `halflife-${m.id}-${bucket}`,
    icon: "/favicon.ico",
  });
}

function notifyEliminated(m: Measurement) {
  if (!canNotify()) return;
  new Notification(`✗ ${m.name} · Élimination complète`, {
    body: `${m.name} a entièrement quitté l'organisme.\nTaux sanguin : 0 %.`,
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

  /* ── Confirmation overlay ── */
  const [confirmation, setConfirmation] = useState<ConfirmationPayload | null>(null);

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
    setConfirmation({ name: trimmed, dose: doseValue, massUnit, kind: "new" });
    toast.success(`Mesure initiée · ${trimmed}`, {
      description: `${formatDose(doseValue)} ${MASS_LABEL[massUnit]} · t½ = ${halfValue} ${UNIT_LABEL[unit]}`,
    });
  }

  function remove(id: string) {
    const target = measurements.find((m) => m.id === id);
    notificationStateRef.current.delete(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    if (target) {
      toast.info(`Mesure supprimée · ${target.name}`, {
        description: `${target.doses.length} prise${target.doses.length > 1 ? "s" : ""} effacée${target.doses.length > 1 ? "s" : ""}`,
      });
    }
  }
  function clearAll() {
    const count = measurements.length;
    notificationStateRef.current.clear();
    setMeasurements([]);
    toast.warning(`Toutes les mesures effacées`, {
      description: `${count} mesure${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""}.`,
    });
  }
  function addDose(id: string, amount: number) {
    notificationStateRef.current.set(id, {
      lastWholeBucket: 0,
      eliminationNotified: false,
    });
    // Capture before setState for the confirmation payload
    const target = measurements.find((m) => m.id === id);
    setMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, doses: [...m.doses, { amount, takenAt: Date.now() }] }
          : m,
      ),
    );
    if (target) {
      setConfirmation({ name: target.name, dose: amount, massUnit: target.massUnit, kind: "dose" });
      toast.success(`Dose administrée · ${target.name}`, {
        description: `+${formatDose(amount)} ${MASS_LABEL[target.massUnit]} · taux sanguin réinitialisé`,
      });
    }
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
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <button type="button" className="hl-btn ghost">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Tout effacer
                    </button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Effacer toutes les mesures ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Vous êtes sur le point de supprimer{" "}
                      <strong>
                        {measurements.length} mesure
                        {measurements.length > 1 ? "s" : ""}
                      </strong>{" "}
                      en cours. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={clearAll}
                    >
                      Tout supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

      {/* ── CONFIRMATION OVERLAY ─────────────────────────────── */}
      {confirmation && (
        <ConfirmationOverlay
          payload={confirmation}
          onDismiss={() => setConfirmation(null)}
        />
      )}
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
   CONFIRMATION OVERLAY V2 — fullscreen cyberpunk fireworks
   Couches superposées (z-index croissant) :
     0. Backdrop sombre + blur
     1. Halo radial central (radial-gradient pulsant)
     2. Ondes de choc concentriques (6 cercles qui scalent à fond)
     3. Anneaux hexagonaux rotatifs SVG
     4. Rayons radiaux SVG (16 lignes étoile)
     5. Bandes scanline horizontales/verticales qui balayent l'écran
     6. Particules principales (70 dots avec trail)
     7. Étincelles seconde vague (24 dots, +950 ms)
     8. Carte centrale (glitch + scanline + spring-in)
   ────────────────────────────────────────────────────────────── */
function ConfirmationOverlay({
  payload,
  onDismiss,
}: {
  payload: ConfirmationPayload;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const t = setTimeout(() => { dismissRef.current(); }, 3600);
    return () => clearTimeout(t);
  }, []);

  const HEX_RINGS = [
    { color: "var(--pink)",          delay: 0,    dur: 0.85, rot: 0   },
    { color: "var(--cyan)",          delay: 0.12, dur: 1.05, rot: 30  },
    { color: "var(--accent-bright)", delay: 0.26, dur: 1.25, rot: 60  },
    { color: "var(--pink)",          delay: 0.42, dur: 1.35, rot: 90  },
    { color: "var(--cyan)",          delay: 0.62, dur: 1.45, rot: 120 },
  ] as const;

  return (
    <div
      className="confirm-overlay"
      onClick={onDismiss}
      role="status"
      aria-live="assertive"
      aria-label={
        payload.kind === "new"
          ? `Mesure initiée : ${payload.name}, ${formatDose(payload.dose)} ${MASS_LABEL[payload.massUnit]}`
          : `Dose ajoutée : ${formatDose(payload.dose)} ${MASS_LABEL[payload.massUnit]} de ${payload.name}`
      }
    >
      {/* ── 1. Halo central pulsant ── */}
      <div className="fw-halo" aria-hidden="true" />
      <div className="fw-halo fw-halo-2" aria-hidden="true" />

      {/* ── 2. Ondes de choc (cercles plein écran) ── */}
      <div className="fw-shockwaves" aria-hidden="true">
        {FW_SHOCKWAVES.map((sw, i) => (
          <div
            key={i}
            className="fw-shockwave"
            style={{
              "--sw-color": sw.color,
              "--sw-delay": `${sw.delay}ms`,
              "--sw-dur": `${sw.dur}s`,
              "--sw-start": `${sw.start}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── 3. Anneaux hexagonaux SVG ── */}
      <svg className="fw-rings" viewBox="-300 -300 600 600" aria-hidden="true">
        {HEX_RINGS.map((ring, i) => (
          <g key={i} transform={`rotate(${ring.rot})`}>
            <path d={hexPath(60)} fill="none" stroke={ring.color} strokeWidth="2.5">
              <animateTransform
                attributeName="transform"
                type="scale"
                from="0.1"
                to="6"
                begin={`${ring.delay}s`}
                dur={`${ring.dur}s`}
                fill="freeze"
              />
              <animate
                attributeName="opacity"
                values="0.95;0"
                begin={`${ring.delay}s`}
                dur={`${ring.dur}s`}
                fill="freeze"
              />
              <animate
                attributeName="stroke-width"
                values="3;0.4"
                begin={`${ring.delay}s`}
                dur={`${ring.dur}s`}
                fill="freeze"
              />
            </path>
          </g>
        ))}
      </svg>

      {/* ── 4. Rayons radiaux ── */}
      <svg className="fw-rays" viewBox="-300 -300 600 600" aria-hidden="true">
        {FW_RAYS.map((ray, i) => (
          <g key={i} transform={`rotate(${ray.angle})`}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-360"
              stroke={ray.color}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0"
            >
              <animate
                attributeName="opacity"
                values="0;0.85;0"
                begin={`${ray.delay}ms`}
                dur="0.8s"
                fill="freeze"
              />
              <animate
                attributeName="stroke-width"
                values="3;0.3"
                begin={`${ray.delay}ms`}
                dur="0.8s"
                fill="freeze"
              />
            </line>
          </g>
        ))}
      </svg>

      {/* ── 5. Bandes scanline plein écran ── */}
      <div className="fw-scan fw-scan-h-1" aria-hidden="true" />
      <div className="fw-scan fw-scan-h-2" aria-hidden="true" />
      <div className="fw-scan fw-scan-v" aria-hidden="true" />

      {/* ── 6. Particules principales (70) ── */}
      <div className="fw-particles" aria-hidden="true">
        {FW_PARTICLES.map((p, i) => (
          <div
            key={i}
            className="fw-particle fw-particle-trail"
            style={{
              "--fw-tx": `${p.tx}px`,
              "--fw-ty": `${p.ty}px`,
              "--fw-color": p.color,
              "--fw-delay": `${p.delay}ms`,
              "--fw-dur": `${p.dur}ms`,
              "--fw-size": `${p.size}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── 7. Étincelles seconde vague (24) ── */}
      <div className="fw-particles fw-sparks" aria-hidden="true">
        {FW_SPARKS.map((p, i) => (
          <div
            key={i}
            className="fw-particle"
            style={{
              "--fw-tx": `${p.tx}px`,
              "--fw-ty": `${p.ty}px`,
              "--fw-color": p.color,
              "--fw-delay": `${p.delay}ms`,
              "--fw-dur": `${p.dur}ms`,
              "--fw-size": `${p.size}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── 8. Carte centrale ── */}
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        {/* Glitch RGB layers (faux décalage chromatique) */}
        <div className="confirm-glitch confirm-glitch-r" aria-hidden="true" />
        <div className="confirm-glitch confirm-glitch-c" aria-hidden="true" />

        {/* Scanline interne qui balaye la card */}
        <div className="confirm-scanline" aria-hidden="true" />

        {/* Coins déco type HUD */}
        <div className="confirm-corner tl" aria-hidden="true" />
        <div className="confirm-corner tr" aria-hidden="true" />
        <div className="confirm-corner bl" aria-hidden="true" />
        <div className="confirm-corner br" aria-hidden="true" />

        <div className="confirm-tag">
          {payload.kind === "new" ? "⬢ mesure initiée" : "⚡ dose administrée"}
        </div>

        <div className="confirm-mol-icon">
          <MoleculeIcon name={payload.name} />
        </div>

        <div className="confirm-name">{payload.name}</div>

        <div className="confirm-dose">
          <span className="v">{formatDose(payload.dose)}</span>
          <span className="u">{MASS_LABEL[payload.massUnit]}</span>
        </div>

        <div className="confirm-meta">
          {payload.kind === "new"
            ? "système · décroissance lancée"
            : "système · taux sanguin réinitialisé"}
        </div>

        <div className="confirm-hint">↵ cliquer pour fermer</div>
      </div>
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
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Supprimer la mesure de ${m.name}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Supprimer la mesure ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Vous êtes sur le point de supprimer la mesure de{" "}
                    <strong>{m.name}</strong>
                    {m.doses.length > 1 ? (
                      <>
                        {" "}
                        ({m.doses.length} prises, cumul{" "}
                        {formatDose(
                          m.doses.reduce((s, d) => s + d.amount, 0),
                        )}{" "}
                        {MASS_LABEL[m.massUnit]})
                      </>
                    ) : null}
                    . Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onRemove(m.id)}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
