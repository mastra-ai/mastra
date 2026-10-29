import { useMetricsScope } from '../../hooks/use-metrics-scope';
import type { BreakdownRow, BreakdownTab } from '../../lib/breakdown';
import { rowLabel } from '../../lib/breakdown-table';
import { BreakdownRowMark } from './breakdown-row-mark';
import { modelNameParts } from '@/domains/llm';
import { SegmentedName } from '@/ds/components/SegmentedName';

/** The row's mark and name; a model reads `openai › gpt-5-mini`. */
export function BreakdownRowName({ tab, row }: { tab: BreakdownTab; row: BreakdownRow }) {
  const { projectLabel } = useMetricsScope();
  const name = rowLabel(tab, row, projectLabel);
  const segmented = tab === 'models' && row.name !== '';
  return (
    <span className="flex min-w-0 items-center gap-2">
      <BreakdownRowMark tab={tab} row={row} />
      <span className="truncate" title={name}>
        {segmented ? <SegmentedName parts={modelNameParts(row.name, row.provider)} /> : name}
      </span>
    </span>
  );
}
