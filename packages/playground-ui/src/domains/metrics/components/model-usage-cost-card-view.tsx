import type { ElementType, ReactNode } from 'react';
import { DataList } from '../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import type { LinkComponent as DataListLinkComponent } from '../../../ds/types/link-component';
import type { ModelUsageRow } from '../hooks/use-model-usage-cost-metrics';
import { formatCost } from './metrics-utils';

export interface ModelUsageCostCardViewProps {
  rows: ModelUsageRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Optional drilldown for a row in the table. */
  getRowHref?: (row: ModelUsageRow) => string | undefined;
  /** Optional slot for top-bar action buttons. */
  actions?: ReactNode;
  /** Override how drilldown links are rendered. Defaults to `<a>`. */
  LinkComponent?: ElementType;
}

export function ModelUsageCostCardView({
  rows,
  isLoading,
  isError,
  getRowHref,
  actions,
  LinkComponent,
}: ModelUsageCostCardViewProps) {
  const hasData = !!rows && rows.length > 0;
  const RowLinkComponent = (LinkComponent ?? 'a') as DataListLinkComponent;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
        {hasData &&
          (() => {
            const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
            const units = new Set<string>();
            for (const row of rows) {
              if (row.cost != null && row.costUnit) {
                units.add(row.costUnit);
              }
            }
            let value: string;
            if (units.size === 0) {
              value = totalCost > 0 ? formatCost(totalCost) : '—';
            } else if (units.size === 1) {
              value = totalCost > 0 ? formatCost(totalCost, [...units][0]) : '—';
            } else {
              value = 'Mixed';
            }
            return <MetricsCard.Summary value={value} label="Total cost" />;
          })()}
        {actions ? <MetricsCard.Actions>{actions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load model usage data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No model usage data yet" />
          ) : (
            <DataList columns="auto auto auto auto auto auto" variant="lined" className="max-h-80">
              <DataList.Top>
                <DataList.TopCell sticky="start">Model</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Input</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Output</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Cache Read</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Cache Write</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
              </DataList.Top>
              {rows.map(row => {
                const href = getRowHref?.(row);
                const rowCells = (
                  <>
                    <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                      {row.model}
                    </DataList.RowHeaderCell>
                    <DataList.Cell
                      height="compact"
                      className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                    >
                      {row.input}
                    </DataList.Cell>
                    <DataList.Cell
                      height="compact"
                      className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                    >
                      {row.output}
                    </DataList.Cell>
                    <DataList.Cell
                      height="compact"
                      className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                    >
                      {row.cacheRead}
                    </DataList.Cell>
                    <DataList.Cell
                      height="compact"
                      className="justify-items-end text-right text-ui-sm tabular-nums text-neutral3"
                    >
                      {row.cacheWrite}
                    </DataList.Cell>
                    <DataList.Cell
                      height="compact"
                      className="justify-items-end text-right text-ui-sm tabular-nums text-neutral4 font-semibold"
                    >
                      {row.cost != null ? formatCost(row.cost, row.costUnit) : '—'}
                    </DataList.Cell>
                  </>
                );

                return href ? (
                  <DataList.RowLink key={row.model} to={href} LinkComponent={RowLinkComponent}>
                    {rowCells}
                  </DataList.RowLink>
                ) : (
                  <DataList.RowStatic key={row.model}>{rowCells}</DataList.RowStatic>
                );
              })}
            </DataList>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
