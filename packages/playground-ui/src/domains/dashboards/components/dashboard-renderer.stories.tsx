import type { DashboardDefinition, DashboardQuery } from '@mastra/client-js';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { z } from 'zod/v4';
import { ChartCard } from '../../metrics/components/chart-card';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import { defineWidgetKind } from '../widget-kind';
import { DashboardRenderer } from './dashboard-renderer';
import type { DashboardRendererProps } from './dashboard-renderer';
import { PinAction } from './widget-controls';
import { Txt } from '@/ds/components/Txt';

/** A kind that draws its options as is, so the story needs no server; it shows its pin as built-in kinds do. */
const statKind = defineWidgetKind({
  kind: 'stat',
  optionsSchema: z.strictObject({ total: z.string(), caption: z.string() }),
  component: ({ widget, views, pin }) => (
    <ChartCard
      title={widget.title ?? ''}
      total={views[0].options.total}
      actions={pin && <PinAction {...pin} />}
      bodyHeight="fit"
    >
      <Txt variant="body-sm" tone="muted">
        {views[0].options.caption}
      </Txt>
    </ChartCard>
  ),
});

/** Every view carries a query; the stat kind never sends it. */
const unused: DashboardQuery = { source: 'metrics', request: 'aggregate', name: ['unused'], aggregation: 'count' };

const stat = (id: string, title: string, total: string, caption: string, span: 3 | 4 | 6 | 12) => ({
  id,
  title,
  span,
  kind: 'stat',
  views: [{ queries: [unused], options: { total, caption } }],
});

const definition: DashboardDefinition = {
  schemaVersion: 1,
  rows: [
    {
      widgets: [
        stat('runs', 'Agent runs', '12.4K', 'Runs in the last 24 hours', 4),
        stat('errors', 'Errors', '38', 'Failed runs in the last 24 hours', 4),
        stat('latency', 'P95 latency', '1.8s', 'Across all agents', 4),
      ],
    },
    { widgets: [stat('spend', 'Spend', '$27.40', 'Model spend in the last 24 hours', 12)] },
  ],
};

function Dashboard(props: Omit<DashboardRendererProps, 'definition' | 'scope' | 'kinds'>) {
  return (
    <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      <div className="w-[min(64rem,calc(100vw-3rem))]">
        <DashboardRenderer definition={definition} scope="project" kinds={[statKind]} {...props} />
      </div>
    </MetricsProvider>
  );
}

/** A host that owns which widgets are pinned, as the MCP app's host does. */
function PinningHost({ initiallyPinned }: { initiallyPinned: string[] }) {
  const [pinned, setPinned] = useState(initiallyPinned);
  return (
    <Dashboard
      isPinned={id => pinned.includes(id)}
      onPin={(widget, next) => setPinned(ids => (next ? [...ids, widget.id] : ids.filter(id => id !== widget.id)))}
    />
  );
}

const meta: Meta<typeof DashboardRenderer> = {
  title: 'Dashboards/DashboardRenderer',
  component: DashboardRenderer,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof DashboardRenderer>;

/** No `onPin`: the dashboard alone, no pin buttons. */
export const Default: Story = {
  render: () => <Dashboard />,
};

/** With `onPin`, each card shows a pin button with its actions, on hover. Click one to pin that widget. */
export const Pinnable: Story = {
  render: () => <PinningHost initiallyPinned={[]} />,
};

/** `isPinned` says "Errors" is pinned: hover it to unpin. */
export const Pinned: Story = {
  render: () => <PinningHost initiallyPinned={['errors']} />,
};
