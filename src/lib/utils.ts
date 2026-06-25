import type { WorkoutStep } from "./types";

export function uid(prefix = "step") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workout";
}

export function paceToSecondsPerKm(pace: string) {
  const match = pace.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function secondsPerKmToMinKm(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

export function cloneStep(step: WorkoutStep): WorkoutStep {
  return {
    ...step,
    id: uid("step"),
    children: step.children?.map(cloneStep)
  };
}

export function formatDuration(step: WorkoutStep) {
  if (step.durationType === "open") return "Hasta lap/manual";
  if (!step.durationValue || !step.durationUnit) return "Sin duración";
  const unitLabels: Record<string, string> = {
    seconds: "seg",
    minutes: "min",
    meters: "m",
    kilometers: "km"
  };
  return `${step.durationValue} ${unitLabels[step.durationUnit]}`;
}

export function formatTarget(step: WorkoutStep) {
  if (step.targetType === "open") return step.notes || "Sin objetivo";
  if (step.targetType === "rpe") return `RPE ${step.targetLow ?? step.targetHigh ?? ""}`.trim();
  if (step.targetZone) {
    if (step.targetType === "heart_rate") return `FC Z${step.targetZone}`;
    if (step.targetType === "power") return `Potencia Z${step.targetZone}`;
    if (step.targetType === "speed" || step.targetType === "pace") return `Velocidad/Pace Z${step.targetZone}`;
  }
  const unit = step.targetUnit === "min_per_km" ? "/km" : step.targetUnit || "";
  if (step.targetType === "pace" && step.targetLow && step.targetHigh) {
    return `${secondsPerKmToMinKm(step.targetLow)} - ${secondsPerKmToMinKm(step.targetHigh)}`;
  }
  if (step.targetLow && step.targetHigh) return `${step.targetLow} - ${step.targetHigh} ${unit}`.trim();
  if (step.targetLow) return `${step.targetLow} ${unit}`.trim();
  return step.notes || "Objetivo";
}

export function summarizeWorkout(steps: WorkoutStep[]) {
  let seconds = 0;
  let meters = 0;

  const add = (step: WorkoutStep, multiplier = 1) => {
    if (step.kind === "repeat" && step.children?.length) {
      step.children.forEach((child) => add(child, multiplier * (step.repeatTimes || 1)));
      return;
    }
    if (step.durationType === "time" && step.durationValue && step.durationUnit) {
      seconds += multiplier * (step.durationUnit === "minutes" ? step.durationValue * 60 : step.durationValue);
    }
    if (step.durationType === "distance" && step.durationValue && step.durationUnit) {
      meters += multiplier * (step.durationUnit === "kilometers" ? step.durationValue * 1000 : step.durationValue);
    }
  };

  steps.forEach((step) => add(step));
  return {
    durationLabel: seconds ? `${Math.round(seconds / 60)} min` : "—",
    distanceLabel: meters ? `${(meters / 1000).toFixed(2)} km` : "—",
    seconds,
    meters
  };
}
