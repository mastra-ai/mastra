import type { ActiveThreadRow } from '@mastra/react/hooks/metrics';
import { DataList } from '../../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { METRICS_DATA_LIST_PROPS } from '../metrics-utils';
import { shortId } from './memory-card.utils';
import { formatCompactNumber, formatCost } from '@/lib/cost';

export interface MemoryThreadsTableProps {
  rows: ActiveThreadRow[];
  onRowClick?: (row: ActiveThreadRow) => void;
}

export function MemoryThreadsTable({ rows, onRowClick }: MemoryThreadsTableProps) {
  if (rows.length === 0) return <MetricsCard.NoData message="No thread activity yet" />;

  return (
    <DataList columns="auto auto auto auto auto" {...METRICS_DATA_LIST_PROPS}>
      <DataList.Top>
        <DataList.TopCell sticky="start">Thread ID</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Resource ID</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Runs</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Tokens</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
      </DataList.Top>
      {rows.map(row => {
        const cells = (
          <>
            <DataList.RowHeaderCell className="text-caption">{shortId(row.threadId)}</DataList.RowHeaderCell>
            <DataList.NumberCell>{row.resourceId ? shortId(row.resourceId) : '—'}</DataList.NumberCell>
            <DataList.NumberCell highlight>{row.runs.toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{row.tokens > 0 ? formatCompactNumber(row.tokens) : '—'}</DataList.NumberCell>
            <DataList.NumberCell>{row.cost != null ? formatCost(row.cost, row.costUnit) : '—'}</DataList.NumberCell>
          </>
        );

        return onRowClick ? (
          <DataList.RowButton key={row.threadId} onClick={() => onRowClick(row)}>
            {cells}
          </DataList.RowButton>
        ) : (
          <DataList.RowStatic key={row.threadId}>{cells}</DataList.RowStatic>
        );
      })}
    </DataList>
  );
}
