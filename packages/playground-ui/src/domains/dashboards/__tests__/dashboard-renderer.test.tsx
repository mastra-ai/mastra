// @vitest-environment jsdom
import type { DashboardDefinition, DashboardQuery, DashboardWidget } from '@mastra/client-js';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PinIcon, PinOffIcon } from 'lucide-react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { modelSpansByModel, usageByModel } from '../../metrics/components/__tests__/fixtures/breakdown';
import {
  distinctIdsSeriesFixture,
  aggregateCapabilities,
  distinctIdsTotalsFixture,
  traceAggregateCapabilities,
} from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import {
  openViewMenu,
  pickView,
  seedMetrics,
  serveCapabilities,
  serveTraceAggregate,
} from '../../metrics/components/__tests__/metrics-msw';
import type { TraceAggregateRequest } from '../../metrics/components/__tests__/metrics-msw';
import { ChartCard } from '../../metrics/components/chart-card';
import { MetricsProvider, useMetrics } from '../../metrics/hooks/use-metrics';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import type { DashboardRendererProps } from '../components/dashboard-renderer';
import { DrilldownAction } from '../components/widget-controls';
import { useViewMenu } from '../hooks/use-widget-views';
import type { DashboardScope, OnDashboardDrilldown } from '../lib/definition';
import { defineWidgetKind } from '../widget-kind';
import type {
  AnyWidgetKind,
  DashboardAlert,
  DashboardAlertAction,
  DashboardAlertSource,
  DashboardAlertTarget,
  DashboardExpand,
} from '../widget-kind';
import { metricsWidget, modelsWidget as models } from './equality-harness';
import { kpisWidget, scoresWidget } from './fixtures/metrics-widgets';
import { MetricsCard, onCardHover } from '@/ds/components/MetricsCard';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const agentRunsWidget = metricsWidget('agent-runs');
const distinctIdsWidget = metricsWidget('distinct-ids');
const modelsWidget = models();

const LOAD_ERROR = "Couldn't load this data. Try again in a moment.";

/** A kind defined entirely outside the renderer: one line of text per view. */
const noteKind = defineWidgetKind({
  kind: 'note',
  optionsSchema: z.strictObject({ text: z.string() }),
  component: ({ widget, views }) => (
    <p data-testid={`note-${widget.id}`}>{views.map(v => v.options.text).join(' / ')}</p>
  ),
});

/** A kind whose component throws while rendering. */
const brokenKind = defineWidgetKind({
  kind: 'broken',
  optionsSchema: z.object({}),
  component: () => {
    throw new Error('Render failed.');
  },
});

/** A kind that throws while rendering on an unfiltered page. */
const unfilteredFailsKind = defineWidgetKind({
  kind: 'unfilteredFails',
  optionsSchema: z.object({}),
  component: function UnfilteredFails({ widget }) {
    if (useMetrics().filterTokens.length === 0) throw new Error('Needs a filter.');
    return <p data-testid={`filtered-${widget.id}`}>Filtered</p>;
  },
});

/** A kind built on the shared controls: its view menu and its action button. */
const controlsKind = defineWidgetKind({
  kind: 'controls',
  optionsSchema: z.object({}),
  component: function Controls({ widget, views, onDrilldown }) {
    const { view, heading } = useViewMenu(widget, views);
    return (
      <ChartCard {...heading} actions={<DrilldownAction widget={widget} view={view} onDrilldown={onDrilldown} />}>
        <p>{view.label ?? widget.title}</p>
      </ChartCard>
    );
  },
});

/** Note views carry a query, as every view must; the note kind never sends it. */
const unused: DashboardQuery = { source: 'metrics', request: 'aggregate', name: ['unused'], aggregation: 'count' };

const note = (id: string, text: string, extra: Partial<DashboardWidget> = {}): DashboardWidget => ({
  id,
  span: 6,
  kind: 'note',
  views: [{ queries: [unused], options: { text } }],
  ...extra,
});

/** A host's pin state, as the MCP app's host keeps it: the widget's id says whether it's pinned. */
type PinningProps = {
  onPin: (widget: DashboardWidget, isPinned: boolean) => void;
  isPinned: (widgetId: string) => boolean;
};

/** Pin buttons from a host's pin state, as a host composes them with `MetricsCard.Action`: waiting for hover, unless pinned. */
const pinning =
  ({ onPin, isPinned }: PinningProps) =>
  (widget: DashboardWidget) => {
    const pinned = isPinned(widget.id);
    return (
      <MetricsCard.Action
        label={`${pinned ? 'Unpin' : 'Pin'} ${widget.title?.trim() || 'widget'}`}
        onClick={() => onPin(widget, !pinned)}
        className={pinned ? undefined : onCardHover}
      >
        {pinned ? <PinOffIcon /> : <PinIcon />}
      </MetricsCard.Action>
    );
  };

function renderDashboard(
  definition: DashboardDefinition,
  {
    kinds = [noteKind, brokenKind],
    scope,
    environment,
    filterTokens = environment ? [{ fieldId: 'environment', value: environment }] : [],
    onDrilldown,
    expand,
    dragHandle,
    pin,
    alert,
  }: {
    kinds?: AnyWidgetKind[];
    onDrilldown?: OnDashboardDrilldown;
    expand?: DashboardExpand;
    dragHandle?: DashboardRendererProps['dragHandle'];
    alert?: DashboardAlert;
    pin?: PinningProps;
    scope?: { metrics: MetricsScope; dashboard: DashboardScope };
    environment?: string;
    filterTokens?: { fieldId: string; value: string }[];
  } = {},
) {
  const wrap = (ui: ReactNode) => (
    <MetricsProvider
      preset="24h"
      filterTokens={filterTokens}
      onPresetChange={() => {}}
      onFilterTokensChange={() => {}}
      scope={scope?.metrics}
    >
      {ui}
    </MetricsProvider>
  );
  return renderWithProviders(
    wrap(
      <DashboardRenderer
        definition={definition}
        kinds={kinds}
        scope={scope?.dashboard ?? 'project'}
        onDrilldown={onDrilldown}
        expand={expand}
        dragHandle={dragHandle}
        alert={alert}
        widgetActions={pin && pinning(pin)}
      />,
    ),
  );
}

const cell = (container: HTMLElement, id: string) => {
  const found = container.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
  if (!found) throw new Error(`No widget ${id}`);
  return found;
};

const definition = (...widgets: DashboardWidget[]): DashboardDefinition => ({
  schemaVersion: 1,
  rows: [{ widgets }],
});

beforeEach(() => {
  seedMetrics();
});

describe('DashboardRenderer', () => {
  describe('when a host registers its own kind', () => {
    it('renders it with no change to the renderer', () => {
      renderDashboard(definition(note('a', 'Hello'), note('b', 'World')));
      expect(screen.getByTestId('note-a').textContent).toBe('Hello');
      expect(screen.getByTestId('note-b').textContent).toBe('World');
    });
  });

  describe('when one widget fails', () => {
    it("shows an unknown kind's own error, and the rest still render", () => {
      const { container } = renderDashboard(
        definition({ ...note('a', 'x'), kind: 'heatmap', title: 'Heatmap' }, note('b', 'Still here')),
      );
      expect(within(cell(container, 'a')).getByText('This widget needs a newer version.')).toBeDefined();
      expect(within(cell(container, 'a')).getByText('Heatmap')).toBeDefined();
      expect(screen.getByTestId('note-b').textContent).toBe('Still here');
    });

    it('shows options its kind rejects, with the path, and the rest still render', () => {
      const { container } = renderDashboard(
        definition(
          { ...note('a', 'x'), views: [{ queries: [unused], options: { text: 4 } }] },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText(/^views\.0\.options\.text:/)).toBeDefined();
      expect(screen.getByTestId('note-b')).toBeDefined();
    });

    it("shows a widget core's schema rejects, and the rest still render", () => {
      const { container } = renderDashboard(
        definition(
          {
            ...note('a', 'x'),
            // Ids start with a letter; storage takes the widget, core's widget schema doesn't.
            views: [{ queries: [{ id: '1st', source: 'spanAggregate', measures: ['count'] }], options: { text: 'x' } }],
          },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText(/views\.0\.queries\.0/)).toBeDefined();
      expect(screen.getByTestId('note-b')).toBeDefined();
    });

    it('keeps a render error to its own widget', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = renderDashboard(
        definition(
          { id: 'a', span: 6, kind: 'broken', title: 'Broken', views: [{ queries: [unused] }] },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText('Render failed.')).toBeDefined();
      expect(screen.getByTestId('note-b')).toBeDefined();
    });

    it('keeps a failing request to its own widget', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );
      const { container } = renderDashboard(definition(kpisWidget, agentRunsWidget));
      await waitFor(() => expect(within(cell(container, 'kpis')).getAllByText("Couldn't load")).toHaveLength(4));
      const runs = cell(container, 'agent-runs');
      expect(await within(runs).findByText('Completed')).toBeDefined();
      expect(within(runs).queryByText("Couldn't load")).toBeNull();
    });

    it('loads a trace chart after Retry once its requests succeed', async () => {
      serveCapabilities(traceAggregateCapabilities);
      let failing = true;
      serveTraceAggregate(request => {
        if (failing) return HttpResponse.json({ error: 'boom' }, { status: 500 });
        return request.interval ? distinctIdsSeriesFixture(request.timeRange) : distinctIdsTotalsFixture;
      });
      const { container, queryClient } = renderDashboard(definition(distinctIdsWidget));
      const widget = cell(container, 'distinct-ids');
      // The client retries an aggregate itself before the widget sees the error.
      expect(await within(widget).findByText(LOAD_ERROR, undefined, { timeout: 5000 })).toBeDefined();
      await waitForMutationsIdle(queryClient);
      failing = false;
      fireEvent.click(within(widget).getByRole('button', { name: 'Retry' }));
      expect(await within(widget).findAllByText('Resources', undefined, { timeout: 5000 })).not.toHaveLength(0);
      expect(within(widget).queryByText(LOAD_ERROR)).toBeNull();
    }, 15_000);

    it('loads a table after Retry once its requests succeed', async () => {
      let failing = true;
      server.use(
        http.post<never, { aggregation?: string }>(
          `${TEST_BASE_URL}/api/observability/metrics/breakdown`,
          async ({ request }) => {
            if (failing) return HttpResponse.json({ error: 'boom' }, { status: 500 });
            const body = await request.json();
            return HttpResponse.json(body.aggregation === 'count' ? modelSpansByModel : usageByModel);
          },
        ),
      );
      const { container, queryClient } = renderDashboard(definition(modelsWidget));
      const widget = cell(container, 'models');
      expect(await within(widget).findByText(LOAD_ERROR, undefined, { timeout: 5000 })).toBeDefined();
      // The table's other request may still be retrying; Retry once both have failed.
      await waitForMutationsIdle(queryClient);
      failing = false;
      fireEvent.click(within(widget).getByRole('button', { name: 'Retry' }));
      // The header row, then one per model.
      await waitFor(() => expect(within(widget).getAllByRole('row')).toHaveLength(3));
    });

    it('renders a widget that threw again once the page filters change', () => {
      const page = (environment?: string) => (
        <MetricsProvider
          preset="24h"
          filterTokens={environment ? [{ fieldId: 'environment', value: environment }] : []}
          onPresetChange={() => {}}
          onFilterTokensChange={() => {}}
        >
          <DashboardRenderer
            definition={definition({
              ...note('a', ''),
              kind: 'unfilteredFails',
              views: [{ queries: [unused], options: {} }],
            })}
            kinds={[unfilteredFailsKind]}
            scope="project"
          />
        </MetricsProvider>
      );
      const { container, rerender } = renderWithProviders(page());
      expect(within(cell(container, 'a')).getByText('Needs a filter.')).toBeDefined();
      rerender(page('production'));
      expect(screen.getByTestId('filtered-a')).toBeDefined();
    });

    it('shows a widget whose views share a label as its own error', () => {
      const { container } = renderDashboard(
        definition(
          {
            ...note('a', ''),
            views: [
              { label: 'Same', queries: [unused], options: { text: 'one' } },
              { label: 'Same', queries: [unused], options: { text: 'two' } },
            ],
          },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText("views.1: another view is already labelled 'Same'")).toBeDefined();
      expect(screen.getByTestId('note-b').textContent).toBe('Still here');
    });

    it("says a trace widget can't apply a page filter it has no equivalent for, and sends nothing", async () => {
      serveCapabilities(traceAggregateCapabilities);
      const traces: TraceAggregateRequest[] = [];
      serveTraceAggregate(request => {
        traces.push(request);
        return { rows: [], truncated: false };
      });
      const { container } = renderDashboard(definition(distinctIdsWidget), {
        filterTokens: [{ fieldId: 'serviceName', value: 'checkout' }],
      });
      expect(
        await within(cell(container, 'distinct-ids')).findByText('Not available with a service filter.'),
      ).toBeDefined();
      expect(traces).toHaveLength(0);
    });

    it('says why a dashboard that storage would reject cannot be shown', () => {
      // Two widgets with one id: storage rejects the whole definition.
      renderDashboard(definition(note('a', 'Hello'), note('a', 'World')));
      expect(screen.getByText(/^This dashboard can't be shown\./)).toBeDefined();
    });
  });

  describe('when a kind uses the shared tabs and action button', () => {
    const controls = (extra: Partial<DashboardWidget>): DashboardWidget => ({
      id: 'c',
      span: 6,
      kind: 'controls',
      views: [{ queries: [unused] }],
      ...extra,
    });

    it('names a view whose label is blank by its position', async () => {
      renderDashboard(
        definition(
          controls({
            views: [
              { label: 'Agents', queries: [unused] },
              { label: '  ', queries: [unused] },
            ],
          }),
        ),
        { kinds: [controlsKind] },
      );
      expect(await openViewMenu('Agents')).toEqual(['Agents', 'View 2']);
    });

    it('titles a single view with the widget title, and several with the open view, switched from the menu', async () => {
      renderDashboard(
        definition(
          controls({ id: 'one', title: 'Runs' }),
          controls({
            id: 'two',
            title: 'Latency',
            views: [
              { label: 'Agents', queries: [unused] },
              { label: 'Tools', queries: [unused] },
            ],
          }),
        ),
        { kinds: [controlsKind] },
      );
      expect(screen.getByText('Runs', { selector: 'h2, h3, span, div' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Runs' })).toBeNull();
      await pickView('Agents', 'Tools');
      expect(screen.getByRole('button', { name: 'Tools' })).toBeDefined();
      expect(screen.getByText('Tools', { selector: 'p' })).toBeDefined();
    });

    it('offers errors in Logs only when the target keeps to errors', () => {
      const onDrilldown = vi.fn();
      const support = { fieldId: 'entityName', value: 'support' };
      const target = (id: string, filters: { fieldId: string; value: string }[]) =>
        controls({ id, drilldown: { action: { page: 'logs', filters } } });
      const errors = target('error', [support, { fieldId: 'status', value: 'error' }]);
      const { container } = renderDashboard(definition(errors, target('any', [support])), {
        kinds: [controlsKind],
        onDrilldown,
      });
      expect(within(cell(container, 'error')).getByRole('button', { name: 'View errors in logs' })).toBeDefined();
      fireEvent.click(within(cell(container, 'any')).getByRole('button', { name: 'View in logs' }));
      expect(onDrilldown).toHaveBeenCalledWith('logs', { entityName: 'support' });
    });

    it('names the page each action opens', () => {
      const onDrilldown = vi.fn();
      const target = (page: 'traces' | 'spans' | 'threads') =>
        controls({ id: page, drilldown: { action: { page, filters: [] } } });
      const { container } = renderDashboard(definition(target('traces'), target('spans'), target('threads')), {
        kinds: [controlsKind],
        onDrilldown,
      });
      expect(within(cell(container, 'traces')).getByRole('button', { name: 'View in traces' })).toBeDefined();
      expect(within(cell(container, 'spans')).getByRole('button', { name: 'View in spans' })).toBeDefined();
      fireEvent.click(within(cell(container, 'threads')).getByRole('button', { name: 'View in threads' }));
      expect(onDrilldown).toHaveBeenCalledWith('threads', {});
    });
  });

  describe('when the host gives chart cards somewhere to expand to', () => {
    const RouterLink = ({ href, ...props }: { href: string }) => <a href={`/app${href}`} data-router-link {...props} />;
    const expand: DashboardExpand = {
      href: widget => (widget.id === 'agent-runs' ? undefined : `/query?metric=${widget.id}`),
      LinkComponent: RouterLink,
    };

    it("links the card's title to the host's page in place of its views menu", async () => {
      const { container } = renderDashboard(definition(metricsWidget('token-usage')), { expand });
      const card = cell(container, 'token-usage');
      const link = await within(card).findByRole('link', { name: 'Token usage' });
      expect(link.getAttribute('href')).toBe('/app/query?metric=token-usage');
      expect(within(card).queryByRole('button', { name: 'Token usage' })).toBeNull();
    });

    it('names the link after the first view when the widget title is blank', async () => {
      const { container } = renderDashboard(definition({ ...metricsWidget('token-usage'), title: '  ' }), {
        expand,
      });
      expect(await within(cell(container, 'token-usage')).findByRole('link', { name: 'Token usage' })).toBeDefined();
    });

    it('links a scores card the same way', async () => {
      const { container } = renderDashboard(definition(scoresWidget), { expand });
      const link = await within(cell(container, 'scores')).findByRole('link', { name: 'Scores' }, { timeout: 5000 });
      expect(link.getAttribute('href')).toBe('/app/query?metric=scores');
    });

    it('keeps the views menu on a card the host has nowhere to send', async () => {
      const { container } = renderDashboard(definition(agentRunsWidget), { expand });
      const card = cell(container, 'agent-runs');
      expect(await within(card).findByRole('button', { name: 'Agent runs' })).toBeDefined();
      expect(within(card).queryByRole('link')).toBeNull();
    });
  });

  describe('when the host passes drag handles, as a layout editor does', () => {
    const onDragStart = vi.fn();
    const dragHandle = (widgetId: string) => ({ 'aria-label': `Move ${widgetId}`, draggable: true, onDragStart });
    const firstControl = (card: HTMLElement) => card.querySelector('button, a');

    beforeEach(() => {
      onDragStart.mockClear();
    });

    it.each([
      ['a timeseries card', metricsWidget('agent-runs')],
      ['a table card', models()],
      ['a scores card', scoresWidget],
    ])("puts the handle in view before the title of %s, and dragging it starts the host's drag", async (_, widget) => {
      const { container } = renderDashboard(definition(widget), { dragHandle });
      const card = cell(container, widget.id);
      const handle = await within(card).findByRole('button', { name: `Move ${widget.id}` }, { timeout: 5000 });
      expect(handle.getAttribute('draggable')).toBe('true');
      expect(handle.closest('.opacity-0')).toBeNull();
      await waitFor(() => expect(firstControl(card)).toBe(handle));
      fireEvent.dragStart(handle);
      expect(onDragStart).toHaveBeenCalledTimes(1);
    });

    it("keeps a KPI group's handle, which floats over its border, for hover except on touch screens, and dragging it starts the host's drag", async () => {
      const { container } = renderDashboard(definition(kpisWidget), { dragHandle });
      const card = cell(container, kpisWidget.id);
      const handle = await within(card).findByRole('button', { name: `Move ${kpisWidget.id}` }, { timeout: 5000 });
      expect(handle.getAttribute('draggable')).toBe('true');
      expect(handle.closest('.opacity-0.group-hover\\/metrics-card\\:opacity-100')).not.toBeNull();
      // Touch screens can't hover, so the handle stays shown and tappable there.
      expect(handle.closest('.pointer-coarse\\:opacity-100.pointer-coarse\\:pointer-events-auto')).not.toBeNull();
      fireEvent.dragStart(handle);
      expect(onDragStart).toHaveBeenCalledTimes(1);
    });

    it('puts the handle before a linked title', async () => {
      const expand: DashboardExpand = { href: () => '/query', LinkComponent: props => <a {...props} /> };
      const { container } = renderDashboard(definition(metricsWidget('token-usage')), { expand, dragHandle });
      const card = cell(container, 'token-usage');
      await within(card).findByRole('link', { name: 'Token usage' });
      expect(firstControl(card)).toBe(within(card).getByRole('button', { name: 'Move token-usage' }));
    });

    it("gives a widget that can't render a handle too, so it can still be moved", () => {
      const { container } = renderDashboard(definition({ ...note('gone', 'x'), kind: 'heatmap' }), { dragHandle });
      const card = cell(container, 'gone');
      expect(within(card).getByText('This widget needs a newer version.')).toBeDefined();
      expect(firstControl(card)).toBe(within(card).getByRole('button', { name: 'Move gone' }));
    });

    it.each([
      ['a timeseries card', metricsWidget('agent-runs')],
      ['a table card', models()],
      ['a scores card', scoresWidget],
      ['a KPI group', kpisWidget],
    ])('shows no Create alert button on %s while its layout is edited', async (_, widget) => {
      const action = vi.fn(() => ({ href: '/alerts/new' }));
      const { container } = renderDashboard(definition(widget), {
        dragHandle,
        alert: { action, LinkComponent: props => <a {...props} /> },
      });
      const card = cell(container, widget.id);
      await within(card).findByRole('button', { name: `Move ${widget.id}` }, { timeout: 5000 });
      expect(within(card).queryByRole('link', { name: /^Create alert\b/ })).toBeNull();
      expect(within(card).queryByRole('button', { name: /^Create alert\b/ })).toBeNull();
      expect(action).not.toHaveBeenCalled();
    });

    it('shows no handle without them', async () => {
      const { container } = renderDashboard(definition(metricsWidget('agent-runs'), kpisWidget));
      expect(await within(cell(container, 'agent-runs')).findByRole('button', { name: 'Agent runs' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    });
  });

  describe('when the host can pin widgets', () => {
    /** A host that owns which widgets are pinned and passes that back down, as the MCP app's host does. */
    function PinningHost({ widgets, onPin }: { widgets: DashboardWidget[]; onPin: PinningProps['onPin'] }) {
      const [pinned, setPinned] = useState<string[]>([]);
      return (
        <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
          <DashboardRenderer
            definition={definition(...widgets)}
            kinds={[noteKind, brokenKind]}
            scope="project"
            widgetActions={pinning({
              isPinned: id => pinned.includes(id),
              onPin: (widget, next) => {
                onPin(widget, next);
                setPinned(ids => (next ? [...ids, widget.id] : ids.filter(id => id !== widget.id)));
              },
            })}
          />
        </MetricsProvider>
      );
    }

    /** The pin button's name: the widget's title, or "widget" for an untitled one like the KPI group. */
    const pinLabel = (verb: 'Pin' | 'Unpin', widget: DashboardWidget) => `${verb} ${widget.title?.trim() || 'widget'}`;
    /** Whether the button only shows while the card is hovered or focused. */
    const waitsForHover = (button: HTMLElement) => button.closest('.opacity-0') !== null;
    /**
     * Whether the button, and every hidden element around it, shows and takes taps on touch screens, which
     * can't hover.
     */
    const reachableOnTouch = (button: HTMLElement) => {
      for (let el: HTMLElement | null = button; el; el = el.parentElement) {
        if (el.classList.contains('opacity-0') && !el.classList.contains('pointer-coarse:opacity-100')) return false;
        if (
          el.classList.contains('pointer-events-none') &&
          !el.classList.contains('pointer-coarse:pointer-events-auto')
        )
          return false;
      }
      return true;
    };

    it.each([
      ['a timeseries card', metricsWidget('agent-runs')],
      ['a table card', models()],
      ['a scores card', scoresWidget],
      ['a KPI group', kpisWidget],
    ])('pins and unpins %s, sending the host the widget itself', async (_, widget) => {
      const onPin = vi.fn();
      const { container } = renderWithProviders(<PinningHost widgets={[widget]} onPin={onPin} />);
      const card = cell(container, widget.id);

      fireEvent.click(await within(card).findByRole('button', { name: pinLabel('Pin', widget) }, { timeout: 5000 }));
      expect(onPin).toHaveBeenLastCalledWith(expect.objectContaining({ id: widget.id, kind: widget.kind }), true);

      fireEvent.click(within(card).getByRole('button', { name: pinLabel('Unpin', widget) }));
      expect(onPin).toHaveBeenLastCalledWith(expect.objectContaining({ id: widget.id }), false);
      expect(within(card).getByRole('button', { name: pinLabel('Pin', widget) })).toBeDefined();
    });

    it('names each pin button after its widget', async () => {
      const { container } = renderWithProviders(
        <PinningHost widgets={[metricsWidget('agent-runs'), metricsWidget('token-usage')]} onPin={() => {}} />,
      );
      expect(
        await within(cell(container, 'agent-runs')).findByRole('button', { name: 'Pin Agent runs' }),
      ).toBeDefined();
      expect(within(cell(container, 'token-usage')).getByRole('button', { name: 'Pin Token usage' })).toBeDefined();
    });

    it('pins only the widget clicked', async () => {
      const { container } = renderWithProviders(
        <PinningHost widgets={[metricsWidget('agent-runs'), metricsWidget('token-usage')]} onPin={() => {}} />,
      );
      fireEvent.click(await within(cell(container, 'agent-runs')).findByRole('button', { name: 'Pin Agent runs' }));
      expect(within(cell(container, 'agent-runs')).getByRole('button', { name: 'Unpin Agent runs' })).toBeDefined();
      expect(within(cell(container, 'token-usage')).getByRole('button', { name: 'Pin Token usage' })).toBeDefined();
    });

    it.each([
      ['a timeseries card', metricsWidget('agent-runs')],
      ['a table card', models()],
      ['a scores card', scoresWidget],
    ])('keeps the unpin button of a pinned %s in view, and the pin of an unpinned one for hover', async (_, widget) => {
      const { container } = renderWithProviders(<PinningHost widgets={[widget]} onPin={() => {}} />);
      const card = cell(container, widget.id);
      const pin = await within(card).findByRole('button', { name: pinLabel('Pin', widget) }, { timeout: 5000 });
      expect(waitsForHover(pin)).toBe(true);
      // Touch screens can't hover, so there the pin shows and takes taps.
      expect(reachableOnTouch(pin)).toBe(true);

      fireEvent.click(pin);
      expect(waitsForHover(within(card).getByRole('button', { name: pinLabel('Unpin', widget) }))).toBe(false);
    });

    it('keeps the controls of a KPI group, which float over its border, for hover, and reachable on touch', async () => {
      const { container } = renderWithProviders(<PinningHost widgets={[kpisWidget]} onPin={() => {}} />);
      const card = cell(container, kpisWidget.id);
      const pin = await within(card).findByRole('button', { name: pinLabel('Pin', kpisWidget) }, { timeout: 5000 });
      expect(waitsForHover(pin)).toBe(true);
      expect(pin.closest('.pointer-events-none')).not.toBeNull();
      expect(reachableOnTouch(pin)).toBe(true);

      fireEvent.click(pin);
      const unpin = within(card).getByRole('button', { name: pinLabel('Unpin', kpisWidget) });
      expect(waitsForHover(unpin)).toBe(true);
      expect(reachableOnTouch(unpin)).toBe(true);
    });

    it.each([
      ['a table card', models()],
      ['a KPI group', kpisWidget],
    ])('keeps the hover-only pin of %s in the tab order', async (_, widget) => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<PinningHost widgets={[widget]} onPin={() => {}} />);
      const pin = await within(cell(container, widget.id)).findByRole(
        'button',
        { name: pinLabel('Pin', widget) },
        { timeout: 5000 },
      );
      expect(waitsForHover(pin)).toBe(true);
      expect(pin.classList.contains('hidden')).toBe(false);

      // Tab through the card's controls (the KPI figures' change badges come first) until the pin.
      for (let i = 0; i < 20 && document.activeElement !== pin; i++) await user.tab();
      expect(document.activeElement).toBe(pin);
      // Focus inside the card is what reveals it.
      expect(pin.className).toContain('group-focus-within/metrics-card:opacity-100');
    });

    it("shows the host's pinned widgets without a click", async () => {
      const { container } = renderDashboard(definition(metricsWidget('agent-runs'), metricsWidget('token-usage')), {
        pin: { onPin: () => {}, isPinned: id => id === 'token-usage' },
      });
      expect(
        await within(cell(container, 'token-usage')).findByRole('button', { name: 'Unpin Token usage' }),
      ).toBeDefined();
      expect(within(cell(container, 'agent-runs')).getByRole('button', { name: 'Pin Agent runs' })).toBeDefined();
    });

    it('keeps the pin on a widget that breaks while rendering, so it can still be unpinned', () => {
      const onPin = vi.fn();
      const { container } = renderDashboard(definition({ ...note('boom', 'x', { title: 'Boom' }), kind: 'broken' }), {
        pin: { onPin, isPinned: () => true },
      });
      const card = cell(container, 'boom');
      expect(within(card).getByText('Render failed.')).toBeDefined();
      fireEvent.click(within(card).getByRole('button', { name: 'Unpin Boom' }));
      expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ id: 'boom' }), false);
    });

    it("offers no pin on a widget that can't be read", () => {
      const { container } = renderDashboard(definition({ ...note('gone', 'x'), kind: 'heatmap' }), {
        pin: { onPin: () => {}, isPinned: () => true },
      });
      expect(within(cell(container, 'gone')).getByText('This widget needs a newer version.')).toBeDefined();
      expect(screen.queryByRole('button', { name: /pin/i })).toBeNull();
    });

    it('shows no pin buttons for a host that does not pin', async () => {
      const { container } = renderDashboard(definition(metricsWidget('agent-runs'), kpisWidget));
      expect(await within(cell(container, 'agent-runs')).findByRole('button', { name: 'Agent runs' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /pin/i })).toBeNull();
    });
  });

  describe('when the host can turn cards into alerts', () => {
    const RouterLink = ({ href, ...props }: { href: string }) => <a href={`/app${href}`} {...props} />;
    const hosting = (action: DashboardAlert['action'] = () => ({ href: '/alerts/new' })) => {
      const spy = vi.fn(action);
      return { spy, alert: { action: spy, LinkComponent: RouterLink } satisfies DashboardAlert };
    };
    const lastTarget = (spy: { mock: { lastCall: [DashboardAlertTarget] | undefined } }) => {
      if (!spy.mock.lastCall) throw new Error('The host was never asked');
      return spy.mock.lastCall[0];
    };
    const alertLabel = /^Create alert\b/;

    it.each([
      ['a timeseries card', metricsWidget('agent-runs'), 'Create alert from Agent runs'],
      ['a table card', models(), `Create alert from ${models().views[0].label}`],
      ['a scores card', scoresWidget, `Create alert from ${scoresWidget.views[0].label ?? scoresWidget.title}`],
      ['a KPI group', kpisWidget, 'Create alert'],
    ])("links %s to the host's alert editor for its open view", async (_, widget, name) => {
      const { alert, spy } = hosting();
      const { container } = renderDashboard(definition(widget), { alert });
      const link = await within(cell(container, widget.id)).findByRole('link', { name }, { timeout: 5000 });
      expect(link.getAttribute('href')).toBe('/app/alerts/new');
      expect(lastTarget(spy).widget.id).toBe(widget.id);
      expect(lastTarget(spy).view).toMatchObject({ queries: widget.views[0].queries });
    });

    it('follows the view picked from the menu', async () => {
      const { alert, spy } = hosting();
      const widget = metricsWidget('agent-runs');
      const { container } = renderDashboard(definition(widget), { alert });
      await pickView('Agent runs', 'Failure rate');
      expect(
        await within(cell(container, 'agent-runs')).findByRole('link', { name: 'Create alert from Failure rate' }),
      ).toBeDefined();
      expect(lastTarget(spy).view).toMatchObject({ label: widget.views[1].label, queries: widget.views[1].queries });
    });

    it("hands the host the view's queries with the page's filters applied", async () => {
      const { alert, spy } = hosting();
      const { container } = renderDashboard(definition(metricsWidget('agent-runs')), { alert, environment: 'prod' });
      await within(cell(container, 'agent-runs')).findByRole('link', { name: alertLabel });
      const { queries } = lastTarget(spy);
      expect(queries).toHaveLength(1);
      for (const query of queries) {
        expect(query.source).toBe('metrics');
        if (query.source === 'metrics') expect(query.filters).toMatchObject({ environment: 'prod' });
        if (query.source === 'metrics') expect(query.filters).not.toHaveProperty('timestamp');
      }
    });

    it('disables the button with the reason the host gives', async () => {
      const { alert } = hosting(() => ({ disabled: 'Percentiles are not supported yet.' }));
      const { container } = renderDashboard(definition(metricsWidget('agent-runs')), { alert });
      const button = await within(cell(container, 'agent-runs')).findByRole('button', { name: alertLabel });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(within(cell(container, 'agent-runs')).queryByRole('link', { name: alertLabel })).toBeNull();
      fireEvent.focus(button);
      expect(await screen.findByText('Percentiles are not supported yet.')).toBeDefined();
    });

    it("shows no button on a card the host can't alert on", async () => {
      const { alert } = hosting(() => undefined);
      const { container } = renderDashboard(definition(metricsWidget('agent-runs')), { alert });
      expect(await within(cell(container, 'agent-runs')).findByRole('button', { name: 'Agent runs' })).toBeDefined();
      expect(screen.queryByRole('button', { name: alertLabel })).toBeNull();
      expect(screen.queryByRole('link', { name: alertLabel })).toBeNull();
    });

    it("disables the button on a card the page's filters block, saying which filter", async () => {
      serveCapabilities(traceAggregateCapabilities);
      const { alert, spy } = hosting();
      const { container } = renderDashboard(definition(distinctIdsWidget), {
        alert,
        filterTokens: [{ fieldId: 'serviceName', value: 'checkout' }],
      });
      const button = await within(cell(container, 'distinct-ids')).findByRole('button', { name: alertLabel });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.focus(button);
      expect(await screen.findAllByText('Not available with a service filter.')).not.toHaveLength(0);
      expect(spy).not.toHaveBeenCalled();
    });

    it('puts the button after the drilldown and before the pin', async () => {
      const { alert } = hosting();
      const widget = {
        ...metricsWidget('agent-runs'),
        drilldown: { action: { page: 'traces' as const, filters: [] } },
      };
      const { container } = renderDashboard(definition(widget), {
        alert,
        onDrilldown: () => {},
        pin: { onPin: () => {}, isPinned: () => false },
      });
      const card = cell(container, 'agent-runs');
      const link = await within(card).findByRole('link', { name: alertLabel });
      const controls = [...card.querySelectorAll('button, a')];
      const at = (el: Element) => controls.indexOf(el);
      expect(at(within(card).getByRole('button', { name: 'View in traces' }))).toBeLessThan(at(link));
      expect(at(link)).toBeLessThan(at(within(card).getByRole('button', { name: 'Pin Agent runs' })));
    });

    it('describes the disabled button with its reason, for screen readers', async () => {
      const { alert } = hosting(() => ({ disabled: 'Percentiles are not supported yet.' }));
      const { container } = renderDashboard(definition(metricsWidget('agent-runs')), { alert });
      const button = await within(cell(container, 'agent-runs')).findByRole('button', { name: alertLabel });
      const id = button.getAttribute('aria-describedby');
      expect(id).toBeTruthy();
      expect(document.getElementById(id ?? '')?.textContent).toBe('Percentiles are not supported yet.');
    });

    it("disables the button on a table tab the page's filters block, in the table's words", async () => {
      serveCapabilities(aggregateCapabilities);
      const breakdown = metricsWidget('breakdown');
      const agents = breakdown.views.find(v => v.label === 'Breakdown by agent' && v.scope !== 'org');
      if (!agents) throw new Error('Breakdown has no project Agents tab');
      const widget = { ...breakdown, id: 'agents', views: [agents] };
      const { alert, spy } = hosting();
      const { container } = renderDashboard(definition(widget), {
        alert,
        filterTokens: [{ fieldId: 'provider', value: 'openai' }],
      });
      const button = await within(cell(container, 'agents')).findByRole(
        'button',
        { name: alertLabel },
        { timeout: 5000 },
      );
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
        'Not available with a provider filter.',
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it("disables the button on a card whose own filters contradict the page's", async () => {
      const runs = metricsWidget('agent-runs');
      const widget: DashboardWidget = {
        ...runs,
        views: runs.views.map(view => ({
          ...view,
          queries: view.queries.map(q =>
            q.source === 'metrics' ? { ...q, filters: { ...q.filters, environment: 'staging' } } : q,
          ),
        })),
      };
      const { alert, spy } = hosting();
      const { container } = renderDashboard(definition(widget), { alert, environment: 'prod' });
      const button = await within(cell(container, 'agent-runs')).findByRole('button', { name: alertLabel });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
        "The page's filters exclude everything this card shows.",
      );
      expect(spy).not.toHaveBeenCalled();
    });

    describe.each([
      ['a table card', models()],
      ['a scores card', scoresWidget],
      ['a KPI group', kpisWidget],
    ])('on %s', (_, widget) => {
      const pinName = (verb: string) => `${verb} ${widget.title?.trim() || 'widget'}`;
      it.each([
        ['unpinned', false, 'Pin'],
        ['pinned', true, 'Unpin'],
      ])('puts the button before the pin when %s', async (_state, pinned, verb) => {
        const { alert } = hosting();
        const { container } = renderDashboard(definition(widget), {
          alert,
          pin: { onPin: () => {}, isPinned: () => pinned },
        });
        const card = cell(container, widget.id);
        const link = await within(card).findByRole('link', { name: alertLabel }, { timeout: 5000 });
        const controls = [...card.querySelectorAll('button, a')];
        expect(controls.indexOf(link)).toBeLessThan(
          controls.indexOf(within(card).getByRole('button', { name: pinName(verb) })),
        );
      });
    });

    it.each([
      [
        'a kind this version does not know',
        { ...note('a', 'x'), kind: 'heatmap', title: 'Heatmap' },
        'This widget needs a newer version.',
      ],
      [
        'a kind that fails to render',
        { id: 'a', span: 6, kind: 'broken', title: 'Broken', views: [{ queries: [unused] }] },
        'Render failed.',
      ],
    ] satisfies [string, DashboardWidget, string][])(
      'shows no button on the error card of %s: there is no checked query to alert on',
      (_, widget, message) => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { alert, spy } = hosting();
        const { container } = renderDashboard(definition(widget), { alert });
        const card = cell(container, 'a');
        expect(within(card).getByText(message)).toBeDefined();
        expect(within(card).queryByRole('link', { name: alertLabel })).toBeNull();
        expect(within(card).queryByRole('button', { name: alertLabel })).toBeNull();
        expect(spy).not.toHaveBeenCalled();
      },
    );

    it('shows no alert buttons for a host that passes none', async () => {
      const { container } = renderDashboard(definition(metricsWidget('agent-runs'), kpisWidget));
      expect(await within(cell(container, 'agent-runs')).findByRole('button', { name: 'Agent runs' })).toBeDefined();
      expect(screen.queryByRole('link', { name: alertLabel })).toBeNull();
      expect(screen.queryByRole('button', { name: alertLabel })).toBeNull();
    });

    describe('per source', () => {
      const perSource = (pick: (s: DashboardAlertSource, i: number) => DashboardAlertAction | undefined) =>
        hosting(({ sources }) => sources.map(pick));
      const linkEach = () => perSource(s => ({ href: `/alerts/new?from=${encodeURIComponent(s.label)}` }));
      const labels = (target: DashboardAlertTarget) => target.sources.map(s => s.label);
      const openMenu = async (card: HTMLElement, name: string | RegExp = alertLabel) => {
        const trigger = await within(card).findByRole('button', { name }, { timeout: 5000 });
        fireEvent.click(trigger);
        return screen.findByRole('menu');
      };

      it('hands the host each KPI, and each part of a combined one, with its query and ref', async () => {
        const { alert, spy } = linkEach();
        const { container } = renderDashboard(definition(kpisWidget), { alert, environment: 'prod' });
        await openMenu(cell(container, 'kpis'));
        const { sources } = lastTarget(spy);
        expect(labels(lastTarget(spy))).toEqual([
          'Agent runs',
          'Model cost',
          'Tokens: input',
          'Tokens: output',
          'Threads',
        ]);
        expect(sources[1]?.ref).toEqual({ field: 'estimatedCost' });
        expect(sources[1]?.query).toMatchObject({ id: 'cost', filters: { environment: 'prod' } });
        expect(sources[2]?.ref).toEqual({});
        expect(sources[2]?.query).toMatchObject({ id: 'input' });
      });

      it('lists the parts of a combined series once each, naming what they pick', async () => {
        const { alert, spy } = linkEach();
        const { container } = renderDashboard(definition(agentRunsWidget), { alert });
        await openMenu(cell(container, 'agent-runs'));
        expect(labels(lastTarget(spy))).toEqual(['Completed', 'Failed']);
        await pickView('Agent runs', 'Failure rate');
        await waitFor(() =>
          expect(labels(lastTarget(spy))).toEqual([
            'Failed runs: runs (error, failed)',
            'Failed runs: runs (not error, failed)',
          ]),
        );
        expect(lastTarget(spy).sources.map(s => s.ref)).toEqual([
          { groups: ['error', 'failed'] },
          { notGroups: ['error', 'failed'] },
        ]);
      });

      it('names a part shared with a series of its own by that series', async () => {
        const { alert, spy } = linkEach();
        const { container } = renderDashboard(definition(metricsWidget('token-usage')), { alert });
        await openMenu(cell(container, 'token-usage'));
        expect(labels(lastTarget(spy))).toEqual(['Input: input', 'Cache read', 'Output']);
      });

      it('hands the host a series by its value over the range, where it has one', async () => {
        serveCapabilities(traceAggregateCapabilities);
        // Answered, so no failed request is retried into a later test.
        serveTraceAggregate(() => ({ rows: [], truncated: false }));
        const { alert, spy } = linkEach();
        const { container } = renderDashboard(definition(distinctIdsWidget), { alert });
        await openMenu(cell(container, 'distinct-ids'));
        const { sources } = lastTarget(spy);
        expect(sources.length).toBeGreaterThan(1);
        for (const source of sources) {
          expect(source.query.id).toBe('totals');
          expect(source.ref.measure).toEqual(expect.any(String));
        }
      });

      it("lists a table's value columns, one entry per column", async () => {
        const { alert, spy } = linkEach();
        const widget = models();
        const { container } = renderDashboard(definition(widget), { alert });
        await openMenu(cell(container, widget.id));
        const columns = (widget.views[0]?.columns ?? []).filter(c => c.options?.type === 'value').map(c => c.label);
        expect(labels(lastTarget(spy))).toEqual(columns);
      });

      it('lists one series per ref, the first label winning a repeat', async () => {
        const { alert, spy } = linkEach();
        const runs = agentRunsWidget.views[0];
        if (!runs) throw new Error('Agent runs has no view');
        const widget: DashboardWidget = {
          ...agentRunsWidget,
          views: [
            {
              ...runs,
              options: {
                ...runs.options,
                series: [
                  {
                    dataKey: 'a',
                    label: 'Failed',
                    color: 'error',
                    value: { query: 'runs', groups: ['error', 'failed'] },
                  },
                  { dataKey: 'b', label: 'Again', color: 'sky', value: { query: 'runs', groups: ['error', 'failed'] } },
                ],
              },
            },
          ],
        };
        const { container } = renderDashboard(definition(widget), { alert });
        await within(cell(container, 'agent-runs')).findByRole('link', { name: 'Create alert from Agent runs' });
        expect(labels(lastTarget(spy))).toEqual(['Failed']);
      });

      it('opens a menu linking each source the host can alert on', async () => {
        const { alert } = linkEach();
        const { container } = renderDashboard(definition(kpisWidget), { alert });
        const menu = await openMenu(cell(container, 'kpis'), 'Create alert');
        const links = within(menu).getAllByRole('menuitem');
        expect(links.map(l => l.textContent)).toEqual([
          'Agent runs',
          'Model cost',
          'Tokens: input',
          'Tokens: output',
          'Threads',
        ]);
        expect(links[1]?.getAttribute('href')).toBe(`/app/alerts/new?from=${encodeURIComponent('Model cost')}`);
      });

      it('shows a source the host disables in the menu, with its reason', async () => {
        const PART = 'This is part of a sum. An alert watches the whole value.';
        const { alert } = perSource(s =>
          s.label.startsWith('Tokens:') ? { disabled: PART } : { href: '/alerts/new' },
        );
        const { container } = renderDashboard(definition(kpisWidget), { alert });
        const menu = await openMenu(cell(container, 'kpis'));
        const input = within(menu).getByRole('menuitem', { name: /Tokens: input/ });
        expect(input.getAttribute('aria-disabled')).toBe('true');
        expect(input.getAttribute('href')).toBeNull();
        expect(input.textContent).toContain(PART);
        expect(
          within(menu)
            .getAllByRole('menuitem')
            .filter(i => i.getAttribute('href')),
        ).toHaveLength(3);
      });

      it('leaves out a source the host passes over', async () => {
        const { alert } = perSource((s, i) => (i === 0 ? undefined : { href: '/alerts/new' }));
        const { container } = renderDashboard(definition(kpisWidget), { alert });
        const menu = await openMenu(cell(container, 'kpis'));
        expect(within(menu).queryByRole('menuitem', { name: 'Agent runs' })).toBeNull();
        expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
      });

      it('links straight to the only source the host can alert on, naming it', async () => {
        const { alert } = perSource((_, i) => (i === 4 ? { href: '/alerts/threads' } : { disabled: 'No.' }));
        const { container } = renderDashboard(definition(kpisWidget), { alert });
        const link = await within(cell(container, 'kpis')).findByRole('link', { name: 'Create alert from Threads' });
        expect(link.getAttribute('href')).toBe('/app/alerts/threads');
        expect(screen.queryByRole('menu')).toBeNull();
      });

      it("links a single source's card as a plain button, named for the card", async () => {
        const { alert, spy } = perSource(() => ({ href: '/alerts/new' }));
        const { container } = renderDashboard(definition(scoresWidget), { alert });
        const link = await within(cell(container, 'scores')).findByRole(
          'link',
          { name: `Create alert from ${scoresWidget.title}` },
          { timeout: 5000 },
        );
        expect(link.getAttribute('href')).toBe('/app/alerts/new');
        expect(lastTarget(spy).sources).toEqual([
          { label: 'Scores', query: expect.objectContaining({ id: 'average' }), ref: {} },
        ]);
      });

      it('disables the button when the host can alert on no source, with the shared reason', async () => {
        const { alert } = perSource(() => ({ disabled: 'Percentiles are not supported yet.' }));
        const { container } = renderDashboard(definition(kpisWidget), { alert });
        const button = await within(cell(container, 'kpis')).findByRole('button', { name: alertLabel });
        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
          'Percentiles are not supported yet.',
        );
      });

      it("disables the button when the host can alert on no source, with each source's reason", async () => {
        const { alert } = perSource(s => ({ disabled: `No ${s.label}.` }));
        const { container } = renderDashboard(definition(agentRunsWidget), { alert });
        const button = await within(cell(container, 'agent-runs')).findByRole('button', { name: alertLabel });
        expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
          'Completed: No Completed.\nFailed: No Failed.',
        );
      });

      it("disables, in its place, a source whose query the page's filters contradict", async () => {
        const kpis = kpisWidget.views[0];
        if (!kpis) throw new Error('KPIs have no view');
        const widget: DashboardWidget = {
          ...kpisWidget,
          views: [
            {
              ...kpis,
              queries: kpis.queries.map(q =>
                q.id === 'cost' && q.source === 'metrics' ? { ...q, filters: { environment: 'staging' } } : q,
              ),
            },
          ],
        };
        const { alert, spy } = linkEach();
        const { container } = renderDashboard(definition(widget), { alert, environment: 'prod' });
        const menu = await openMenu(cell(container, 'kpis'));
        expect(labels(lastTarget(spy))).not.toContain('Model cost');
        const items = within(menu).getAllByRole('menuitem');
        expect(items.map(i => i.textContent?.split('The page')[0])).toEqual([
          'Agent runs',
          'Model cost',
          'Tokens: input',
          'Tokens: output',
          'Threads',
        ]);
        expect(items[1]?.getAttribute('aria-disabled')).toBe('true');
        expect(items[1]?.textContent).toContain("The page's filters exclude everything this card shows.");
        expect(items[2]?.getAttribute('href')).toBe(`/app/alerts/new?from=${encodeURIComponent('Tokens: input')}`);
      });

      it('puts the menu after the drilldown and before the pin', async () => {
        const { alert } = linkEach();
        const widget = { ...agentRunsWidget, drilldown: { action: { page: 'traces' as const, filters: [] } } };
        const { container } = renderDashboard(definition(widget), {
          alert,
          onDrilldown: () => {},
          pin: { onPin: () => {}, isPinned: () => false },
        });
        const card = cell(container, 'agent-runs');
        const trigger = await within(card).findByRole('button', { name: alertLabel });
        const controls = [...card.querySelectorAll('button, a')];
        const at = (el: Element) => controls.indexOf(el);
        expect(at(within(card).getByRole('button', { name: 'View in traces' }))).toBeLessThan(at(trigger));
        expect(at(trigger)).toBeLessThan(at(within(card).getByRole('button', { name: 'Pin Agent runs' })));
      });
    });
  });

  describe('scope', () => {
    const scoped = definition(
      note('org', 'Org only', { scope: 'org' }),
      note('project', 'Project only', { scope: 'project' }),
      {
        ...note('tabs', ''),
        views: [
          { label: 'Projects', scope: 'org', queries: [unused], options: { text: 'projects' } },
          { label: 'Agents', queries: [unused], options: { text: 'agents' } },
        ],
      },
    );

    it('hides org widgets and views on a project page', () => {
      const { container } = renderDashboard(scoped);
      expect(container.querySelector('[data-widget-id="org"]')).toBeNull();
      expect(screen.getByTestId('note-project')).toBeDefined();
      expect(screen.getByTestId('note-tabs').textContent).toBe('agents');
    });

    it('hides project widgets on an org page', () => {
      const { container } = renderDashboard(scoped, {
        scope: { metrics: { projectLabel: id => id }, dashboard: 'org' },
      });
      expect(container.querySelector('[data-widget-id="project"]')).toBeNull();
      expect(screen.getByTestId('note-org')).toBeDefined();
      expect(screen.getByTestId('note-tabs').textContent).toBe('projects / agents');
    });

    it("hides an org widget on a project page even when this version doesn't know its kind", () => {
      const { container } = renderDashboard(
        definition({ ...note('org-heatmap', 'x', { scope: 'org' }), kind: 'heatmap' }, note('b', 'Still here')),
      );
      expect(container.querySelector('[data-widget-id="org-heatmap"]')).toBeNull();
      expect(screen.queryByText('This widget needs a newer version.')).toBeNull();
      expect(screen.getByTestId('note-b').textContent).toBe('Still here');
    });

    it('draws no row for a row whose widgets are all hidden, so the grid keeps no gap for it', () => {
      const rows: DashboardDefinition = {
        schemaVersion: 1,
        rows: [
          { widgets: [note('everywhere', 'x')] },
          { widgets: [note('project-only', 'x', { scope: 'project' })] },
          { widgets: [note('org-only', 'x', { scope: 'org' }), note('also-org', 'x', { scope: 'org' })] },
        ],
      };
      const rowsOf = (container: HTMLElement) =>
        [...(container.firstElementChild?.children ?? [])].map(row =>
          [...row.querySelectorAll('[data-widget-id]')].map(c => c.getAttribute('data-widget-id')),
        );
      expect(rowsOf(renderDashboard(rows).container)).toEqual([['everywhere'], ['project-only']]);
      cleanup();
      const org = renderDashboard(rows, { scope: { metrics: { projectLabel: id => id }, dashboard: 'org' } });
      expect(rowsOf(org.container)).toEqual([['everywhere'], ['org-only', 'also-org']]);
    });
  });

  it('lays each row out on 12 columns by span', () => {
    const { container } = renderDashboard({
      schemaVersion: 1,
      rows: [
        { widgets: [note('full', 'x', { span: 12 })] },
        { widgets: [note('half', 'x', { span: 6 }), note('third', 'x', { span: 4 })] },
      ],
    });
    // jsdom resolves no container queries, so the cell's declared span is what this can observe.
    expect(cell(container, 'full').getAttribute('data-span')).toBe('12');
    expect(cell(container, 'half').getAttribute('data-span')).toBe('6');
    expect(cell(container, 'third').getAttribute('data-span')).toBe('4');
    // Each row is its own grid, so a short row doesn't pull widgets up from the next.
    expect(cell(container, 'full').parentElement).not.toBe(cell(container, 'half').parentElement);
  });

  it('keeps every saved span once the container has 12 columns, so a saved row never wraps', () => {
    const { container } = renderDashboard({
      schemaVersion: 1,
      rows: [
        { widgets: [note('half', 'x', { span: 6 }), note('third', 'x', { span: 4 }), note('sixth', 'x', { span: 2 })] },
        { widgets: [note('quarter', 'x', { span: 3 }), note('twelfth', 'x', { span: 1 })] },
      ],
    });
    // jsdom resolves no container queries; the classes are what decide the width.
    const columns = (id: string) => cell(container, id).className.match(/@\w+:col-span-\d+/g);
    expect(columns('half')).toEqual(['@3xl:col-span-6']);
    expect(columns('third')).toEqual(['@3xl:col-span-4']);
    expect(columns('sixth')).toEqual(['@3xl:col-span-2']);
    expect(columns('quarter')).toEqual(['@3xl:col-span-3']);
    expect(columns('twelfth')).toEqual(['@3xl:col-span-1']);
  });

  it('stretches every card to its row, so a row of cards shares one height', () => {
    const { container } = renderDashboard({
      schemaVersion: 1,
      rows: [{ widgets: [note('short', 'x', { span: 6 }), note('narrow', 'x', { span: 2 })] }],
    });
    // jsdom lays nothing out; the cell sizing its card to the (stretched) grid row is what equalises them.
    expect(cell(container, 'short').className.split(' ')).toContain('*:size-full');
    expect(cell(container, 'narrow').className.split(' ')).toContain('*:size-full');
  });

  it("adds the page's filters to every widget's queries", async () => {
    serveCapabilities(traceAggregateCapabilities);
    const traces: TraceAggregateRequest[] = [];
    serveTraceAggregate(request => {
      traces.push(request);
      return { rows: [], truncated: false };
    });
    const metrics: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/metrics/timeseries'))
        void request
          .clone()
          .json()
          .then(b => metrics.push(b));
    });
    renderDashboard(definition(agentRunsWidget, distinctIdsWidget), { environment: 'production' });
    await waitFor(() => expect(traces.length).toBeGreaterThan(0));
    await waitFor(() => expect(metrics.length).toBeGreaterThan(0));
    server.events.removeAllListeners();
    for (const body of metrics) expect(body).toMatchObject({ filters: { environment: 'production' } });
    for (const request of traces) expect(JSON.stringify(request.where)).toContain('production');
  });

  it("sends nothing and shows no data when a widget's filters contradict the page's", async () => {
    const sent: string[] = [];
    server.events.on('request:start', ({ request }) => sent.push(new URL(request.url).pathname));
    const [view] = agentRunsWidget.views;
    const runs = view?.queries[0];
    if (!view || runs?.source !== 'metrics') throw new Error('agent runs reads metrics');
    const staging: DashboardWidget = {
      ...agentRunsWidget,
      views: [{ ...view, queries: [{ ...runs, filters: { environment: 'staging' } }] }],
    };
    const { container } = renderDashboard(definition(staging), { environment: 'production' });
    expect(await within(cell(container, 'agent-runs')).findByText('No data in this range')).toBeDefined();
    server.events.removeAllListeners();
    expect(sent.filter(path => path.includes('/metrics/'))).toEqual([]);
  });
});
