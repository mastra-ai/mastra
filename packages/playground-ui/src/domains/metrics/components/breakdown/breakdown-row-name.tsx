import { useMetricsScope } from '../../hooks/use-metrics-scope';
import type { BreakdownRow, BreakdownTab } from '../../lib/breakdown';
import { rowLabel } from '../../lib/breakdown-table';
import { BreakdownName } from './breakdown-name';
import { BreakdownRowMark } from './breakdown-row-mark';

/** The row's mark and name; a model reads `openai › gpt-5-mini`. */
export function BreakdownRowName({ tab, row }: { tab: BreakdownTab; row: BreakdownRow }) {
  const { projectLabel } = useMetricsScope();
  return (
    <BreakdownName
      mark={<BreakdownRowMark tab={tab} row={row} />}
      title={rowLabel(tab, row, projectLabel)}
      model={tab === 'models' && row.name !== '' ? { name: row.name, provider: row.provider } : undefined}
    />
  );
}
