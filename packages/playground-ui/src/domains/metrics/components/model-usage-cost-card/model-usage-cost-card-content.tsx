import type { ModelUsageRow } from '@mastra/react/hooks/metrics';
import { DataList } from '../../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { Txt } from '../../../../ds/components/Txt';
import { METRICS_DATA_LIST_PROPS } from '../metrics-utils';
import { formatCost } from '@/lib/cost';

export interface ModelUsageCostCardContentProps {
  rows: ModelUsageRow[];
  onRowClick?: (row: ModelUsageRow) => void;
}

export function ModelUsageCostCardContent({ rows, onRowClick }: ModelUsageCostCardContentProps) {
  if (rows.length === 0) return <MetricsCard.NoData message="No model usage data yet" />;

  return (
    <DataList columns="auto auto auto auto auto auto" {...METRICS_DATA_LIST_PROPS}>
      <DataList.Top>
        <DataList.TopCell sticky="start">Model</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Input</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Output</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Cache Read</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Cache Write</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
      </DataList.Top>
      {rows.map(row => {
        const key = `${row.model}:${row.provider ?? ''}`;
        const cells = (
          <>
            <DataList.RowHeaderCell className="text-caption">
              <span className="flex flex-col">
                <span>{row.model}</span>
                {row.provider && (
                  <Txt as="span" variant="caption" tone="faint">
                    {row.provider}
                  </Txt>
                )}
              </span>
            </DataList.RowHeaderCell>
            <DataList.NumberCell>{row.input}</DataList.NumberCell>
            <DataList.NumberCell>{row.output}</DataList.NumberCell>
            <DataList.NumberCell>{row.cacheRead}</DataList.NumberCell>
            <DataList.NumberCell>{row.cacheWrite}</DataList.NumberCell>
            <DataList.NumberCell highlight>
              {row.cost != null ? formatCost(row.cost, row.costUnit) : '—'}
            </DataList.NumberCell>
          </>
        );

        return onRowClick ? (
          <DataList.RowButton key={key} onClick={() => onRowClick(row)}>
            {cells}
          </DataList.RowButton>
        ) : (
          <DataList.RowStatic key={key}>{cells}</DataList.RowStatic>
        );
      })}
    </DataList>
  );
}
