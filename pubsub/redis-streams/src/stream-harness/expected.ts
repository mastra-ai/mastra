import { compareRun, diffFrames, judgeCell } from './compare';
import type { Verdict } from './compare';
import { projectSymptoms } from './fault-symptoms';
import type { Symptom } from './fault-symptoms';
import type { Attribution, Observation } from './known-differences';
import { BASELINES, FACT_BASELINES, OBSERVATIONS } from './known-differences';
import { getScenario, readersOf } from './scenarios';
import { isFact, layoutName } from './types';
import type { Cell, Frame, KnownDifference, ReaderName, RunCapture } from './types';

/** Splits a compact frame list on top-level commas: `a,b[{"x":1,"y":2}],c`. */
function splitFrames(compact: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const char of compact) {
    if (quoted) {
      current += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    if (char === '[' || char === '{') depth++;
    if (char === ']' || char === '}') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function parseFrame(part: string): Frame {
  const open = part.indexOf('[');
  if (open === -1 || !part.endsWith(']')) return { type: part };
  return { type: part.slice(0, open), shape: part.slice(open + 1, -1) };
}

/**
 * Parses a compact frame list. A frame written without `[shape]` whose type
 * carries a shape in the scenario's baseline takes the shape of the baseline
 * frame of that type at the same position (first `text-delta` takes the
 * baseline's first `text-delta` shape, and so on), so observations only spell
 * out shapes that actually differ.
 */
export function parseFrames(compact: string, baseline?: Frame[]): Frame[] {
  const seen = new Map<string, number>();
  return splitFrames(compact).map(part => {
    const frame = parseFrame(part);
    const n = seen.get(frame.type) ?? 0;
    seen.set(frame.type, n + 1);
    if (frame.shape !== undefined || !baseline) return frame;
    const sameType = baseline.filter(f => f.type === frame.type);
    if (!sameType.some(f => f.shape !== undefined)) return frame;
    const inherited = sameType[n];
    if (!inherited) throw new Error(`frame ${frame.type} #${n} has no baseline shape to inherit in "${compact}"`);
    return { type: frame.type, shape: inherited.shape };
  });
}

/** Plain's live stream for the scenario, or plain's value of a fact. */
export function baselineFrames(scenario: string, reader: ReaderName = 'live'): Frame[] {
  const compact = isFact(reader) ? FACT_BASELINES[scenario]?.[reader] : BASELINES[scenario];
  if (compact === undefined) throw new Error(`no baseline for ${reader} in scenario ${scenario}`);
  return parseFrames(compact);
}

export function observationApplies(observation: Observation, cell: Cell, reader: ReaderName): boolean {
  return (
    observation.scenario === cell.scenario &&
    observation.engines.includes(cell.engine) &&
    (observation.layouts === undefined || observation.layouts.includes(layoutName(cell))) &&
    observation.readers.includes(reader)
  );
}

/** The one observation that describes this reader in this cell, if any. */
export function observationFor(cell: Cell, reader: ReaderName): Observation | undefined {
  const found = OBSERVATIONS.filter(o => observationApplies(o, cell, reader));
  if (found.length > 1) {
    throw new Error(
      `${found.length} observations describe ${reader} in ${cell.scenario}/${cell.engine}/${layoutName(cell)}`,
    );
  }
  return found[0];
}

/** What every reader of a cell is expected to deliver: the baseline, unless an observation says otherwise. */
export function expectedCapture(cell: Cell): RunCapture {
  const capture: RunCapture = {};
  for (const reader of readersOf(getScenario(cell.scenario))) {
    const baseline = baselineFrames(cell.scenario, reader);
    const observation = observationFor(cell, reader);
    capture[reader] = observation ? parseFrames(observation.frames, baseline) : baseline;
  }
  return capture;
}

/**
 * Turns the observations into the exact differences the comparator must
 * report for a cell, each attributed to the observation that explains it:
 * - against live: the reader's own observation (or its `againstLive`), else
 *   the live stream's observation;
 * - against plain: the reader's own observation (or its `againstPlain`),
 *   else plain's observation for the same reader.
 */
export function knownDifferencesFor(cell: Cell): KnownDifference[] {
  const expected = expectedCapture(cell);
  const plainCell: Cell = { ...cell, engine: 'plain' };
  const plain = cell.engine === 'plain' ? undefined : expectedCapture(plainCell);
  return compareRun(cell, expected, plain).map(difference => {
    const own = observationFor(cell, difference.reader);
    const attribution: Attribution | undefined =
      difference.against === 'live'
        ? (own?.againstLive ?? own ?? observationFor(cell, 'live'))
        : (own?.againstPlain ?? own ?? observationFor(plainCell, difference.reader));
    if (!attribution) throw new Error(`no observation explains ${difference.reader} vs ${difference.against}`);
    return {
      ...difference,
      ticket: attribution.ticket,
      cause: attribution.cause,
      evidence: attribution.evidence,
    };
  });
}

export interface CellCheck {
  verdict: Verdict;
  /** Readers whose capture differs from what the observations say they deliver. */
  drift: { reader: ReaderName; kind: string; detail: string }[];
  symptoms?: Symptom[];
  rawDifferences?: ReturnType<typeof compareRun>;
}

/** Compare original frames first; keep every authorized symptom visible. */
export function checkCell(cell: Cell, capture: RunCapture, plain?: RunCapture): CellCheck {
  const rawDifferences = compareRun(cell, capture, plain);
  const expected = expectedCapture(cell);
  const own = projectSymptoms(cell, capture, expected);
  const plainCell: Cell = { ...cell, engine: 'plain' };
  const reference =
    plain && cell.engine !== 'plain' ? projectSymptoms(plainCell, plain, expectedCapture(plainCell)) : undefined;
  const verdict = judgeCell(cell, compareRun(cell, own.capture, reference?.capture), knownDifferencesFor(cell));
  const drift: CellCheck['drift'] = readersOf(getScenario(cell.scenario)).flatMap(reader => {
    const diff = diffFrames(expected[reader]!, own.capture[reader] ?? []);
    return diff ? [{ reader, ...diff }] : [];
  });
  if (getScenario(cell.scenario).fault && cell.backend !== 'memory' && !own.symptoms.length) {
    drift.push({
      reader: 'live',
      kind: 'stale-symptom',
      detail: `${cell.backend === 'redis' ? 'COR-1561' : 'COR-1562'}: no pinned fault symptom reproduced`,
    });
  }
  const symptoms = [...own.symptoms, ...(reference?.symptoms ?? [])];
  return { verdict, drift, ...(symptoms.length ? { symptoms, rawDifferences } : {}) };
}
