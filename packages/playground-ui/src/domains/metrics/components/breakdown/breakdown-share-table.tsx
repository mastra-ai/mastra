import { useState } from 'react';
import { useMetricsScope } from '../../hooks/use-metrics-scope';
import { rowChange } from '../../lib/breakdown';
import type { BreakdownRow, ChangeMetric, PreviousFigures } from '../../lib/breakdown';
import { DASH, isChangeMetric, tableMinWidth } from '../../lib/breakdown-table';
import type { BreakdownColumnLabels } from '../../lib/breakdown-table';
import { formatCount, formatDuration, formatPercent } from '../../lib/chart-format';
import { ChartArea } from '../chart-area';
import { BreakdownChangeCell } from './breakdown-change-cell';
import { BreakdownChangeDescription } from './breakdown-change-description';
import { BreakdownCostCell } from './breakdown-cost-cell';
import type {
  MetricsShareListColumn,
  MetricsShareListRow,
  MetricsShareListSort,
} from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';
import { Txt } from '@/ds/components/Txt';

/** Rows shown before "Show more", then per page. */
const LIMIT = 10;
const PAGE_SIZE = 20;

export type BreakdownShareTableProps = {
  rows: BreakdownRow[];
  /** The previous window's figures per row key; unset until they answer. */
  previous: Map<string, PreviousFigures> | undefined;
  /** Which optional columns show. Errors brings P95 latency; usage brings Cost. */
  columns: { project: boolean; resource: boolean; errors: boolean; usage: boolean };
  labels: BreakdownColumnLabels;
  /** The count column's tooltip. */
  countDescription: string;
  rowLabel: (row: BreakdownRow) => string;
  onRowClick?: (row: BreakdownRow) => void;
  emptyState: string;
  window: { start: Date; end: Date };
  isLoading: boolean;
  /** The server's row cap, named when it truncated the rows. */
  truncatedAt?: number;
};

/**
 * A sortable breakdown table with % Change against the previous window: the Breakdown card's body,
 * and the dashboard `table` kind's.
 */
export function BreakdownShareTable({
  rows,
  previous,
  columns: { project, resource, errors, usage },
  labels,
  countDescription,
  rowLabel,
  onRowClick,
  emptyState,
  window,
  isLoading,
  truncatedAt,
}: BreakdownShareTableProps) {
  const scope = useMetricsScope();
  const [sort, setSort] = useState<MetricsShareListSort>({ key: 'count', direction: 'descending' });
  const [metric, setMetric] = useState<ChangeMetric>('count');
  const onSortChange = (next: MetricsShareListSort) => {
    setSort(next);
    if (isChangeMetric(next.key)) setMetric(next.key);
  };

  const columns: MetricsShareListColumn[] = [
    ...(project ? [{ label: labels.project, width: 'w-52', align: 'left' as const }] : []),
    ...(resource ? [{ label: labels.resource, width: 'w-32', align: 'left' as const }] : []),
    ...(errors
      ? [
          { label: labels.errorRate, sortKey: 'errorRate' },
          { label: labels.p95, sortKey: 'p95', width: 'w-24' },
        ]
      : []),
    ...(usage ? [{ label: labels.tokens, sortKey: 'tokens' }] : []),
    ...(usage ? [{ label: labels.cost, sortKey: 'cost' }] : []),
    { label: labels.count, sortKey: 'count', width: 'w-24', emphasis: true, description: countDescription },
  ];

  const toShareRow = (row: BreakdownRow): MetricsShareListRow => {
    const change = previous ? rowChange(row, previous.get(row.key), metric) : undefined;
    const projectName = row.projectId ? (scope.projectLabel?.(row.projectId) ?? row.projectId) : DASH;
    return {
      key: row.key,
      label: rowLabel(row),
      share: row.count,
      value: <BreakdownChangeCell change={change} metric={metric} />,
      sortValues: {
        count: row.count,
        errorRate: row.errorRate,
        p95: row.p95,
        tokens: row.tokens,
        cost: row.cost,
        // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
        // have no change to rank, so they sort last.
        change: change?.change,
      },
      cells: [
        ...(project
          ? [
              <span key="project" title={projectName}>
                {projectName}
              </span>,
            ]
          : []),
        ...(resource
          ? [
              <span key="resource" title={row.resource}>
                {row.resource ?? DASH}
              </span>,
            ]
          : []),
        ...(errors
          ? [
              row.errorRate === undefined ? DASH : formatPercent(row.errorRate),
              row.p95 === undefined ? DASH : formatDuration(row.p95),
            ]
          : []),
        ...(usage ? [row.tokens === undefined ? DASH : formatCount(row.tokens)] : []),
        ...(usage ? [<BreakdownCostCell key="cost" row={row} />] : []),
        formatCount(row.count),
      ],
      onClick: onRowClick && (() => onRowClick(row)),
    };
  };

  return (
    <ChartArea>
      {/* The columns don't fit a phone or tablet: the table scrolls sideways, names stay readable.
          The padding holds the rows' hover background, which reaches 8px past the list. */}
      <div className="-mx-2 min-w-0 overflow-x-auto px-2">
        <MetricsShareList
          className={tableMinWidth(project, resource)}
          rows={rows.map(toShareRow)}
          columns={columns}
          valueLabel="% Change"
          valueWidth="w-28"
          valueSortKey="change"
          valueDescription={<BreakdownChangeDescription window={window} label={labels[metric]} />}
          showShare={false}
          showStrip={false}
          sort={sort}
          onSortChange={onSortChange}
          limit={LIMIT}
          overflow="more"
          pageSize={PAGE_SIZE}
          emptyState={emptyState}
          isLoading={isLoading}
        />
      </div>
      {!isLoading && truncatedAt !== undefined && (
        <Txt variant="caption" tone="muted" className="pt-2">
          Showing the {formatCount(truncatedAt)} busiest; sorting covers only these.
        </Txt>
      )}
    </ChartArea>
  );
}
