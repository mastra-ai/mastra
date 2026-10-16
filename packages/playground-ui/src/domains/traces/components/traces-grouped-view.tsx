import {
  TRACE_GROUP_BY_DIMENSION_LABELS,
  DEFAULT_TRACE_GROUP_COLUMNS,
  TRACE_GROUP_BY_MEASURE_LABELS,
  formatTraceGroupMeasure,
  formatTraceGroupValue,
  getTraceGroupDrillDown,
  getTraceGroupValue,
} from '../trace-group-by';
import type {
  TraceGroupByDimension,
  TraceGroupByMeasure,
  TraceGroupDrillDown,
  TraceGroupRow,
  TraceGroupSort,
} from '../trace-group-by';
import { DataList, DataListSkeletonRows } from '@/ds/components/DataList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt/Txt';

// Sized like the trace list (`buildTraceListColumns`): the label columns flex like its Name/Input/Output columns, so
// the grid fills the panel, and the measures are fixed tracks wide enough for their header and sort icon. Once the
// columns outgrow the panel, the list scrolls horizontally.
const DIMENSION_COLUMN_WIDTH = 'minmax(10rem,1fr)';

const measureColumnWidth = (measure: TraceGroupByMeasure) =>
  `${Math.max(7, (TRACE_GROUP_BY_MEASURE_LABELS[measure].length + 5) / 2)}rem`;

const buildColumns = (dimensions: readonly TraceGroupByDimension[], measures: readonly TraceGroupByMeasure[]) =>
  [...dimensions.map(() => DIMENSION_COLUMN_WIDTH), ...measures.map(measureColumnWidth)].join(' ');

const buildColumnKeys = (dimensions: readonly TraceGroupByDimension[], measures: readonly TraceGroupByMeasure[]) => [
  ...dimensions.map(dimension => `dimension:${dimension}`),
  ...measures,
];

export interface TracesGroupedViewProps {
  /** Grouped dimensions, in order: one label column each. */
  dimensions: TraceGroupByDimension[];
  /** Measure columns to show, from `useTraceGroupColumnPreferences`. */
  columns?: readonly TraceGroupByMeasure[];
  rows: TraceGroupRow[];
  /** More groups exist than the top-N returned. */
  truncated?: boolean;
  isLoading?: boolean;
  filtersApplied?: boolean;
  sort: TraceGroupSort;
  onSortChange: (sort: TraceGroupSort) => void;
  /** Called with how to narrow the trace list to the clicked group. Groups without a drill-down aren't clickable. */
  onDrillDown: (drillDown: TraceGroupDrillDown) => void;
  /** Label for a set dimension value, e.g. a project's name for its ID; return undefined for the default label. */
  formatValue?: (dimension: TraceGroupByDimension, value: string) => string | undefined;
}

const sortPhrase = (measure: TraceGroupByMeasure) =>
  measure === 'count' ? 'trace count' : TRACE_GROUP_BY_MEASURE_LABELS[measure].toLowerCase();

function MeasureCell({ row, measure }: { row: TraceGroupRow; measure: TraceGroupByMeasure }) {
  const { text, tooltip } = formatTraceGroupMeasure(row, measure);
  return (
    <DataList.NumberCell highlight={measure === 'count'} className="justify-items-start text-left">
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{text}</span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        text
      )}
    </DataList.NumberCell>
  );
}

/** One row per group of the Traces table's filtered selection, with its counts, latency, tokens and cost. */
export function TracesGroupedView({
  dimensions,
  columns = DEFAULT_TRACE_GROUP_COLUMNS,
  rows,
  truncated,
  isLoading,
  filtersApplied,
  sort,
  onSortChange,
  onDrillDown,
  formatValue,
}: TracesGroupedViewProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
      <DataList
        reorderable
        id="trace-groups"
        columns={buildColumns(dimensions, columns)}
        columnKeys={buildColumnKeys(dimensions, columns)}
        fit="container"
        className="min-h-0 min-w-0 flex-1"
      >
        <DataList.Top>
          {dimensions.map(dimension => (
            <DataList.TopCell key={dimension}>{TRACE_GROUP_BY_DIMENSION_LABELS[dimension]}</DataList.TopCell>
          ))}
          {columns.map(measure => (
            <DataList.SortableTopCell
              key={measure}
              sortKey={measure}
              sort={sort.measure === measure ? sort.direction : undefined}
              onSortChange={(direction, key) => onSortChange({ measure: key, direction })}
            >
              {TRACE_GROUP_BY_MEASURE_LABELS[measure]}
            </DataList.SortableTopCell>
          ))}
        </DataList.Top>

        {isLoading ? (
          <DataListSkeletonRows columnCount={columns.length + dimensions.length} />
        ) : rows.length === 0 ? (
          <DataList.NoMatch
            message={filtersApplied ? 'No traces match these filters' : 'No traces in this time range'}
          />
        ) : (
          rows.map(row => {
            const values = dimensions.map(dimension => getTraceGroupValue(row, dimension));
            const labels = dimensions.map((dimension, index) => {
              const value = values[index];
              return (value && formatValue?.(dimension, value)) ?? formatTraceGroupValue(dimension, value);
            });
            const drillDown = getTraceGroupDrillDown(dimensions, row);
            const cells = (
              <>
                {labels.map((label, index) => (
                  <DataList.TextCell key={dimensions[index]}>{label}</DataList.TextCell>
                ))}
                {columns.map(measure => (
                  <MeasureCell key={measure} row={row} measure={measure} />
                ))}
              </>
            );
            const key = JSON.stringify(row.dimensions);
            return drillDown ? (
              <DataList.RowButton
                key={key}
                aria-label={`Show traces for ${labels.join(', ')}`}
                onClick={() => onDrillDown(drillDown)}
              >
                {cells}
              </DataList.RowButton>
            ) : (
              <DataList.RowStatic key={key}>{cells}</DataList.RowStatic>
            );
          })
        )}
      </DataList>
      {truncated && !isLoading && (
        <Txt variant="body-sm" tone="muted" className="px-2">
          Showing the top {rows.length} groups by {sortPhrase(sort.measure)}. Narrow the filters to see others.
        </Txt>
      )}
    </div>
  );
}
