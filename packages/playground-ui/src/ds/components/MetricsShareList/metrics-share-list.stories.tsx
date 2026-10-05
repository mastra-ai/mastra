import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MetricsShareList } from './metrics-share-list';
import type { MetricsShareListRow } from './metrics-share-list';

const n = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const agents: MetricsShareListRow[] = [
  ['Code Agent', 102, 6],
  ['Observer', 22, 1],
  ['Research Supervisor', 14, 2],
  ['Billing Agent', 6, 0],
  ['Content Moderation Assistant', 3, 0],
  ['Triage Agent', 2, 0],
  ['Release Notes Writer', 1, 1],
].map(([label, runs, errors]) => ({
  key: String(label),
  label: String(label),
  share: Number(runs),
  value: n.format(Number(runs)),
  cells: [`${((Number(errors) / Number(runs)) * 100).toFixed(1)}%`],
}));

/** A long tail of routes on a power law, the way production traffic looks. */
const routes: MetricsShareListRow[] = Array.from({ length: 1000 }, (_, i) => {
  const requests = Math.max(1, Math.round(12_000 / Math.pow(i + 1, 1.1)));
  return {
    key: `GET /api/route-${i}`,
    label: `GET /api/route-${i}`,
    share: requests,
    value: n.format(requests),
    cells: [`${(20 + (i % 7) * 30).toFixed(0)}ms`],
  };
});

const meta: Meta<typeof MetricsShareList> = {
  title: 'Metrics/MetricsShareList',
  component: MetricsShareList,
  parameters: { layout: 'centered' },
  args: { rows: agents, columns: [{ label: 'Error rate' }], valueLabel: 'Runs' },
  render: args => (
    <div className="w-[min(36rem,calc(100vw-3rem))]">
      <MetricsShareList {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof MetricsShareList>;

/** A summary card: the top five, the rest folded into "Other". */
export const Summary: Story = {
  args: {
    other: rest => ({ value: n.format(rest.reduce((sum, r) => sum + r.share, 0)), cells: ['—'] }),
  },
};

/**
 * A list to scan: the top 15 in five cool hues, then "Show 50 more" pages the rest in. Past 50
 * rows, segments would go sub-pixel, so the tail shares the gray one. Click a row to make it
 * active: it stays listed even when it ranks far down.
 */
export const LongList: Story = {
  render: args => {
    const [active, setActive] = useState<string>();
    return (
      <div className="w-[min(48rem,calc(100vw-3rem))]">
        <MetricsShareList
          {...args}
          rows={routes.map(r => ({ ...r, onClick: () => setActive(a => (a === r.key ? undefined : r.key)) }))}
          activeKey={active}
        />
      </div>
    );
  },
  args: {
    columns: [{ label: 'P50', width: 'w-14' }],
    valueLabel: 'Requests',
    valueWidth: 'w-16',
    palette: 'hues',
    limit: 15,
    overflow: 'more',
  },
};

/** One huge share next to tiny ones: every non-zero share keeps a visible segment, zeros get none. */
export const TinyShares: Story = {
  args: {
    rows: [
      { key: 'a', label: 'claude-opus-5-5', share: 29.84, value: '$29.84' },
      { key: 'b', label: 'deepseek-v4-flash', share: 0.12, value: '$0.12' },
      { key: 'c', label: 'deepseek-flash', share: 0.004, value: '<$0.01' },
      { key: 'd', label: 'cached-replay', share: 0, value: '$0.00' },
    ],
    columns: [],
    valueLabel: 'Cost',
  },
};

export const Empty: Story = { args: { rows: [], emptyState: 'No runs in this range.' } };

/** Skeleton rows in the list's own markup, so the card keeps its height when data lands. */
export const Loading: Story = { args: { isLoading: true } };
