import type { Sport, Workout, WorkoutStep, DurationType, DurationUnit, TargetType, Intensity } from "./types";
import { paceToSecondsPerKm, uid } from "./utils";

type ParsedTarget = Pick<WorkoutStep, "targetType" | "targetLow" | "targetHigh" | "targetZone" | "targetUnit" | "notes"> & {
  warning?: string;
};

const DEFAULT_EXAMPLES = [
  "20' suave + 6x800m a 4:30/km rec 2' trote + 10' suave",
  "15 min Z2 + 3x10 min tempo rec 3 min + 10 min cool down",
  "Fondo progresivo: 30 min suave + 30 min moderado + 15 min fuerte",
  "10' entrada + 12x1' fuerte rec 1' suave + 10' vuelta"
];

export { DEFAULT_EXAMPLES };

export function parseNaturalWorkout(input: string, sport: Sport): Workout {
  const raw = input.trim();
  const warnings: string[] = [];

  if (!raw) {
    return {
      title: "Nuevo entrenamiento",
      sport,
      sourceText: input,
      steps: [],
      warnings: ["Ingresá un entrenamiento antes de interpretar."]
    };
  }

  const title = inferTitle(raw, sport);
  const normalized = normalizeText(raw);
  const segments = splitSegments(normalized);
  const steps: WorkoutStep[] = [];

  for (const segment of segments) {
    const parsed = parseSegment(segment, warnings);
    if (parsed) steps.push(parsed);
  }

  if (steps.length === 0) {
    warnings.push("No pude detectar bloques claros. Probá con formato tipo: 20' suave + 6x800m a 4:30/km rec 2' + 10' suave.");
  }

  if (!steps.some((step) => step.kind === "warmup")) {
    warnings.push("No detecté entrada en calor. Podés agregarla manualmente si corresponde.");
  }

  if (!steps.some((step) => step.kind === "cooldown")) {
    warnings.push("No detecté vuelta a la calma. Podés agregarla manualmente si corresponde.");
  }

  return { title, sport, sourceText: input, steps, warnings };
}

function inferTitle(raw: string, sport: Sport) {
  const firstLine = raw.split(/\n/).map((x) => x.trim()).find(Boolean) || "";
  const titleMatch = firstLine.match(/^(?:titulo|título|nombre|workout)\s*:\s*(.+)$/i);
  if (titleMatch) return cleanTitle(titleMatch[1]);

  const lower = raw.toLowerCase();
  if (/\b(800|400|1000|mile|milla|series|interval|intervalos)\b/.test(lower) || /\d+\s*x\s*\d+/.test(lower)) return "Series running";
  if (/\btempo|umbral|threshold\b/.test(lower)) return "Tempo run";
  if (/\bfondo|long run|larga\b/.test(lower)) return "Fondo";
  if (/\bprogresivo|progressive\b/.test(lower)) return "Progresivo";
  if (/\bfartlek\b/.test(lower)) return "Fartlek";
  return sport === "running" ? "Running workout" : "Workout";
}

function cleanTitle(value: string) {
  return value.replace(/[+;].*$/, "").trim().slice(0, 40) || "Workout";
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/entrada en calor/gi, "warmup")
    .replace(/calentamiento/gi, "warmup")
    .replace(/vuelta a la calma/gi, "cooldown")
    .replace(/enfriamiento/gi, "cooldown")
    .replace(/cool down/gi, "cooldown")
    .replace(/recuperación/gi, "rec")
    .replace(/recuperacion/gi, "rec")
    .replace(/recovery/gi, "rec")
    .replace(/trote/gi, "suave")
    .replace(/minutos/gi, "min")
    .replace(/minuto/gi, "min")
    .replace(/segundos/gi, "seg")
    .replace(/segundo/gi, "seg");
}

function splitSegments(value: string) {
  const noTitle = value
    .split(/\n/)
    .filter((line) => !/^(?:titulo|título|nombre|workout)\s*:/i.test(line.trim()))
    .join(" + ");

  return noTitle
    .replace(/:/g, "+")
    .split(/\s*(?:\+|;|\n)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseSegment(segment: string, warnings: string[]): WorkoutStep | null {
  const repeat = parseRepeatSegment(segment, warnings);
  if (repeat) return repeat;
  return parseSimpleStep(segment, warnings);
}

function parseRepeatSegment(segment: string, warnings: string[]): WorkoutStep | null {
  const repeatMatch = segment.match(/(\d{1,2})\s*x\s*(\d+(?:[.,]\d+)?)\s*(km|m|min|'|seg|s)\b/i);
  if (!repeatMatch) return null;

  const times = Number(repeatMatch[1]);
  const value = parseNumber(repeatMatch[2]);
  const unitRaw = repeatMatch[3].toLowerCase();
  const workDuration = quantityFromUnit(value, unitRaw);
  const target = parseTarget(segment, warnings);

  const work: WorkoutStep = {
    id: uid(),
    kind: "work",
    name: buildWorkName(value, unitRaw, target),
    durationType: workDuration.durationType,
    durationValue: workDuration.durationValue,
    durationUnit: workDuration.durationUnit,
    targetType: target.targetType,
    targetLow: target.targetLow,
    targetHigh: target.targetHigh,
    targetZone: target.targetZone,
    targetUnit: target.targetUnit,
    notes: target.notes,
    intensity: inferIntensity(segment, "work")
  };

  const children: WorkoutStep[] = [work];
  const rec = parseRecovery(segment, warnings);
  if (rec) children.push(rec);

  if (times <= 1) warnings.push("Detecté una repetición x1. La dejé como grupo repetitivo, pero probablemente convenga convertirla en bloque simple.");

  return {
    id: uid("repeat"),
    kind: "repeat",
    name: `${times} x ${value}${unitRaw}`,
    durationType: "open",
    targetType: "open",
    intensity: "interval",
    repeatTimes: times,
    children
  };
}

function parseSimpleStep(segment: string, warnings: string[]): WorkoutStep | null {
  const lower = segment.toLowerCase();
  const quantity = parseQuantity(segment);
  const target = parseTarget(segment, warnings);
  const kind = inferKind(lower);
  const intensity = inferIntensity(lower, kind);

  if (!quantity) {
    if (/lap|manual|libre|open|hasta/i.test(segment)) {
      return {
        id: uid(),
        kind,
        name: labelForKind(kind, segment),
        durationType: "open",
        targetType: target.targetType,
        targetLow: target.targetLow,
        targetHigh: target.targetHigh,
        targetZone: target.targetZone,
        targetUnit: target.targetUnit,
        notes: target.notes || segment,
        intensity
      };
    }
    warnings.push(`No pude interpretar duración/distancia en: “${segment}”.`);
    return null;
  }

  return {
    id: uid(),
    kind,
    name: labelForKind(kind, segment),
    durationType: quantity.durationType,
    durationValue: quantity.durationValue,
    durationUnit: quantity.durationUnit,
    targetType: target.targetType,
    targetLow: target.targetLow,
    targetHigh: target.targetHigh,
    targetZone: target.targetZone,
    targetUnit: target.targetUnit,
    notes: target.notes,
    intensity
  };
}

function parseQuantity(segment: string): { durationType: DurationType; durationValue: number; durationUnit: DurationUnit } | null {
  const distanceKm = segment.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
  if (distanceKm) return { durationType: "distance", durationValue: parseNumber(distanceKm[1]), durationUnit: "kilometers" };

  const distanceM = segment.match(/(\d+(?:[.,]\d+)?)\s*m\b/i);
  if (distanceM && !/min\b/i.test(distanceM[0])) return { durationType: "distance", durationValue: parseNumber(distanceM[1]), durationUnit: "meters" };

  const quotedMinutes = segment.match(/(\d+(?:[.,]\d+)?)\s*'/);
  if (quotedMinutes) return { durationType: "time", durationValue: parseNumber(quotedMinutes[1]), durationUnit: "minutes" };

  const minutes = segment.match(/(\d+(?:[.,]\d+)?)\s*min\b/i);
  if (minutes) return { durationType: "time", durationValue: parseNumber(minutes[1]), durationUnit: "minutes" };

  const seconds = segment.match(/(\d+(?:[.,]\d+)?)\s*(?:seg|s|''|”)\b/i);
  if (seconds) return { durationType: "time", durationValue: parseNumber(seconds[1]), durationUnit: "seconds" };

  const implicitMinutes = segment.match(/^\s*(\d+(?:[.,]\d+)?)\s+(?:suave|moderado|fuerte|tempo|z[1-5]|regenerativo|progresivo)/i);
  if (implicitMinutes) return { durationType: "time", durationValue: parseNumber(implicitMinutes[1]), durationUnit: "minutes" };

  return null;
}

function quantityFromUnit(value: number, unitRaw: string): { durationType: DurationType; durationValue: number; durationUnit: DurationUnit } {
  if (unitRaw === "km") return { durationType: "distance", durationValue: value, durationUnit: "kilometers" };
  if (unitRaw === "m") return { durationType: "distance", durationValue: value, durationUnit: "meters" };
  if (unitRaw === "seg" || unitRaw === "s") return { durationType: "time", durationValue: value, durationUnit: "seconds" };
  return { durationType: "time", durationValue: value, durationUnit: "minutes" };
}

function parseRecovery(segment: string, warnings: string[]): WorkoutStep | null {
  const recIndex = segment.toLowerCase().search(/\brec\b/);
  if (recIndex < 0) return null;
  const recText = segment.slice(recIndex).replace(/^\s*rec\s*/i, "").trim();
  const quantity = parseQuantity(recText);
  const target = parseTarget(recText || "suave", warnings, true);

  if (!quantity) {
    warnings.push(`Detecté recuperación pero no pude interpretar su duración/distancia en: “${segment}”.`);
    return null;
  }

  return {
    id: uid(),
    kind: "recovery",
    name: "Recuperación",
    durationType: quantity.durationType,
    durationValue: quantity.durationValue,
    durationUnit: quantity.durationUnit,
    targetType: target.targetType || "heart_rate",
    targetLow: target.targetLow,
    targetHigh: target.targetHigh,
    targetZone: target.targetZone || 1,
    targetUnit: target.targetUnit,
    notes: target.notes,
    intensity: "recovery"
  };
}

function parseTarget(segment: string, warnings: string[], recovery = false): ParsedTarget {
  const lower = segment.toLowerCase();

  const paceRange = lower.match(/(\d{1,2}[:.]\d{2})\s*(?:-|a|–)\s*(\d{1,2}[:.]\d{2})\s*(?:\/\s*km|\/km|min\/km)?/i);
  if (paceRange) {
    const p1 = paceToSecondsPerKm(paceRange[1]);
    const p2 = paceToSecondsPerKm(paceRange[2]);
    if (p1 && p2) {
      return { targetType: "pace", targetLow: Math.min(p1, p2), targetHigh: Math.max(p1, p2), targetUnit: "min_per_km" };
    }
  }

  const singlePace = lower.match(/(?:a|@|pace|ritmo)\s*(\d{1,2}[:.]\d{2})\s*(?:\/\s*km|\/km|min\/km)?/i);
  if (singlePace) {
    const seconds = paceToSecondsPerKm(singlePace[1]);
    if (seconds) return { targetType: "pace", targetLow: seconds - 5, targetHigh: seconds + 5, targetUnit: "min_per_km" };
  }

  const hrRange = lower.match(/(\d{2,3})\s*(?:-|a|–)\s*(\d{2,3})\s*(?:bpm|ppm|fc)/i);
  if (hrRange) return { targetType: "heart_rate", targetLow: Number(hrRange[1]), targetHigh: Number(hrRange[2]), targetUnit: "bpm" };

  const hrZone = lower.match(/(?:z|zona)\s*([1-5])/i);
  if (hrZone) return { targetType: "heart_rate", targetZone: Number(hrZone[1]) };

  const powerRange = lower.match(/(\d{2,4})\s*(?:-|a|–)\s*(\d{2,4})\s*(?:w|watts|watt)/i);
  if (powerRange) return { targetType: "power", targetLow: Number(powerRange[1]), targetHigh: Number(powerRange[2]), targetUnit: "watts" };

  const cadenceRange = lower.match(/(\d{2,3})\s*(?:-|a|–)\s*(\d{2,3})\s*(?:spm|rpm|cadencia)/i);
  if (cadenceRange) return { targetType: "cadence", targetLow: Number(cadenceRange[1]), targetHigh: Number(cadenceRange[2]), targetUnit: "rpm" };

  const rpe = lower.match(/rpe\s*([1-9]|10)/i);
  if (rpe) {
    warnings.push("RPE no es un target FIT estándar para Garmin Workout. Lo guardé como nota y target abierto.");
    return { targetType: "rpe", targetLow: Number(rpe[1]), targetUnit: "rpe", notes: `RPE ${rpe[1]}` };
  }

  if (/regenerativo|muy suave|easy/i.test(lower)) return { targetType: "heart_rate", targetZone: 1, notes: "Asumido como FC Z1" };
  if (/suave|easy|aer[oó]bico/i.test(lower)) return { targetType: "heart_rate", targetZone: recovery ? 1 : 2, notes: recovery ? "Asumido como FC Z1" : "Asumido como FC Z2" };
  if (/moderado|steady/i.test(lower)) return { targetType: "heart_rate", targetZone: 3, notes: "Asumido como FC Z3" };
  if (/tempo|umbral|threshold/i.test(lower)) return { targetType: "heart_rate", targetZone: 3, notes: "Asumido como FC Z3" };
  if (/fuerte|hard|interval/i.test(lower)) return { targetType: "heart_rate", targetZone: 4, notes: "Asumido como FC Z4" };
  if (/sprint|muy fuerte|all out/i.test(lower)) return { targetType: "heart_rate", targetZone: 5, notes: "Asumido como FC Z5" };

  return { targetType: "open", notes: segment };
}

function inferKind(lower: string): WorkoutStep["kind"] {
  if (/warmup|entrada|calent/i.test(lower)) return "warmup";
  if (/cooldown|vuelta|enfri/i.test(lower)) return "cooldown";
  if (/rec\b|recuper/i.test(lower)) return "recovery";
  return "work";
}

function inferIntensity(lower: string, kind: WorkoutStep["kind"]): Intensity {
  if (kind === "warmup") return "warmup";
  if (kind === "cooldown") return "cooldown";
  if (kind === "recovery") return "recovery";
  if (/fuerte|sprint|interval|series|tempo|umbral|threshold/i.test(lower)) return "interval";
  if (/suave|regenerativo/i.test(lower)) return "active";
  return "active";
}

function labelForKind(kind: WorkoutStep["kind"], segment: string) {
  if (kind === "warmup") return "Entrada en calor";
  if (kind === "cooldown") return "Vuelta a la calma";
  if (kind === "recovery") return "Recuperación";
  if (/fondo|long run/i.test(segment)) return "Fondo";
  if (/tempo|umbral|threshold/i.test(segment)) return "Tempo";
  if (/progresivo|progressive/i.test(segment)) return "Progresivo";
  return "Bloque";
}

function buildWorkName(value: number, unitRaw: string, target: ParsedTarget) {
  const unitLabel = unitRaw === "'" ? "min" : unitRaw;
  if (target.targetType === "pace") return `${value}${unitLabel} a ritmo`;
  if (target.targetType === "heart_rate" && target.targetZone) return `${value}${unitLabel} FC Z${target.targetZone}`;
  return `${value}${unitLabel} trabajo`;
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
}
