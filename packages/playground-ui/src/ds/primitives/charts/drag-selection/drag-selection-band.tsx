import { useLayoutEffect, useState } from 'react';
import { usePlotArea } from 'recharts';
import { selectionBandBox } from './drag-selection-range';
import type { DragSelectionLayout, DragSelectionRange } from './drag-selection-range';
import type { DragSelection } from './use-drag-selection';

export type DragSelectionBandProps = {
  selection: Pick<DragSelection, 'bandSetter'>;
  /** Number of data points on the x-axis. */
  count: number;
  /** `band` for bar charts, `point` for line and area charts. */
  layout?: DragSelectionLayout;
};

const sameRange = (a: DragSelectionRange | undefined, b: DragSelectionRange | undefined) =>
  a?.start === b?.start && a?.end === b?.end;

/**
 * The full-height band over the points being dragged; render it inside the Recharts chart, before
 * the series so it sits behind them. Shows even over empty points. Owns its state, so a drag
 * repaints the band, never the chart.
 */
export function DragSelectionBand({ selection, count, layout = 'band' }: DragSelectionBandProps) {
  const [range, setRange] = useState<DragSelectionRange>();
  const { bandSetter } = selection;
  useLayoutEffect(() => {
    bandSetter.current = next => setRange(prev => (sameRange(prev, next) ? prev : next));
    return () => {
      bandSetter.current = () => {};
    };
  }, [bandSetter]);
  const area = usePlotArea();
  const box = range && area ? selectionBandBox(range, count, area, layout) : undefined;
  if (!box) return null;
  return (
    <rect
      data-slot="chart-drag-selection"
      {...box}
      rx={2}
      fill="var(--fill)"
      stroke="var(--fill-strong)"
      pointerEvents="none"
    />
  );
}
