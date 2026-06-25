import type { FlatFitStep, Sport, Workout, WorkoutStep } from "./types";
import { slugify } from "./utils";

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);

const BASE_TYPE = {
  ENUM: 0x00,
  UINT8: 0x02,
  UINT16: 0x84,
  UINT32: 0x86,
  STRING: 0x07,
  UINT32Z: 0x8c
} as const;

const MESG_NUM = {
  FILE_ID: 0,
  WORKOUT: 26,
  WORKOUT_STEP: 27
} as const;

const FILE = {
  WORKOUT: 5
} as const;

const MANUFACTURER = {
  DEVELOPMENT: 255
} as const;

const SPORT: Record<Sport, number> = {
  generic: 0,
  running: 1,
  cycling: 2,
  walking: 11
};

const WKT_STEP_DURATION = {
  TIME: 0,
  DISTANCE: 1,
  OPEN: 5,
  REPEAT_UNTIL_STEPS_CMPLT: 6
} as const;

const WKT_STEP_TARGET = {
  SPEED: 0,
  HEART_RATE: 1,
  OPEN: 2,
  CADENCE: 3,
  POWER: 4
} as const;

const INTENSITY = {
  active: 0,
  rest: 1,
  warmup: 2,
  cooldown: 3,
  recovery: 4,
  interval: 5
} as const;

type FieldDef = {
  num: number;
  size: number;
  baseType: number;
};

type DataValue = number | string;

const FILE_ID_FIELDS: FieldDef[] = [
  { num: 0, size: 1, baseType: BASE_TYPE.ENUM },
  { num: 1, size: 2, baseType: BASE_TYPE.UINT16 },
  { num: 2, size: 2, baseType: BASE_TYPE.UINT16 },
  { num: 3, size: 4, baseType: BASE_TYPE.UINT32Z },
  { num: 4, size: 4, baseType: BASE_TYPE.UINT32 }
];

const WORKOUT_NAME_SIZE = 48;
const WORKOUT_STEP_NAME_SIZE = 48;
const WORKOUT_STEP_NOTES_SIZE = 80;

const WORKOUT_FIELDS: FieldDef[] = [
  { num: 4, size: 1, baseType: BASE_TYPE.ENUM },
  { num: 6, size: 2, baseType: BASE_TYPE.UINT16 },
  { num: 8, size: WORKOUT_NAME_SIZE, baseType: BASE_TYPE.STRING }
];

const WORKOUT_STEP_FIELDS: FieldDef[] = [
  { num: 254, size: 2, baseType: BASE_TYPE.UINT16 },
  { num: 0, size: WORKOUT_STEP_NAME_SIZE, baseType: BASE_TYPE.STRING },
  { num: 1, size: 1, baseType: BASE_TYPE.ENUM },
  { num: 2, size: 4, baseType: BASE_TYPE.UINT32 },
  { num: 3, size: 1, baseType: BASE_TYPE.ENUM },
  { num: 4, size: 4, baseType: BASE_TYPE.UINT32 },
  { num: 5, size: 4, baseType: BASE_TYPE.UINT32 },
  { num: 6, size: 4, baseType: BASE_TYPE.UINT32 },
  { num: 7, size: 1, baseType: BASE_TYPE.ENUM },
  { num: 8, size: WORKOUT_STEP_NOTES_SIZE, baseType: BASE_TYPE.STRING }
];

class ByteWriter {
  private bytes: number[] = [];

  u8(value: number) {
    this.bytes.push(value & 0xff);
  }

  u16(value: number) {
    this.bytes.push(value & 0xff, (value >> 8) & 0xff);
  }

  u32(value: number) {
    const safe = value >>> 0;
    this.bytes.push(safe & 0xff, (safe >> 8) & 0xff, (safe >> 16) & 0xff, (safe >> 24) & 0xff);
  }

  str(value: string, size: number) {
    const encoded = new TextEncoder().encode(value.slice(0, Math.max(0, size - 1)));
    for (let i = 0; i < size; i++) this.bytes.push(encoded[i] || 0);
  }

  concat(bytes: Uint8Array) {
    for (const byte of bytes) this.bytes.push(byte);
  }

  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
}

export function encodeWorkoutToFit(workout: Workout): Uint8Array {
  const flatSteps = flattenWorkoutSteps(workout.steps);
  const data = new ByteWriter();

  writeDefinition(data, 0, MESG_NUM.FILE_ID, FILE_ID_FIELDS);
  writeDataRecord(data, 0, FILE_ID_FIELDS, [
    FILE.WORKOUT,
    MANUFACTURER.DEVELOPMENT,
    0,
    Math.floor(Math.random() * 0xffffffff),
    fitTimestamp(new Date())
  ]);

  writeDefinition(data, 1, MESG_NUM.WORKOUT, WORKOUT_FIELDS);
  writeDataRecord(data, 1, WORKOUT_FIELDS, [
    SPORT[workout.sport] ?? SPORT.running,
    flatSteps.length,
    safeFitString(workout.title || "Workout", WORKOUT_NAME_SIZE)
  ]);

  writeDefinition(data, 2, MESG_NUM.WORKOUT_STEP, WORKOUT_STEP_FIELDS);
  for (const step of flatSteps) {
    writeDataRecord(data, 2, WORKOUT_STEP_FIELDS, [
      step.messageIndex,
      safeFitString(step.name, WORKOUT_STEP_NAME_SIZE),
      fitDurationType(step),
      Math.max(0, Math.round(step.durationValue)),
      fitTargetType(step),
      Math.max(0, Math.round(step.targetValue)),
      Math.max(0, Math.round(step.customTargetLow)),
      Math.max(0, Math.round(step.customTargetHigh)),
      INTENSITY[step.intensity] ?? INTENSITY.active,
      safeFitString(step.notes || "", WORKOUT_STEP_NOTES_SIZE)
    ]);
  }

  const dataBytes = data.toUint8Array();
  const header = writeHeader(dataBytes.length);
  const body = concatUint8(header, dataBytes);
  const fileCrc = crc16(body);
  const out = new ByteWriter();
  out.concat(body);
  out.u16(fileCrc);
  return out.toUint8Array();
}

export function fitFilename(workout: Workout) {
  return `${slugify(workout.title || "workout")}.fit`;
}

export function flattenWorkoutSteps(steps: WorkoutStep[]): FlatFitStep[] {
  const flat: FlatFitStep[] = [];

  const addNormalStep = (step: WorkoutStep) => {
    const fitStep = convertStep(step, flat.length);
    flat.push(fitStep);
  };

  for (const step of steps) {
    if (step.kind === "repeat" && step.children?.length) {
      const repeatStart = flat.length;
      step.children.forEach(addNormalStep);
      const totalRepeats = Math.max(1, Math.round(step.repeatTimes || 1));
      if (totalRepeats > 1) {
        flat.push({
          messageIndex: flat.length,
          name: `Repetir ${totalRepeats}x`,
          durationType: "repeat_until_steps_complete",
          durationValue: repeatStart,
          targetType: "open",
          targetValue: totalRepeats - 1,
          customTargetLow: 0,
          customTargetHigh: 0,
          intensity: "interval",
          notes: `FIT usa el primer bloque ya escrito y repite ${totalRepeats - 1} veces para completar ${totalRepeats} vueltas.`
        });
      }
    } else {
      addNormalStep(step);
    }
  }

  return flat;
}

function convertStep(step: WorkoutStep, messageIndex: number): FlatFitStep {
  const duration = encodeDuration(step);
  const target = encodeTarget(step);

  return {
    messageIndex,
    name: step.name || `Step ${messageIndex + 1}`,
    durationType: duration.type,
    durationValue: duration.value,
    targetType: target.type,
    targetValue: target.value,
    customTargetLow: target.low,
    customTargetHigh: target.high,
    intensity: step.intensity,
    notes: step.notes || ""
  };
}

function encodeDuration(step: WorkoutStep): { type: FlatFitStep["durationType"]; value: number } {
  if (step.durationType === "open") return { type: "open", value: 0 };
  if (!step.durationValue || !step.durationUnit) return { type: "open", value: 0 };

  if (step.durationType === "time") {
    const seconds = step.durationUnit === "minutes" ? step.durationValue * 60 : step.durationValue;
    return { type: "time", value: seconds * 1000 };
  }

  const meters = step.durationUnit === "kilometers" ? step.durationValue * 1000 : step.durationValue;
  return { type: "distance", value: meters * 100 };
}

function encodeTarget(step: WorkoutStep): { type: FlatFitStep["targetType"]; value: number; low: number; high: number } {
  if (step.targetType === "pace") {
    if (step.targetLow && step.targetHigh) {
      const slowestPace = Math.max(step.targetLow, step.targetHigh);
      const fastestPace = Math.min(step.targetLow, step.targetHigh);
      return {
        type: "speed",
        value: 0,
        low: speedMetersPerSecondScaled(slowestPace),
        high: speedMetersPerSecondScaled(fastestPace)
      };
    }
    return { type: "open", value: 0, low: 0, high: 0 };
  }

  if (step.targetType === "speed") {
    if (step.targetLow && step.targetHigh) {
      return { type: "speed", value: 0, low: kphToMetersPerSecondScaled(step.targetLow), high: kphToMetersPerSecondScaled(step.targetHigh) };
    }
    if (step.targetZone) return { type: "speed", value: step.targetZone, low: 0, high: 0 };
  }

  if (step.targetType === "heart_rate") {
    if (step.targetZone) return { type: "heart_rate", value: step.targetZone, low: 0, high: 0 };
    if (step.targetLow && step.targetHigh) return { type: "heart_rate", value: 0, low: step.targetLow + 100, high: step.targetHigh + 100 };
  }

  if (step.targetType === "power") {
    if (step.targetZone) return { type: "power", value: step.targetZone, low: 0, high: 0 };
    if (step.targetLow && step.targetHigh) return { type: "power", value: 0, low: step.targetLow + 1000, high: step.targetHigh + 1000 };
  }

  if (step.targetType === "cadence") {
    if (step.targetLow && step.targetHigh) return { type: "cadence", value: 0, low: step.targetLow, high: step.targetHigh };
    if (step.targetZone) return { type: "cadence", value: step.targetZone, low: 0, high: 0 };
  }

  return { type: "open", value: 0, low: 0, high: 0 };
}

function fitDurationType(step: FlatFitStep) {
  if (step.durationType === "time") return WKT_STEP_DURATION.TIME;
  if (step.durationType === "distance") return WKT_STEP_DURATION.DISTANCE;
  if (step.durationType === "repeat_until_steps_complete") return WKT_STEP_DURATION.REPEAT_UNTIL_STEPS_CMPLT;
  return WKT_STEP_DURATION.OPEN;
}

function fitTargetType(step: FlatFitStep) {
  if (step.targetType === "speed") return WKT_STEP_TARGET.SPEED;
  if (step.targetType === "heart_rate") return WKT_STEP_TARGET.HEART_RATE;
  if (step.targetType === "cadence") return WKT_STEP_TARGET.CADENCE;
  if (step.targetType === "power") return WKT_STEP_TARGET.POWER;
  return WKT_STEP_TARGET.OPEN;
}

function speedMetersPerSecondScaled(secondsPerKm: number) {
  return Math.round((1000 / secondsPerKm) * 1000);
}

function kphToMetersPerSecondScaled(kph: number) {
  return Math.round((kph / 3.6) * 1000);
}

function writeHeader(dataSize: number) {
  const writer = new ByteWriter();
  writer.u8(12); // FIT header size without optional header CRC.
  writer.u8(0x10); // FIT protocol v1.0.
  writer.u16(21205); // FIT profile 21.205.0.
  writer.u32(dataSize);
  writer.u8(0x2e);
  writer.u8(0x46);
  writer.u8(0x49);
  writer.u8(0x54);
  return writer.toUint8Array();
}

function writeDefinition(writer: ByteWriter, localMesgNum: number, globalMesgNum: number, fields: FieldDef[]) {
  writer.u8(0x40 | (localMesgNum & 0x0f));
  writer.u8(0);
  writer.u8(0); // little endian architecture
  writer.u16(globalMesgNum);
  writer.u8(fields.length);
  for (const field of fields) {
    writer.u8(field.num);
    writer.u8(field.size);
    writer.u8(field.baseType);
  }
}

function writeDataRecord(writer: ByteWriter, localMesgNum: number, fields: FieldDef[], values: DataValue[]) {
  writer.u8(localMesgNum & 0x0f);
  fields.forEach((field, index) => writeValue(writer, field, values[index]));
}

function writeValue(writer: ByteWriter, field: FieldDef, value: DataValue) {
  if (field.baseType === BASE_TYPE.STRING) {
    writer.str(String(value ?? ""), field.size);
    return;
  }

  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (field.size === 1) writer.u8(numeric);
  else if (field.size === 2) writer.u16(numeric);
  else if (field.size === 4) writer.u32(numeric);
  else {
    for (let i = 0; i < field.size; i++) writer.u8(0);
  }
}

function fitTimestamp(date: Date) {
  return Math.max(0, Math.floor((date.getTime() - FIT_EPOCH_MS) / 1000));
}

function safeFitString(value: string, maxBytes: number) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  const encoder = new TextEncoder();
  let out = clean;
  while (encoder.encode(out).length > maxBytes - 1) out = out.slice(0, -1);
  return out;
}

function concatUint8(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

const CRC_TABLE = [
  0x0000,
  0xcc01,
  0xd801,
  0x1400,
  0xf001,
  0x3c00,
  0x2800,
  0xe401,
  0xa001,
  0x6c00,
  0x7800,
  0xb401,
  0x5000,
  0x9c01,
  0x8801,
  0x4400
];

function crc16(bytes: Uint8Array) {
  let crc = 0;
  for (const byte of bytes) {
    let tmp = CRC_TABLE[crc & 0x0f];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0x0f];
    tmp = CRC_TABLE[crc & 0x0f];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0x0f];
  }
  return crc & 0xffff;
}
