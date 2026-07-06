import type { ReactNode } from 'react';
import { DataList } from '../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import type { LinkComponent } from '../../../ds/types/link-component';
import type { ModelUsageRow } from '../hooks/use-model-usage-cost-metrics';
import { formatCost, METRICS_DATA_LIST_PROPS } from './metrics-utils';

function getTotalCostSummaryValue(rows: ModelUsageRow[]) {
  const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const units = new Set<string>();
  for (const row of rows) {
    if (row.cost != null && row.costUnit) {
      units.add(row.costUnit);
    }
  }
  if (units.size === 0) {
    return totalCost > 0 ? formatCost(totalCost) : '—';
  }
  if (units.size === 1) {
    return totalCost > 0 ? formatCost(totalCost, [...units][0]) : '—';
  }
  return 'Mixed';
}

export interface ModelUsageCostCardViewProps {
  rows: ModelUsageRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Optional drilldown for a row in the table. */
  getRowHref?: (row: ModelUsageRow) => string | undefined;
  /** Optional slot for top-bar action buttons. */
  actions?: ReactNode;
  /** Override how drilldown links are rendered. Defaults to `<a>`. */
  LinkComponent?: LinkComponent;
}

function ModelUsageCostCardBody({
  rows,
  isLoading,
  isError,
  getRowHref,
  LinkComponent,
}: Pick<ModelUsageCostCardViewProps, 'rows' | 'isLoading' | 'isError' | 'getRowHref' | 'LinkComponent'>) {
  if (isLoading) {
    return <MetricsCard.Loading />;
  }
  if (isError) {
    return <MetricsCard.Error message="Failed to load model usage data" />;
  }
  if (!rows || rows.length === 0) {
    return (
      <MetricsCard.Content>
        <MetricsCard.NoData message="No model usage data yet" />
      </MetricsCard.Content>
    );
  }
  return (
    <MetricsCard.Content>
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
          const href = getRowHref?.(row);
          const rowCells = (
            <>
              <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                {row.model}
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

          return href ? (
            <DataList.RowLink key={row.model} to={href} LinkComponent={LinkComponent}>
              {rowCells}
            </DataList.RowLink>
          ) : (
            <DataList.RowStatic key={row.model}>{rowCells}</DataList.RowStatic>
          );
        })}
      </DataList>
    </MetricsCard.Content>
  );
}

export function ModelUsageCostCardView({
  rows,
  isLoading,
  isError,
  getRowHref,
  actions,
  LinkComponent,
}: ModelUsageCostCardViewProps) {
  const totalCostSummary = rows && rows.length > 0 ? getTotalCostSummaryValue(rows) : undefined;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
        {totalCostSummary !== undefined && <MetricsCard.Summary value={totalCostSummary} label="Total cost" />}
        {actions ? <MetricsCard.Actions>{actions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      <ModelUsageCostCardBody
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        getRowHref={getRowHref}
        LinkComponent={LinkComponent}
      />
    </MetricsCard>
  );
}
