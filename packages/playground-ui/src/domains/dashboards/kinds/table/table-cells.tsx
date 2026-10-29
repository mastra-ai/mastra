import { BreakdownFigure } from '../../../metrics/components/breakdown/breakdown-figure';
import { BreakdownText } from '../../../metrics/components/breakdown/breakdown-text';
import { useMetricsScope } from '../../../metrics/hooks/use-metrics-scope';
import { DASH, changeTrend, formatChange, formatValue } from '../../lib/table';
import type { Change, TableColumn, TableRow, ValueColumn } from '../../lib/table';
import { ProviderMark, modelNameParts } from '@/domains/llm';
import { SegmentedName } from '@/ds/components/SegmentedName';
import { SeriesMark } from '@/ds/components/SeriesMark';
import { AgentIcon, AiIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';

type NameOptions = Extract<TableColumn['options'], { type: 'name' }>;
type DimensionOptions = Extract<TableColumn['options'], { type: 'dimension' }>;

const ICONS = { agent: AgentIcon, workflow: WorkflowIcon, tool: ToolsIcon } as const;

const TREND_CLASS = { good: 'text-badge-green-foreground', bad: 'text-badge-red-foreground' } as const;

function RowMark({ mark, row }: { mark: NameOptions['mark']; row: TableRow }) {
  if (!mark) return null;
  if ('icon' in mark) {
    const Icon = ICONS[mark.icon];
    return <SeriesMark icon={<Icon className="size-3" />} />;
  }
  const provider = row.dimensions[mark.providerDimension];
  if (provider) return <ProviderMark provider={provider} />;
  return <SeriesMark icon={<AiIcon className="size-3" />} />;
}

/** The row's mark and name; with a provider mark, a model reads `openai › gpt-5-mini`. */
export function TableNameCell({ options, row }: { options: NameOptions; row: TableRow }) {
  const { projectLabel } = useMetricsScope();
  const name =
    options.as === 'project' ? (projectLabel?.(row.name) ?? row.name) : row.name || (options.unnamed ?? 'Unnamed');
  const provider = options.mark && 'providerDimension' in options.mark ? options.mark.providerDimension : undefined;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <RowMark mark={options.mark} row={row} />
      <span className="truncate" title={name}>
        {provider !== undefined && row.name !== '' ? (
          <SegmentedName parts={modelNameParts(row.name, row.dimensions[provider])} />
        ) : (
          name
        )}
      </span>
    </span>
  );
}

export function TableDimensionCell({ id, options, row }: { id: string; options: DimensionOptions; row: TableRow }) {
  const { projectLabel } = useMetricsScope();
  const value = options.query === undefined ? row.dimensions[options.dimension] : row.lookups[id];
  if (!value) return <BreakdownText text={DASH} />;
  return <BreakdownText text={options.as === 'project' ? (projectLabel?.(value) ?? value) : value} />;
}

export function TableValueCell({ column, row }: { column: ValueColumn; row: TableRow }) {
  const value = row.values[column.id];
  const { unpricedWhen, emphasis } = column.options;
  return (
    <BreakdownFigure muted={!emphasis}>
      {value !== undefined ? (
        formatValue(column, value, row.units[column.id])
      ) : unpricedWhen && (row.values[unpricedWhen] ?? 0) > 0 ? (
        // A value without a price: say so rather than show $0.
        <span title="No price for this model">Not priced</span>
      ) : (
        DASH
      )}
    </BreakdownFigure>
  );
}

export function TableChangeCell({ change, column }: { change: Change | undefined; column: ValueColumn }) {
  // The cell sits in the list's main column, so a flat or missing change is muted here.
  if (!change) return <span className="text-muted-foreground">{DASH}</span>;
  const trend = changeTrend(change, column);
  return <span className={trend ? TREND_CLASS[trend] : 'text-muted-foreground'}>{formatChange(change, column)}</span>;
}
