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

const columnsFor = (dimensionCount: number) =>
  `repeat(${dimensionCount}, minmax(10rem, 2fr)) repeat(${TRACE_GROUP_BY_MEASURES.length}, minmax(6rem, 1fr))`;

export interface TracesGroupedViewProps {
  /** Grouped dimensions, in order: one label column each. */
  dimensions: TraceGroupByDimension[];
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
  dimensions,
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
      <DataList columns={columnsFor(dimensions.length)} fit="container" className="min-w-0">
        <DataList.Top>
          {dimensions.map(dimension => (
            <DataList.TopCell key={dimension}>{TRACE_GROUP_BY_DIMENSION_LABELS[dimension]}</DataList.TopCell>
          ))}
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
          <DataListSkeletonRows columnCount={TRACE_GROUP_BY_MEASURES.length + dimensions.length} />
        ) : rows.length === 0 ? (
          <DataList.NoMatch
            message={filtersApplied ? 'No traces match these filters' : 'No traces in this time range'}
          />
        ) : (
          rows.map(row => {
            const values = dimensions.map(dimension => getTraceGroupValue(row, dimension));
            const labels = dimensions.map((dimension, index) => formatTraceGroupValue(dimension, values[index]));
            const drillDown = getTraceGroupDrillDown(dimensions, row);
            const cells = (
              <>
                {labels.map((label, index) => (
                  <DataList.TextCell key={dimensions[index]}>{label}</DataList.TextCell>
                ))}
                {TRACE_GROUP_BY_MEASURES.map(measure => (
                  <MeasureCell key={measure} row={row} measure={measure} />
                ))}
              </>
            );
            const key = JSON.stringify(values);
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
          Showing the top {TRACE_GROUP_BY_LIMIT} groups by {sortPhrase(sort.measure)}. Narrow the filters to see others.
        </Txt>
      )}
    </div>
  );
}
