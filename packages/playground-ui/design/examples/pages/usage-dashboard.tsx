import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { CompactNumber } from '@mastra/playground-ui/components/CompactNumber';
import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Table } from '@mastra/playground-ui/components/Table';
import { formatFullNumber } from '@mastra/playground-ui/utils/cost';

export type UsageRange = 'last-24h' | 'last-7d' | 'last-30d';

const ranges: readonly UsageRange[] = ['last-24h', 'last-7d', 'last-30d'];

const isRange = (value: string): value is UsageRange => ranges.some(range => range === value);

export type UsageTotals = { requests: number; spend: number; changePct: number };

export type ModelUsage = { id: string; name: string; requests: number; spend: number };

export type UsageDashboardProps = {
  range: UsageRange;
  onRangeChange: (range: UsageRange) => void;
  totals: UsageTotals;
  models: ModelUsage[];
  onConnect: () => void;
  onOpenModel: (id: string) => void;
};

export function UsageDashboard({ range, onRangeChange, totals, models, onConnect, onOpenModel }: UsageDashboardProps) {
  return (
    <PageLayout
      breadcrumbs={
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <Crumb as="span">Gateway</Crumb>
          <Crumb as="span" isCurrent>
            Usage
          </Crumb>
        </Breadcrumb>
      }
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <DateTimeRangePicker
              preset={range}
              presets={ranges}
              defaultPreset="last-7d"
              onPresetChange={preset => {
                if (isRange(preset)) onRangeChange(preset);
              }}
            />
          </ActionRow.Start>
          <ActionRow.End>
            <Button variant="primary" onClick={onConnect}>
              Connect
            </Button>
          </ActionRow.End>
        </ActionRow>
      }
    >
      <div className="grid content-start gap-4 pb-6">
        <div className="flex flex-wrap gap-4">
          <MetricsKpiCard>
            <MetricsKpiCard.Label>Requests</MetricsKpiCard.Label>
            <MetricsKpiCard.ValueRow>
              <MetricsKpiCard.Value>
                <CompactNumber value={totals.requests} />
              </MetricsKpiCard.Value>
              <MetricsKpiCard.Change comparison="vs previous period" changePct={totals.changePct} />
            </MetricsKpiCard.ValueRow>
          </MetricsKpiCard>
          <MetricsKpiCard>
            <MetricsKpiCard.Label>Spend</MetricsKpiCard.Label>
            <MetricsKpiCard.ValueRow>
              <MetricsKpiCard.Value>
                <CompactNumber value={totals.spend} currency="USD" />
              </MetricsKpiCard.Value>
            </MetricsKpiCard.ValueRow>
          </MetricsKpiCard>
        </div>
        <Table variant="inset" aria-label="Usage by model">
          <Table.Header>
            <Table.Row>
              <Table.Head className="w-full">Model</Table.Head>
              <Table.Head align="end">Requests</Table.Head>
              <Table.Head align="end">Spend</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {models.map(model => (
              <Table.Row key={model.id}>
                <Table.Cell>
                  <Table.RowButton onClick={() => onOpenModel(model.id)}>{model.name}</Table.RowButton>
                </Table.Cell>
                <Table.Cell align="end">{formatFullNumber(model.requests)}</Table.Cell>
                <Table.Cell align="end">{formatFullNumber(model.spend, { currency: 'USD' })}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </PageLayout>
  );
}
