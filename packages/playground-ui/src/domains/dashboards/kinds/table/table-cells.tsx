import { BreakdownFigure } from '../../../metrics/components/breakdown/breakdown-figure';
import { BreakdownName } from '../../../metrics/components/breakdown/breakdown-name';
import { BreakdownNotPriced } from '../../../metrics/components/breakdown/breakdown-not-priced';
import { BreakdownEntityMark, BreakdownModelMark } from '../../../metrics/components/breakdown/breakdown-row-mark';
import { BreakdownText } from '../../../metrics/components/breakdown/breakdown-text';
import { BreakdownTrendText } from '../../../metrics/components/breakdown/breakdown-trend-text';
import { useMetricsScope } from '../../../metrics/hooks/use-metrics-scope';
import { DASH, changeTrend, formatChange, formatValue } from '../../lib/table';
import type { Change, TableColumnOptions, TableRow, ValueColumn } from '../../lib/table';

type NameOptions = Extract<TableColumnOptions, { type: 'name' }>;
type DimensionOptions = Extract<TableColumnOptions, { type: 'dimension' }>;

function RowMark({ mark, row }: { mark: NameOptions['mark']; row: TableRow }) {
  if (!mark) return null;
  if ('icon' in mark) return <BreakdownEntityMark entity={mark.icon} />;
  return <BreakdownModelMark provider={row.dimensions[mark.providerDimension]} />;
}

/** The row's mark and name; with a provider mark, a model reads `openai › gpt-5-mini`. */
export function TableNameCell({ options, row }: { options: NameOptions; row: TableRow }) {
  const { projectLabel } = useMetricsScope();
  const title =
    options.as === 'project' ? (projectLabel?.(row.name) ?? row.name) : row.name || (options.unnamed ?? 'Unnamed');
  const provider = options.mark && 'providerDimension' in options.mark ? options.mark.providerDimension : undefined;
  return (
    <BreakdownName
      mark={<RowMark mark={options.mark} row={row} />}
      title={title}
      model={
        provider !== undefined && row.name !== '' ? { name: row.name, provider: row.dimensions[provider] } : undefined
      }
    />
  );
}

export function TableDimensionCell({ id, options, row }: { id: string; options: DimensionOptions; row: TableRow }) {
  const { projectLabel } = useMetricsScope();
  const value = options.query === undefined ? row.dimensions[options.dimension] : row.lookups[id];
  if (!value) return <BreakdownText text={DASH} />;
  return <BreakdownText text={options.as === 'project' ? (projectLabel?.(value) ?? value) : value} />;
}

function ValueText({ column, row }: { column: ValueColumn; row: TableRow }) {
  const value = row.values[column.id];
  if (value !== undefined) return formatValue(column, value, row.units[column.id]);
  const { unpricedWhen } = column.options;
  return unpricedWhen && (row.values[unpricedWhen] ?? 0) > 0 ? <BreakdownNotPriced /> : DASH;
}

export function TableValueCell({ column, row }: { column: ValueColumn; row: TableRow }) {
  return (
    <BreakdownFigure muted={!column.options.emphasis}>
      <ValueText column={column} row={row} />
    </BreakdownFigure>
  );
}

export function TableChangeCell({ change, column }: { change: Change | undefined; column: ValueColumn }) {
  if (!change) return <BreakdownTrendText trend={undefined} />;
  return <BreakdownTrendText trend={changeTrend(change, column)}>{formatChange(change, column)}</BreakdownTrendText>;
}
