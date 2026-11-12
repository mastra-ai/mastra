import type { Cell, Difference, Frame, KnownDifference, ReaderName, RunCapture } from './types';

const types = (frames: Frame[]) => frames.map(f => f.type).join(',') || '(none)';

function diffFrames(expected: Frame[], actual: Frame[]): Pick<Difference, 'kind' | 'detail'> | undefined {
  if (types(expected) !== types(actual)) {
    return { kind: 'sequence', detail: `expected ${types(expected)} got ${types(actual)}` };
  }
  const changed = expected
    .map((frame, i) =>
      frame.shape === actual[i]!.shape
        ? undefined
        : `${frame.type}#${i}: expected ${frame.shape} got ${actual[i]!.shape}`,
    )
    .filter(Boolean);
  return changed.length ? { kind: 'shape', detail: changed.join('; ') } : undefined;
}

/**
 * Compares every reader of one run with that run's live stream, and the live
 * stream with plain's live stream for the same scenario. Equality is
 * transitive, so this is enough for "all readers agree and every engine
 * agrees with plain" while attributing each difference once: a reader that
 * differs from its own live stream is a delivery difference, a live stream
 * that differs from plain's is a chunk difference.
 */
export function compareRun(cell: Cell, capture: RunCapture, plainLive?: Frame[]): Difference[] {
  const live = capture.live;
  if (!live) throw new Error(`no live capture for ${cellName(cell)}`);
  const differences: Difference[] = [];
  for (const [reader, frames] of Object.entries(capture) as [ReaderName, Frame[]][]) {
    if (reader === 'live') continue;
    const diff = diffFrames(live, frames);
    if (diff) differences.push({ ...cell, reader, against: 'live', ...diff });
  }
  if (cell.engine !== 'plain') {
    if (!plainLive) throw new Error(`no plain live capture to compare ${cellName(cell)} against`);
    const diff = diffFrames(plainLive, live);
    if (diff) differences.push({ ...cell, reader: 'live', against: 'plain', ...diff });
  }
  return differences;
}

export function cellName(cell: Cell): string {
  return `${cell.scenario} / ${cell.engine} / ${cell.backend} / ${cell.topology}`;
}

/** Whether a listed entry is about this cell (backend/topology omitted = every value). */
export function appliesTo(entry: KnownDifference, cell: Cell): boolean {
  return (
    entry.scenario === cell.scenario &&
    entry.engine === cell.engine &&
    (entry.backend === undefined || entry.backend === cell.backend) &&
    (entry.topology === undefined || entry.topology === cell.topology)
  );
}

export function matches(entry: KnownDifference, difference: Difference): boolean {
  return (
    appliesTo(entry, difference) &&
    entry.reader === difference.reader &&
    entry.against === difference.against &&
    entry.kind === difference.kind &&
    entry.detail === difference.detail
  );
}

export interface Verdict {
  /** Observed differences no entry lists. */
  unlisted: Difference[];
  /** Entries that apply to the cell but did not reproduce in it. */
  stale: KnownDifference[];
}

/**
 * Checks one cell's observed differences against the known list. Every
 * observed difference must be listed, and every entry that applies to the
 * cell must reproduce in it: an entry without a backend has to reproduce on
 * every backend it ran on.
 */
export function judgeCell(cell: Cell, observed: Difference[], known: readonly KnownDifference[]): Verdict {
  const applicable = known.filter(entry => appliesTo(entry, cell));
  return {
    unlisted: observed.filter(difference => !applicable.some(entry => matches(entry, difference))),
    stale: applicable.filter(entry => !observed.some(difference => matches(entry, difference))),
  };
}

export function formatVerdict(cell: Cell, verdict: Verdict): string {
  const lines = [`${cellName(cell)}:`];
  for (const d of verdict.unlisted) {
    lines.push(`  UNLISTED ${d.reader} vs ${d.against} [${d.kind}] ${d.detail}`);
  }
  for (const e of verdict.stale) {
    lines.push(`  STALE (${e.ticket}) ${e.reader} vs ${e.against} [${e.kind}] ${e.detail}`);
  }
  return lines.join('\n');
}
