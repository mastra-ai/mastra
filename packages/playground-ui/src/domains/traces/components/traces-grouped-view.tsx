import {
  TRACE_GROUP_BY_DIMENSION_LABELS,
  TRACE_GROUP_BY_LIMIT,
  TRACE_GROUP_BY_MEASURE_LABELS,
  TRACE_GROUP_BY_MEASURES,
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

const COLUMNS = `minmax(12rem, 2fr) repeat(${TRACE_GROUP_BY_MEASURES.length}, minmax(6rem, 1fr))`;

export interface TracesGroupedViewProps {
  dimension: TraceGroupByDimension;
  rows: TraceGroupRow[];
  /** More groups exist than the top-N returned. */
  truncated?: boolean;
  isLoading?: boolean;
  filtersApplied?: boolean;
  sort: TraceGroupSort;
  onSortChange: (sort: TraceGroupSort) => void;
  /** Called with how to narrow the trace list to the clicked group. Groups without a drill-down aren't clickable. */
  onDrillDown: (drillDown: TraceGroupDrillDown) => void;
}

const sortPhrase = (measure: TraceGroupByMeasure) =>
  measure === 'count' ? 'trace count' : TRACE_GROUP_BY_MEASURE_LABELS[measure].toLowerCase();

function MeasureCell({ row, measure }: { row: TraceGroupRow; measure: TraceGroupByMeasure }) {
  const { text, tooltip } = formatTraceGroupMeasure(row, measure);
  return (
    <DataList.NumberCell highlight={measure === 'count'}>
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
  dimension,
  rows,
  truncated,
  isLoading,
  filtersApplied,
  sort,
  onSortChange,
  onDrillDown,
}: TracesGroupedViewProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <DataList columns={COLUMNS} fit="container" className="min-w-0">
        <DataList.Top>
          <DataList.TopCell>{TRACE_GROUP_BY_DIMENSION_LABELS[dimension]}</DataList.TopCell>
          {TRACE_GROUP_BY_MEASURES.map(measure => (
            <DataList.SortableTopCell
              key={measure}
              sortKey={measure}
              sort={sort.measure === measure ? sort.direction : undefined}
              onSortChange={(direction, key) => onSortChange({ measure: key, direction })}
              align="end"
              className="justify-end text-right"
            >
              {TRACE_GROUP_BY_MEASURE_LABELS[measure]}
            </DataList.SortableTopCell>
          ))}
        </DataList.Top>

        {isLoading ? (
          <DataListSkeletonRows columnCount={TRACE_GROUP_BY_MEASURES.length + 1} />
        ) : rows.length === 0 ? (
          <DataList.NoMatch
            message={filtersApplied ? 'No traces match these filters' : 'No traces in this time range'}
          />
        ) : (
          rows.map(row => {
            const value = getTraceGroupValue(row, dimension);
            const label = formatTraceGroupValue(dimension, value);
            const drillDown = getTraceGroupDrillDown(dimension, value);
            const cells = (
              <>
                <DataList.TextCell>{label}</DataList.TextCell>
                {TRACE_GROUP_BY_MEASURES.map(measure => (
                  <MeasureCell key={measure} row={row} measure={measure} />
                ))}
              </>
            );
            const key = value ?? '';
            return drillDown ? (
              <DataList.RowButton
                key={key}
                aria-label={`Show traces for ${label}`}
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
          Showing the top {TRACE_GROUP_BY_LIMIT} groups by {sortPhrase(sort.measure)}. Narrow the filters to see others.
        </Txt>
      )}
    </div>
  );
}
