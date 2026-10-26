import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MetricsTable } from './metrics-table';
import type { MetricsTableColumn, MetricsTableSort } from './metrics-table-types';
import { ProviderLogo } from '@/domains/llm';
import { SeriesMark } from '@/ds/components/SeriesMark';
import { Sparkline } from '@/ds/components/Sparkline';

type ModelRow = { key: string; provider: string; color: string; spend: number; trend: number[] };

const wave = (peak: number, phase: number) =>
  Array.from({ length: 28 }, (_, i) => peak * (0.55 + 0.45 * Math.sin((i + phase) / 2)));

const models: ModelRow[] = [
  {
    key: 'anthropic/claude-sonnet-4.5',
    provider: 'anthropic',
    color: 'var(--chart-green)',
    spend: 119.08,
    trend: wave(5, 0),
  },
  { key: 'openai/gpt-5', provider: 'openai', color: 'var(--chart-blue)', spend: 30.73, trend: wave(1.4, 1) },
  {
    key: 'anthropic/claude-haiku-4.5',
    provider: 'anthropic',
    color: 'var(--chart-purple)',
    spend: 19.81,
    trend: wave(0.9, 2),
  },
  { key: 'openai/gpt-5-mini', provider: 'openai', color: 'var(--chart-orange)', spend: 6.34, trend: wave(0.3, 3) },
  { key: 'google/gemini-2.5-pro', provider: 'google', color: 'var(--chart-pink)', spend: 6.32, trend: wave(0.3, 4) },
];
const total = models.reduce((s, m) => s + m.spend, 0);
const usd = (v: number) => `$${v.toFixed(2)}`;

const legendColumns = (hidden: string[]): MetricsTableColumn<ModelRow>[] => [
  {
    id: 'name',
    header: 'Model',
    width: 'minmax(0,1fr)',
    sortValue: m => m.key,
    firstDirection: 'asc',
    cell: m => (
      <span className="flex min-w-0 items-center gap-2">
        <SeriesMark color={m.color} icon={<ProviderLogo providerId={m.provider} size={14} />} />
        <span className="truncate font-medium">{m.key}</span>
      </span>
    ),
  },
  {
    id: 'trend',
    header: 'Trend',
    width: '7rem',
    align: 'end',
    cell: m => <Sparkline values={m.trend} color={hidden.includes(m.key) ? 'var(--border)' : m.color} />,
  },
  {
    id: 'share',
    header: 'Share',
    width: '4.5rem',
    align: 'end',
    cell: m => <span className="text-muted-foreground tabular-nums">{((m.spend / total) * 100).toFixed(1)}%</span>,
  },
  {
    id: 'spend',
    header: 'Spend',
    width: 'minmax(7rem,max-content)',
    align: 'end',
    sortValue: m => m.spend,
    cell: m => <span className="tabular-nums">{usd(m.spend)}</span>,
  },
];

const meta: Meta<typeof MetricsTable> = {
  title: 'Metrics/MetricsTable',
  component: MetricsTable,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof MetricsTable>;

/**
 * Under a chart, as its legend: `SeriesMark` with the provider logo in the series color, a
 * `Sparkline`, rows that report hover (to highlight the line) and click (to hide it). The sort is
 * controlled, as a page that keeps it in the URL would.
 */
export const ChartLegend: Story = {
  render: function Render() {
    const [sort, setSort] = useState<MetricsTableSort>({ column: 'spend', direction: 'desc' });
    const [hidden, setHidden] = useState<string[]>([]);
    const [hover, setHover] = useState<string>();
    return (
      <div className="w-[min(56rem,calc(100vw-3rem))]">
        <MetricsTable
          aria-label="Spend by model"
          columns={legendColumns(hidden)}
          rows={models}
          getRowKey={m => m.key}
          sort={sort}
          onSortChange={setSort}
          onRowHover={m => setHover(m?.key)}
          onRowClick={m => setHidden(h => (h.includes(m.key) ? h.filter(k => k !== m.key) : [...h, m.key]))}
          isRowDimmed={m => hidden.includes(m.key)}
          rowTitle={m => (hidden.includes(m.key) ? 'Show this line' : 'Hide this line')}
        />
        <p className="mt-3 text-body-sm text-muted-foreground">Hovered: {hover ?? 'none'}</p>
      </div>
    );
  },
};

type AgentRow = { name: string; errors: number; p95: string; tokens: string; cost: number; runs: number };

const agents: AgentRow[] = [
  { name: 'Hydra', errors: 0, p95: '2.2m', tokens: '1.2M', cost: 4.94, runs: 4 },
  { name: 'Call Intelligence', errors: 0, p95: '44.6s', tokens: '43.1K', cost: 0.14, runs: 1 },
  { name: 'Deconfliction', errors: 0, p95: '21.9s', tokens: '42.6K', cost: 0.13, runs: 1 },
  { name: 'Observability', errors: 0, p95: '—', tokens: '0', cost: 0, runs: 0 },
];

const num = (v: string) => <span className="text-muted-foreground tabular-nums">{v}</span>;

/** A plain data table under a chart: no marks or row actions, uncontrolled sort. */
export const DataTable: Story = {
  render: () => (
    <div className="w-[min(56rem,calc(100vw-3rem))]">
      <MetricsTable
        aria-label="Agent runs"
        rows={agents}
        getRowKey={a => a.name}
        defaultSort={{ column: 'runs', direction: 'desc' }}
        columns={[
          {
            id: 'name',
            header: 'Agent',
            width: 'minmax(0,1fr)',
            cell: a => a.name,
            sortValue: a => a.name,
            firstDirection: 'asc',
          },
          { id: 'errors', header: 'Errors', width: '4.5rem', align: 'end', cell: a => num(`${a.errors}%`) },
          { id: 'p95', header: 'P95', width: '4.5rem', align: 'end', cell: a => num(a.p95) },
          { id: 'tokens', header: 'Tokens', width: '4.5rem', align: 'end', cell: a => num(a.tokens) },
          {
            id: 'cost',
            header: 'Cost',
            width: '4.5rem',
            align: 'end',
            cell: a => num(usd(a.cost)),
            sortValue: a => a.cost,
          },
          {
            id: 'runs',
            header: 'Runs',
            width: '4.5rem',
            align: 'end',
            cell: a => <span className="tabular-nums">{a.runs}</span>,
            sortValue: a => a.runs,
          },
        ]}
      />
    </div>
  ),
};
