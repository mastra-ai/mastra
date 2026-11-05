import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { dashboardStoryFetch, STORY_BASE_URL } from '../../../../.storybook/fixtures/dashboards';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import { METRICS_DASHBOARD } from '../metrics-dashboard';
import type { DashboardAlert, DashboardAlertAction, DashboardAlertTarget } from '../widget-kind';
import { DashboardRenderer } from './dashboard-renderer';

type Definition = ComponentProps<typeof DashboardRenderer>['definition'];
type Widget = Definition['rows'][number]['widgets'][number];

const bundled = (id: string): Widget => {
  const found = METRICS_DASHBOARD.rows.flatMap(row => row.widgets).find(w => w.id === id);
  if (!found) throw new Error(`METRICS_DASHBOARD has no ${id} widget`);
  return found;
};

const AGENT_RUNS = 'mastra_agent_duration_ms';

const kpis: Widget = {
  id: 'kpis',
  span: 12,
  kind: 'kpis',
  views: [
    {
      queries: [
        {
          id: 'runs',
          source: 'metrics',
          request: 'aggregate',
          name: [AGENT_RUNS],
          aggregation: 'count',
          compare: 'previousWindow',
        },
        {
          id: 'threads',
          source: 'metrics',
          request: 'aggregate',
          name: [AGENT_RUNS],
          aggregation: 'count_distinct',
          distinctColumn: 'threadId',
          compare: 'previousWindow',
        },
      ],
      options: {
        items: [
          { label: 'Agent runs', icon: 'bot', format: 'count', value: { query: 'runs' }, detail: 'in this range' },
          {
            label: 'Threads',
            icon: 'threads',
            format: 'count',
            value: { query: 'threads' },
            detail: 'with agent runs',
          },
        ],
      },
    },
  ],
};

const scores: Widget = {
  id: 'scores',
  span: 6,
  kind: 'scores',
  title: 'Scores',
  views: [
    {
      queries: [
        { id: 'average', source: 'scores', request: 'aggregate', aggregation: 'avg' },
        { id: 'series', source: 'scores', request: 'timeSeries', aggregation: 'avg' },
      ],
      options: { average: 'average', series: 'series', emptyMessage: 'No scores in this range.' },
    },
  ],
};

const breakdown = bundled('breakdown');
const projectViews = breakdown.views.filter(view => view.scope !== 'org');
const modelsView = projectViews.filter(view => view.label === 'Breakdown by model');

/** A widget of a kind this version doesn't know: it renders as an error card. */
const unknownKind: Widget = {
  id: 'heatmap',
  span: 6,
  kind: 'heatmap',
  title: 'Heatmap',
  views: [{ queries: [{ source: 'metrics', request: 'aggregate', name: [AGENT_RUNS], aggregation: 'count' }] }],
};

/** One card of every kind: KPIs, timeseries (one with a drilldown), scores, a tabbed table, a one-view table and an error card. */
const definition: Definition = {
  schemaVersion: 1,
  rows: [
    { widgets: [kpis] },
    {
      widgets: [
        { ...bundled('agent-runs'), drilldown: { action: { page: 'traces', filters: [] } } },
        bundled('latency'),
      ],
    },
    { widgets: [scores, bundled('token-usage')] },
    { widgets: [{ ...breakdown, views: projectViews }] },
    { widgets: [{ ...breakdown, id: 'models', title: 'Models', span: 6, views: modelsView }, unknownKind] },
  ],
};

type HostResponse = 'mixed' | 'enabled' | 'disabled';

/** What a host might answer: a link for most cards, a reason for those it can't turn into rules. */
function respond(response: HostResponse, target: DashboardAlertTarget): DashboardAlertAction {
  const href = `#alerts/new?card=${target.widget.id}`;
  if (response === 'enabled') return { href };
  if (response === 'disabled') return { disabled: 'Your role cannot create alerts.' };
  if (target.queries.some(q => (q.source === 'metrics' || q.source === 'scores') && q.request === 'percentiles'))
    return { disabled: 'Rules cannot read metrics percentiles yet. Use a span percentile such as duration.p95.' };
  if (target.queries.some(q => q.source === 'scores' && !q.scorerId))
    return { disabled: 'This card reads every scorer. An alert watches one.' };
  return { href };
}

type Args = { hostResponse: HostResponse; editing: boolean };

function AlertingHost({ hostResponse, editing }: Args) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [pinned, setPinned] = useState<string[]>(['agent-runs']);
  const [opened, setOpened] = useState<string>();
  const alert: DashboardAlert = {
    action: target => respond(hostResponse, target),
    LinkComponent: ({ href, ...props }) => (
      <a
        {...props}
        href={href}
        onClick={event => {
          event.preventDefault();
          setOpened(href);
        }}
      />
    ),
  };
  return (
    <MastraReactProvider baseUrl={STORY_BASE_URL} customFetch={dashboardStoryFetch}>
      <QueryClientProvider client={queryClient}>
        <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
          <div className="space-y-3 p-4">
            <p className="text-ui-sm text-muted-foreground">
              {opened ? `The host would open ${opened}` : 'Hover a card for its Create alert button.'}
            </p>
            <DashboardRenderer
              definition={definition}
              scope="project"
              onDrilldown={() => {}}
              alert={alert}
              dragHandle={editing ? id => ({ 'aria-label': `Move ${id}`, draggable: true }) : undefined}
              isPinned={id => pinned.includes(id)}
              onPin={(widget, next) =>
                setPinned(ids => (next ? [...ids, widget.id] : ids.filter(id => id !== widget.id)))
              }
            />
          </div>
        </MetricsProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

const meta: Meta<typeof AlertingHost> = {
  title: 'Dashboards/DashboardRenderer/Card alerts',
  component: AlertingHost,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    hostResponse: {
      description:
        "What the host's `alert.action` returns: a link for every card, a reason for every card, or a mix (percentiles and multi-scorer cards disabled).",
      control: 'inline-radio',
      options: ['mixed', 'enabled', 'disabled'],
    },
    editing: { description: 'Pass drag handles, as a layout editor does. Cards then show no Create alert button.' },
  },
  args: { hostResponse: 'mixed', editing: false },
};

export default meta;

type Story = StoryObj<typeof AlertingHost>;

/** Every kind with an `alert` host. Agent runs is pinned. Heatmap is an error card, which never shows the button. */
export const Default: Story = {};

/** The host answers a link for every card. */
export const AllEnabled: Story = { args: { hostResponse: 'enabled' } };

/** The host answers a reason for every card. The button is disabled, and its tooltip says why. */
export const AllDisabled: Story = { args: { hostResponse: 'disabled' } };

/** Layout edit mode: drag handles, and no Create alert buttons. */
export const EditingLayout: Story = { args: { editing: true } };
