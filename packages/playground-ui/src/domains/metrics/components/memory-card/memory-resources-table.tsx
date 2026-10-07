import type { ResourceThreadsRow } from '@mastra/react/hooks/metrics';
import { DataList } from '../../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { METRICS_DATA_LIST_PROPS } from '../metrics-utils';
import { shortId } from './memory-card.utils';
import { formatCompactNumber, formatCost } from '@/lib/cost';

export interface MemoryResourcesTableProps {
  rows: ResourceThreadsRow[];
  onRowClick?: (row: ResourceThreadsRow) => void;
}

export function MemoryResourcesTable({ rows, onRowClick }: MemoryResourcesTableProps) {
  if (rows.length === 0) return <MetricsCard.NoData message="No resource activity yet" />;

  return (
    <DataList columns="auto auto auto auto" {...METRICS_DATA_LIST_PROPS}>
      <DataList.Top>
        <DataList.TopCell sticky="start">Resource ID</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Threads</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Tokens</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
      </DataList.Top>
      {rows.map(row => {
        const cells = (
          <>
            <DataList.RowHeaderCell className="text-caption">{shortId(row.resourceId)}</DataList.RowHeaderCell>
            <DataList.NumberCell highlight>{row.threadCount.toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{row.tokens > 0 ? formatCompactNumber(row.tokens) : '—'}</DataList.NumberCell>
            <DataList.NumberCell>{row.cost != null ? formatCost(row.cost, row.costUnit) : '—'}</DataList.NumberCell>
          </>
        );

        return onRowClick ? (
          <DataList.RowButton key={row.resourceId} onClick={() => onRowClick(row)}>
            {cells}
          </DataList.RowButton>
        ) : (
          <DataList.RowStatic key={row.resourceId}>{cells}</DataList.RowStatic>
        );
      })}
    </DataList>
  );
}
