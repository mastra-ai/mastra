import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShareBar } from './share-bar';
import type { ShareBarRow } from './share-bar-types';

const n = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const agents: ShareBarRow[] = [
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
const routes: ShareBarRow[] = Array.from({ length: 1000 }, (_, i) => {
  const requests = Math.max(1, Math.round(12_000 / Math.pow(i + 1, 1.1)));
  return {
    key: `GET /api/route-${i}`,
    label: `GET /api/route-${i}`,
    share: requests,
    value: n.format(requests),
    cells: [`${(20 + (i % 7) * 30).toFixed(0)}ms`],
  };
});

const meta: Meta<typeof ShareBar> = {
  title: 'Metrics/ShareBar',
  component: ShareBar,
  parameters: { layout: 'centered' },
  args: { rows: agents, columns: [{ label: 'Error rate' }], valueLabel: 'Runs' },
  render: args => (
    <div className="w-[min(36rem,calc(100vw-3rem))]">
      <ShareBar {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof ShareBar>;

/** A summary card: the top five, the rest folded into "Other". */
export const Summary: Story = {
  args: {
    other: rest => ({ value: n.format(rest.reduce((sum, r) => sum + r.share, 0)), cells: ['—'] }),
  },
};

/**
 * A long list: the top 15 in five cool hues, then "Show 50 more" pages the rest in. Past 50
 * rows, segments would go sub-pixel, so the tail shares the gray one.
 */
export const LongList: Story = {
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <ShareBar {...args} />
    </div>
  ),
  args: {
    rows: routes,
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

/** A compact card's list: five rows, then "Show 5 more". */
export const ShowMore: Story = {
  args: { overflow: 'more', pageSize: 5, palette: 'hues' },
};
