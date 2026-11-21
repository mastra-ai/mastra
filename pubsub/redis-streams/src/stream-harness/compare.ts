import { isFact } from './types';
import type { Cell, Difference, Frame, KnownDifference, ReaderName, RunCapture } from './types';

const types = (frames: Frame[]) => frames.map(f => f.type).join(',') || '(none)';

export function diffFrames(expected: Frame[], actual: Frame[]): Pick<Difference, 'kind' | 'detail'> | undefined {
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
 * Compares every reader of one run with that run's live stream, and, for a
 * non-plain engine, every reader with plain's same reader for the scenario.
 * Both comparisons are always asserted, so a listed difference on one reader
 * can't hide a new or changed difference on another.
 */
export function compareRun(cell: Cell, capture: RunCapture, plain?: RunCapture): Difference[] {
  const live = capture.live;
  const differences: Difference[] = [];
  const readers = Object.entries(capture) as [ReaderName, Frame[]][];
  for (const [reader, frames] of readers) {
    // Facts are not streams: they are only compared with plain's.
    if (reader === 'live' || isFact(reader)) continue;
    if (!live) throw new Error(`no live capture for ${cellName(cell)}`);
    const diff = diffFrames(live, frames);
    if (diff) differences.push({ ...cell, reader, against: 'live', ...diff });
  }
  if (cell.engine !== 'plain') {
    // Every reader is compared against plain's same reader, not only live:
    // a reader can match its own live stream and still differ from plain.
    for (const [reader, frames] of readers) {
      const reference = plain?.[reader];
      if (!reference) throw new Error(`no plain ${reader} capture to compare ${cellName(cell)} against`);
      const diff = diffFrames(reference, frames);
      if (diff) differences.push({ ...cell, reader, against: 'plain', ...diff });
    }
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
