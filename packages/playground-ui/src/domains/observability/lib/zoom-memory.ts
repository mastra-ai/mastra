import type { TraceDatePreset } from '@/domains/traces/types';

export type DateRangeSelection = { datePreset: TraceDatePreset; dateFrom?: Date; dateTo?: Date };

/** The range picked before a histogram zoom, and the zoomed range it can be restored from. */
export type ZoomMemory = { before: DateRangeSelection; fromMs: number; toMs: number };

const isZoomedIn = (memory: ZoomMemory | undefined, current: DateRangeSelection): memory is ZoomMemory =>
  memory !== undefined &&
  current.datePreset === 'custom' &&
  current.dateFrom?.getTime() === memory.fromMs &&
  current.dateTo?.getTime() === memory.toMs;

/** Zooming from an earlier zoom keeps the range picked before the first one. */
export function rememberZoom(
  memory: ZoomMemory | undefined,
  current: DateRangeSelection,
  from: Date,
  to: Date,
): ZoomMemory {
  const before = isZoomedIn(memory, current)
    ? memory.before
    : current.datePreset === 'custom'
      ? { datePreset: current.datePreset, dateFrom: current.dateFrom, dateTo: current.dateTo }
      : { datePreset: current.datePreset };
  return { before, fromMs: from.getTime(), toMs: to.getTime() };
}

/**
 * The range to restore while `current` is still the remembered zoom. Once the user picks another
 * range, the zoom no longer applies and this returns `undefined`.
 */
export const rangeBeforeZoom = (memory: ZoomMemory | undefined, current: DateRangeSelection) =>
  isZoomedIn(memory, current) ? memory.before : undefined;
