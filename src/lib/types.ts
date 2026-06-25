export type Sport = "running" | "cycling" | "walking" | "generic";

export type StepKind = "warmup" | "work" | "recovery" | "cooldown" | "repeat";
export type DurationType = "time" | "distance" | "open";
export type DurationUnit = "seconds" | "minutes" | "meters" | "kilometers";
export type TargetType = "open" | "pace" | "speed" | "heart_rate" | "power" | "cadence" | "rpe";
export type Intensity = "active" | "rest" | "warmup" | "cooldown" | "recovery" | "interval";

export type WorkoutStep = {
  id: string;
  kind: StepKind;
  name: string;
  durationType: DurationType;
  durationValue?: number;
  durationUnit?: DurationUnit;
  targetType: TargetType;
  targetLow?: number;
  targetHigh?: number;
  targetZone?: number;
  targetUnit?: "min_per_km" | "kph" | "bpm" | "watts" | "rpm" | "rpe";
  intensity: Intensity;
  notes?: string;
  repeatTimes?: number;
  children?: WorkoutStep[];
};

export type Workout = {
  title: string;
  sport: Sport;
  sourceText: string;
  steps: WorkoutStep[];
  warnings: string[];
};

export type FlatFitStep = {
  messageIndex: number;
  name: string;
  durationType: "time" | "distance" | "open" | "repeat_until_steps_complete";
  durationValue: number;
  targetType: "open" | "speed" | "heart_rate" | "power" | "cadence";
  targetValue: number;
  customTargetLow: number;
  customTargetHigh: number;
  intensity: Intensity;
  notes?: string;
};
