import { useMemo } from 'react';
import { resolveTracesDateWindow } from './traces-explorer-actions';
import type { TracesFilters } from './traces-explorer-actions';

/**
 * The filters' date window. A rolling preset pins its start when the preset (or a custom bound)
 * changes, not on every render, so the window (and every query keyed on it) holds still.
 */
export function useTracesDateWindow({ datePreset, dateFrom, dateTo }: TracesFilters) {
  const fromMs = dateFrom?.getTime();
  const toMs = dateTo?.getTime();
  return useMemo(
    () =>
      resolveTracesDateWindow(
        datePreset,
        fromMs === undefined ? undefined : new Date(fromMs),
        toMs === undefined ? undefined : new Date(toMs),
      ),
    [datePreset, fromMs, toMs],
  );
}
