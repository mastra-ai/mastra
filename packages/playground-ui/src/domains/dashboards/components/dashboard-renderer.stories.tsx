import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PinIcon, PinOffIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { userEvent, waitFor, within } from 'storybook/test';
import { dashboardStoryFetch, STORY_BASE_URL } from '../../../../.storybook/fixtures/dashboards';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import { METRICS_DASHBOARD } from '../metrics-dashboard';
import type { DashboardAlert, DashboardAlertAction, DashboardAlertSource, DashboardAlertTarget } from '../widget-kind';
import { DashboardRenderer } from './dashboard-renderer';
import { MetricsCard } from '@/ds/components/MetricsCard';

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
        ...(['input', 'output'] as const).map(part => ({
          id: part,
          source: 'metrics' as const,
          request: 'aggregate' as const,
          name: [`mastra_model_total_${part}_tokens`],
          aggregation: 'sum' as const,
          compare: 'previousWindow' as const,
        })),
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
          {
            label: 'Tokens',
            icon: 'hash',
            format: 'count',
            value: { sum: [{ query: 'input' }, { query: 'output' }] },
            detail: 'input and output',
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
      options: { average: 'average', series: 'series' },
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

type HostResponse = 'per-source' | 'enabled' | 'disabled';

const PERCENTILES = 'Rules cannot read metrics percentiles yet. Use a span percentile such as duration.p95.';

/** One source's answer: a reason for what rules can't read yet, else a link. */
function respondTo(target: DashboardAlertTarget, source: DashboardAlertSource): DashboardAlertAction {
  if (source.ref.percentile !== undefined) return { disabled: PERCENTILES };
  // The renderer labels a part of a combined value "{value}: {query}"; this host watches whole values.
  if (/: /.test(source.label)) return { disabled: 'This is part of a sum. An alert watches the whole value.' };
  if (source.query.source === 'scores' && !source.query.scorerId)
    return { disabled: 'This card reads every scorer. An alert watches one.' };
  return { href: `#alerts/new?card=${target.widget.id}&value=${encodeURIComponent(source.label)}` };
}

/**
 * What a host might answer: per source, so a card with several opens a menu; a link for every card;
 * or one reason for every card.
 */
function respond(response: HostResponse, target: DashboardAlertTarget) {
  if (response === 'enabled') return { href: `#alerts/new?card=${target.widget.id}` };
  if (response === 'disabled') return { disabled: 'Your role cannot create alerts.' };
  return target.sources.map(source => respondTo(target, source));
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
              widgetActions={widget => {
                const isPinned = pinned.includes(widget.id);
                return (
                  <MetricsCard.Action
                    label={`${isPinned ? 'Unpin' : 'Pin'} ${widget.title?.trim() || 'widget'}`}
                    onClick={() =>
                      setPinned(ids => (isPinned ? ids.filter(id => id !== widget.id) : [...ids, widget.id]))
                    }
                    className={
                      isPinned
                        ? undefined
                        : 'hidden group-focus-within/metrics-card:inline-flex group-hover/metrics-card:inline-flex'
                    }
                  >
                    {isPinned ? <PinOffIcon /> : <PinIcon />}
                  </MetricsCard.Action>
                );
              }}
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
        "What the host's `alert.action` returns: per source (percentiles and every-scorer sources disabled), one link for every card, or one reason for every card.",
      control: 'inline-radio',
      options: ['per-source', 'enabled', 'disabled'],
    },
    editing: { description: 'Pass drag handles, as a layout editor does. Cards then show no Create alert button.' },
  },
  args: { hostResponse: 'per-source', editing: false },
};

export default meta;

type Story = StoryObj<typeof AlertingHost>;

/**
 * Every kind with a host answering per source. A card with one source, or one the host can link, has a
 * plain button; one with several opens a menu of them (Agent runs, the KPIs, the tables), a disabled one
 * saying why; one the host can link none of is disabled (Latency, Scores). Agent runs is pinned.
 * Heatmap is an error card, which never shows the button.
 */
export const Default: Story = {};

/** Opens a card's alert menu once the card has settled: a card that re-renders as it loads closes it. */
const openAlertMenu =
  (widgetId: string): Story['play'] =>
  async ({ canvasElement }) => {
    await waitFor(
      async () => {
        if (canvasElement.ownerDocument.querySelector('[role="menu"]')) return;
        const card = canvasElement.querySelector<HTMLElement>(`[data-widget-id="${widgetId}"]`);
        const trigger = card && within(card).queryByRole('button', { name: /^Create alert/ });
        if (trigger) {
          card.scrollIntoView();
          await userEvent.click(trigger);
        }
        throw new Error(`No ${widgetId} alert menu yet`);
      },
      { timeout: 15000, interval: 1000 },
    );
  };

/** The Agent runs card's menu, open: one entry per series. */
export const MenuOpen: Story = { play: openAlertMenu('agent-runs') };

/** The KPI row's menu, open: one entry per figure, the parts of the token sum disabled with their reason. */
export const MenuWithDisabledEntry: Story = { play: openAlertMenu('kpis') };

/** The host answers one link for every card: every button is plain, whatever its sources. */
export const AllEnabled: Story = { args: { hostResponse: 'enabled' } };

/** The host answers a reason for every card. The button is disabled, and its tooltip says why. */
export const AllDisabled: Story = { args: { hostResponse: 'disabled' } };

/** Layout edit mode: drag handles, and no Create alert buttons. */
export const EditingLayout: Story = { args: { editing: true } };
