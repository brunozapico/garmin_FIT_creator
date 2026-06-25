import { useMemo, useState } from "react";
import { encodeWorkoutToFit, fitFilename, flattenWorkoutSteps } from "./lib/fitEncoder";
import { DEFAULT_EXAMPLES, parseNaturalWorkout } from "./lib/parser";
import type { Sport, TargetType, Workout, WorkoutStep } from "./lib/types";
import { cloneStep, formatDuration, formatTarget, summarizeWorkout, uid } from "./lib/utils";

const DEFAULT_TEXT = "20' suave + 6x800m a 4:30/km rec 2' trote + 10' suave";

const TARGET_OPTIONS: { value: TargetType; label: string }[] = [
  { value: "open", label: "Sin objetivo" },
  { value: "pace", label: "Ritmo min/km" },
  { value: "heart_rate", label: "Frecuencia cardíaca" },
  { value: "power", label: "Potencia" },
  { value: "cadence", label: "Cadencia" },
  { value: "rpe", label: "RPE como nota" }
];

export default function App() {
  const [sport, setSport] = useState<Sport>("running");
  const [input, setInput] = useState(DEFAULT_TEXT);
  const [workout, setWorkout] = useState<Workout>(() => parseNaturalWorkout(DEFAULT_TEXT, "running"));
  const summary = useMemo(() => summarizeWorkout(workout.steps), [workout.steps]);
  const flatSteps = useMemo(() => flattenWorkoutSteps(workout.steps), [workout.steps]);

  function interpret() {
    setWorkout(parseNaturalWorkout(input, sport));
  }

  function downloadFit() {
    if (!workout.steps.length) return;
    const bytes = encodeWorkoutToFit(workout);
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fitFilename(workout);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const updateStep = (path: number[], updater: (step: WorkoutStep) => WorkoutStep) => {
    setWorkout((current) => ({ ...current, steps: updateStepAtPath(current.steps, path, updater) }));
  };

  const deleteStep = (path: number[]) => {
    setWorkout((current) => ({ ...current, steps: deleteStepAtPath(current.steps, path) }));
  };

  function addSimpleStep() {
    const step: WorkoutStep = {
      id: uid(), kind: "work", name: "Nuevo bloque", durationType: "time", durationValue: 10, durationUnit: "minutes",
      targetType: "open", intensity: "active", notes: ""
    };
    setWorkout((current) => ({ ...current, steps: [...current.steps, step] }));
  }

  function addRepeatStep() {
    const step: WorkoutStep = {
      id: uid("repeat"), kind: "repeat", name: "Nuevo repeat", durationType: "open", targetType: "open", intensity: "interval", repeatTimes: 4,
      children: [
        { id: uid(), kind: "work", name: "Trabajo", durationType: "time", durationValue: 2, durationUnit: "minutes", targetType: "heart_rate", targetZone: 4, intensity: "interval" },
        { id: uid(), kind: "recovery", name: "Recuperación", durationType: "time", durationValue: 1, durationUnit: "minutes", targetType: "heart_rate", targetZone: 1, intensity: "recovery" }
      ]
    };
    setWorkout((current) => ({ ...current, steps: [...current.steps, step] }));
  }

  return (
    <main className="container">
      <section className="hero">
        <div className="eyebrow">Garmin .FIT Workout Builder</div>
        <h1>De lenguaje natural a workout estructurado para Garmin.</h1>
        <p>Sin API, sin login y sin Garmin Connect manual. Interpretá, previsualizá, corregí y descargá el archivo <span className="code">.FIT</span>.</p>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Carga rápida</h2>
          <p>Escribí como lo tenés en papel. Soporta series, recuperaciones, ritmo, FC, potencia, cadencia y RPE como nota.</p>

          <div className="field">
            <label htmlFor="sport">Deporte</label>
            <select id="sport" value={sport} onChange={(event) => setSport(event.target.value as Sport)}>
              <option value="running">Running</option>
              <option value="cycling">Ciclismo</option>
              <option value="walking">Caminata</option>
              <option value="generic">Genérico</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="source">Entrenamiento</label>
            <textarea id="source" value={input} onChange={(event) => setInput(event.target.value)} />
          </div>

          <div className="actions">
            <button className="button primary" onClick={interpret}>Interpretar y previsualizar</button>
            <button className="button" onClick={() => setInput("")}>Limpiar</button>
          </div>

          <div className="examples">
            <label>Ejemplos</label>
            {DEFAULT_EXAMPLES.map((example) => (
              <button key={example} className="example" onClick={() => { setInput(example); setWorkout(parseNaturalWorkout(example, sport)); }}>
                {example}
              </button>
            ))}
          </div>

          <div className="instructions">
            <h3>Carga al Forerunner 965</h3>
            <ol>
              <li>Descargá el <span className="code">.FIT</span>.</li>
              <li>Conectá el reloj por USB.</li>
              <li>Copialo a <span className="code">GARMIN/NewFiles</span>. Si no aparece, probá <span className="code">GARMIN/Workouts</span>.</li>
              <li>Expulsá el reloj y buscá el workout en Training / Workouts.</li>
            </ol>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Preview editable</h2>
              <p>Esto se convertirá a mensajes FIT <span className="code">workout</span> y <span className="code">workout_step</span>.</p>
            </div>
          </div>

          {workout.steps.length ? (
            <>
              <div className="field">
                <label htmlFor="title">Nombre del workout en Garmin</label>
                <input id="title" value={workout.title} onChange={(event) => setWorkout((current) => ({ ...current, title: event.target.value }))} />
              </div>

              <div className="summary">
                <div className="stat"><strong>{summary.durationLabel}</strong><span>Duración estimada</span></div>
                <div className="stat"><strong>{summary.distanceLabel}</strong><span>Distancia estimada</span></div>
                <div className="stat"><strong>{flatSteps.length}</strong><span>FIT steps reales</span></div>
              </div>

              {workout.warnings.length > 0 && (
                <div className="warningBox"><strong>Revisar antes de descargar</strong><ul>{workout.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
              )}

              <div className="row marginBottom">
                <button className="smallButton" onClick={addSimpleStep}>+ Bloque simple</button>
                <button className="smallButton" onClick={addRepeatStep}>+ Repeat</button>
                <button className="button primary" onClick={downloadFit}>Descargar .FIT</button>
              </div>

              <div className="steps">
                {workout.steps.map((step, index) => (
                  <StepEditor key={step.id} step={step} path={[index]} onUpdate={updateStep} onDelete={deleteStep} />
                ))}
              </div>

              <p className="footerNote">Nota: en FIT los targets de ritmo se codifican como velocidad. Para running, el Garmin normalmente los muestra como ritmo.</p>
            </>
          ) : (
            <div className="empty"><div><h3>Sin workout interpretado</h3><p>Escribí un entrenamiento y previsualizalo.</p></div></div>
          )}
        </div>
      </section>
    </main>
  );
}

function StepEditor({ step, path, onUpdate, onDelete }: {
  step: WorkoutStep;
  path: number[];
  onUpdate: (path: number[], updater: (step: WorkoutStep) => WorkoutStep) => void;
  onDelete: (path: number[]) => void;
}) {
  const isRepeat = step.kind === "repeat";
  const set = (patch: Partial<WorkoutStep>) => onUpdate(path, (current) => ({ ...current, ...patch }));

  function addChild() {
    onUpdate(path, (current) => ({
      ...current,
      children: [...(current.children || []), { id: uid(), kind: "work", name: "Trabajo", durationType: "time", durationValue: 1, durationUnit: "minutes", targetType: "open", intensity: "active" }]
    }));
  }

  return (
    <article className={`stepCard ${isRepeat ? "repeat" : ""}`}>
      <div className="stepTitle">
        <span className="badge">{isRepeat ? `${step.repeatTimes || 1}x repeat` : `${formatDuration(step)} · ${formatTarget(step)}`}</span>
        <div className="row"><button className="smallButton" onClick={() => onUpdate(path, cloneStep)}>Duplicar</button><button className="smallButton" onClick={() => onDelete(path)}>Eliminar</button></div>
      </div>

      <div className="editorGrid">
        <div className="field"><label>Nombre</label><input value={step.name} onChange={(event) => set({ name: event.target.value })} /></div>
        <div className="field"><label>Tipo</label><select value={step.kind} onChange={(event) => set({ kind: event.target.value as WorkoutStep["kind"] })}><option value="warmup">Entrada</option><option value="work">Trabajo</option><option value="recovery">Recuperación</option><option value="cooldown">Vuelta</option><option value="repeat">Repeat</option></select></div>
      </div>

      {isRepeat ? (
        <>
          <div className="editorGrid">
            <div className="field"><label>Veces</label><input type="number" min={1} value={step.repeatTimes || 1} onChange={(event) => set({ repeatTimes: Number(event.target.value) })} /></div>
            <div className="field"><label>Nota</label><input value={step.notes || ""} onChange={(event) => set({ notes: event.target.value })} /></div>
          </div>
          <div className="children">
            {(step.children || []).map((child, childIndex) => <StepEditor key={child.id} step={child} path={[...path, childIndex]} onUpdate={onUpdate} onDelete={onDelete} />)}
            <button className="smallButton" onClick={addChild}>+ Agregar bloque dentro del repeat</button>
          </div>
        </>
      ) : (
        <>
          <div className="editorGrid three">
            <div className="field"><label>Duración</label><select value={step.durationType} onChange={(event) => set({ durationType: event.target.value as WorkoutStep["durationType"] })}><option value="time">Tiempo</option><option value="distance">Distancia</option><option value="open">Hasta lap/manual</option></select></div>
            <div className="field"><label>Valor</label><input type="number" min={0} step="0.01" disabled={step.durationType === "open"} value={step.durationValue ?? 0} onChange={(event) => set({ durationValue: Number(event.target.value) })} /></div>
            <div className="field"><label>Unidad</label><select disabled={step.durationType === "open"} value={step.durationUnit || (step.durationType === "distance" ? "meters" : "minutes")} onChange={(event) => set({ durationUnit: event.target.value as WorkoutStep["durationUnit"] })}>{step.durationType === "distance" ? <><option value="meters">metros</option><option value="kilometers">kilómetros</option></> : <><option value="minutes">minutos</option><option value="seconds">segundos</option></>}</select></div>
          </div>
          <TargetEditor step={step} set={set} />
          <div className="editorGrid">
            <div className="field"><label>Intensidad FIT</label><select value={step.intensity} onChange={(event) => set({ intensity: event.target.value as WorkoutStep["intensity"] })}><option value="active">Active</option><option value="rest">Rest</option><option value="warmup">Warmup</option><option value="cooldown">Cooldown</option><option value="recovery">Recovery</option><option value="interval">Interval</option></select></div>
            <div className="field"><label>Notas</label><input value={step.notes || ""} onChange={(event) => set({ notes: event.target.value })} /></div>
          </div>
        </>
      )}
    </article>
  );
}

function TargetEditor({ step, set }: { step: WorkoutStep; set: (patch: Partial<WorkoutStep>) => void }) {
  const showZone = step.targetType === "heart_rate" || step.targetType === "power" || step.targetType === "cadence";
  const showRange = step.targetType !== "open" && !step.targetZone;
  return (
    <div className="editorGrid three">
      <div className="field"><label>Objetivo</label><select value={step.targetType} onChange={(event) => { const targetType = event.target.value as TargetType; set({ targetType, targetZone: undefined, targetLow: undefined, targetHigh: undefined, targetUnit: defaultTargetUnit(targetType) }); }}>{TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      {showZone && <div className="field"><label>Zona opcional</label><select value={step.targetZone || ""} onChange={(event) => set({ targetZone: event.target.value ? Number(event.target.value) : undefined })}><option value="">Usar rango</option><option value="1">Zona 1</option><option value="2">Zona 2</option><option value="3">Zona 3</option><option value="4">Zona 4</option><option value="5">Zona 5</option></select></div>}
      {showRange && <><div className="field"><label>{step.targetType === "pace" ? "Ritmo rápido seg/km" : "Mínimo"}</label><input type="number" min={0} value={step.targetLow ?? 0} onChange={(event) => set({ targetLow: Number(event.target.value) })} /></div><div className="field"><label>{step.targetType === "pace" ? "Ritmo lento seg/km" : "Máximo"}</label><input type="number" min={0} value={step.targetHigh ?? 0} onChange={(event) => set({ targetHigh: Number(event.target.value) })} /></div></>}
    </div>
  );
}

function defaultTargetUnit(targetType: TargetType): WorkoutStep["targetUnit"] {
  if (targetType === "pace") return "min_per_km";
  if (targetType === "speed") return "kph";
  if (targetType === "heart_rate") return "bpm";
  if (targetType === "power") return "watts";
  if (targetType === "cadence") return "rpm";
  if (targetType === "rpe") return "rpe";
  return undefined;
}

function updateStepAtPath(steps: WorkoutStep[], path: number[], updater: (step: WorkoutStep) => WorkoutStep): WorkoutStep[] {
  const [index, ...rest] = path;
  return steps.map((step, currentIndex) => {
    if (currentIndex !== index) return step;
    if (rest.length === 0) return updater(step);
    return { ...step, children: updateStepAtPath(step.children || [], rest, updater) };
  });
}

function deleteStepAtPath(steps: WorkoutStep[], path: number[]): WorkoutStep[] {
  const [index, ...rest] = path;
  if (rest.length === 0) return steps.filter((_, currentIndex) => currentIndex !== index);
  return steps.map((step, currentIndex) => currentIndex === index ? { ...step, children: deleteStepAtPath(step.children || [], rest) } : step);
}
