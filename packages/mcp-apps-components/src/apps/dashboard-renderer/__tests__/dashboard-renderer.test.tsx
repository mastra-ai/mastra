// @vitest-environment jsdom
import type { DashboardDefinition } from '@mastra/client-js';
import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_SERVER, renderWithHost } from '../../../test/host';
import { server } from '../../../test/msw-server';
import { app } from '../app';
import { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY, dashboardPinnedWidgetsSchema } from '../pin';
import { agentRunsAggregate, agentRunsDashboard, emptyTimeSeries, supportRunsChart } from './fixtures/dashboard';

const AGGREGATE_API = `${MASTRA_SERVER}/observability/metrics/aggregate`;
const TIME_SERIES_API = `${MASTRA_SERVER}/observability/metrics/timeseries`;

type AggregateBody = { filters: { timestamp: { start: string; end: string } } };
type ModelContext = { content: Array<{ type: string; text: string }>; structuredContent: Record<string, unknown> };

/** The model context update the app sent last; each one replaces the previous on the host. */
const lastContext = (host: { modelContexts: unknown[] }) => host.modelContexts.at(-1) as ModelContext | undefined;

describe('dashboard renderer app', () => {
  describe('when the host has not sent the tool result yet', () => {
    it('shows that the dashboard is loading', async () => {
      await renderWithHost(app);

      expect(await screen.findByText('Loading dashboard')).toBeTruthy();
    });
  });

  describe('when the tool result carries a dashboard', () => {
    it('renders the widgets with metrics read through the host', async () => {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json(agentRunsAggregate)));
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { definition: agentRunsDashboard } });

      expect(await screen.findByText('Agent runs')).toBeTruthy();
      expect(await screen.findByText('693')).toBeTruthy();
      // The iframe never reaches the network itself: MSW fails any request it didn't expect,
      // and every read went through the server's metrics tool.
      expect(host.toolCalls.length).toBeGreaterThan(0);
      expect(host.toolCalls.every(name => name === 'observabilityMetricAggregate')).toBe(true);
    });
  });

  describe("when the server's route fails", () => {
    it('shows the error in the widget instead of the value', async () => {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { definition: agentRunsDashboard } });

      expect(await screen.findByText('Agent runs')).toBeTruthy();
      await expect.poll(() => host.toolCalls.length).toBeGreaterThan(0);
      expect(screen.queryByText('693')).toBeNull();
    });
  });

  describe('when the definition sets a default time range', () => {
    it('fetches metrics over that range', async () => {
      const windowsInHours: number[] = [];
      server.use(
        http.post<never, AggregateBody>(AGGREGATE_API, async ({ request }) => {
          const body = await request.json();
          const { start, end } = body.filters.timestamp;
          windowsInHours.push(Math.round((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000));
          return HttpResponse.json(agentRunsAggregate);
        }),
      );
      const host = await renderWithHost(app);

      await host.sendToolResult({
        content: [],
        structuredContent: { definition: { ...agentRunsDashboard, defaults: { datePreset: '7d' } } },
      });

      expect(await screen.findByText('693')).toBeTruthy();
      expect(windowsInHours).toContain(7 * 24);
      expect(windowsInHours).not.toContain(24);
    });
  });

  describe('when the host forwards the tool output only as JSON text', () => {
    it('renders the dashboard from the text content', async () => {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json(agentRunsAggregate)));
      const host = await renderWithHost(app);

      await host.sendToolResult({
        content: [{ type: 'text', text: JSON.stringify({ definition: agentRunsDashboard }) }],
      });

      expect(await screen.findByText('693')).toBeTruthy();
    });
  });

  describe('when the tool result has no dashboard', () => {
    it('explains which field is wrong instead of rendering', async () => {
      const host = await renderWithHost(app);

      await host.sendToolResult({ content: [], structuredContent: { scope: 'project' } });

      expect(await screen.findByText("Couldn't show this dashboard")).toBeTruthy();
      expect(screen.getByText(/`definition`/)).toBeTruthy();
    });
  });

  describe('when the user drills into a chart', () => {
    it('hands the host the exact filters, then asks for that data in the chat', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const host = await renderWithHost(app);
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      fireEvent.click(await screen.findByRole('button', { name: 'View in traces' }));

      await expect.poll(() => host.chat).toEqual(['context', 'message']);
      expect(host.modelContexts).toEqual([
        {
          content: [
            { type: 'text', text: 'The user drilled into the traces for entityName "support", over the last 24h.' },
          ],
          structuredContent: {
            drilldown: { page: 'traces', filters: { entityName: 'support' }, timeRange: { preset: '24h' } },
          },
        },
      ]);
      expect(host.messages).toEqual(['Show me the traces for the selection I drilled into.']);
    });

    it('spells the filters out in the message on hosts without model context', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const host = await renderWithHost(app, { capabilities: { serverTools: {}, message: {} } });
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      fireEvent.click(await screen.findByRole('button', { name: 'View in traces' }));

      await expect
        .poll(() => host.messages)
        .toEqual(['Show me the traces for entityName "support", over the last 24h.']);
      expect(host.modelContexts).toEqual([]);
    });

    it('reports a host that fails mid-drilldown instead of leaving the rejection unhandled', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const host = await renderWithHost(app);
      host.bridge.onupdatemodelcontext = async () => {
        throw new Error('Host went away');
      };
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      fireEvent.click(await screen.findByRole('button', { name: 'View in traces' }));

      await expect
        .poll(() => errors.mock.calls.map(([message]) => message))
        .toContain('[Mastra dashboard] Drilldown failed');
      expect(host.messages).toEqual([]);
      errors.mockRestore();
    });

    it('offers no drilldown on hosts without a chat to continue', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const host = await renderWithHost(app, { capabilities: { serverTools: {} } });
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      expect(await screen.findByText('Support runs')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'View in traces' })).toBeNull();
    });
  });

  describe('when the tool call failed', () => {
    it('shows the error the tool reported', async () => {
      const host = await renderWithHost(app);

      await host.sendToolResult({ isError: true, content: [{ type: 'text', text: 'Dashboard not found' }] });

      expect(await screen.findByText('Dashboard not found')).toBeTruthy();
    });
  });

  describe('when the tool call is cancelled', () => {
    it('stops loading and says so', async () => {
      const host = await renderWithHost(app);

      await host.sendToolCancelled();

      expect(await screen.findByText('The tool call was cancelled.')).toBeTruthy();
    });
  });

  describe('when the host uses a light theme', () => {
    it('switches the design system to its light theme', async () => {
      await renderWithHost(app, { hostContext: { theme: 'light' } });

      expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('follows the host back to dark', async () => {
      const host = await renderWithHost(app, { hostContext: { theme: 'light' } });

      await host.setHostContext({ theme: 'dark' });

      await expect.poll(() => document.documentElement.classList.contains('light')).toBe(false);
    });
  });

  describe('when the host can pin widgets', () => {
    // A KPI group and a chart, so each pin has to name the widget it was clicked on.
    const pinnableDashboard: DashboardDefinition = {
      schemaVersion: 1,
      defaults: { datePreset: '7d', filters: [{ fieldId: 'environment', value: 'production' }] },
      rows: [...agentRunsDashboard.rows, ...supportRunsChart.rows],
    };
    // The range and filters the dashboard was showing, so the host can show the widget the same way.
    const pageDefaults = { datePreset: '7d', filters: [{ fieldId: 'environment', value: 'production' }] };

    const widgetCell = (id: string) => {
      const found = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
      if (!found) throw new Error(`No widget ${id}`);
      return found;
    };

    async function showDashboard(pinnedWidgets: string[]) {
      server.use(
        http.post(AGGREGATE_API, () => HttpResponse.json(agentRunsAggregate)),
        http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)),
      );
      const host = await renderWithHost(app, {
        hostContext: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: pinnedWidgets },
      });
      await host.sendToolResult({ content: [], structuredContent: { definition: pinnableDashboard, scope: 'org' } });
      expect(await screen.findByText('Agent runs')).toBeTruthy();
      expect(await screen.findByText('Support runs')).toBeTruthy();
      return host;
    }

    // The ids of the widgets the app last asked the host to pin, read from its full pinned list.
    const requestedIds = (host: { modelContexts: unknown[] }) => {
      const pinned = lastContext(host)?.structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
      return dashboardPinnedWidgetsSchema.parse(pinned).map(({ widget }) => widget.id);
    };

    it('reports every widget the user wants pinned in model context, and shows it pinned once the host says so', async () => {
      const host = await showDashboard(['kpis']);

      fireEvent.click(within(widgetCell('support-runs')).getByRole('button', { name: 'Pin Support runs' }));

      await expect.poll(() => host.modelContexts).toHaveLength(1);
      const context = lastContext(host);
      // The full list, not the change: the widget the host already pinned comes along.
      expect(context?.structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]).toEqual([
        { widget: expect.objectContaining({ id: 'kpis', kind: 'kpis' }), scope: 'org', defaults: pageDefaults },
        {
          widget: expect.objectContaining({ id: 'support-runs', kind: 'timeseries', title: 'Support runs' }),
          scope: 'org',
          defaults: pageDefaults,
        },
      ]);
      // What hosts parse the payload with accepts what the app sends.
      expect(
        dashboardPinnedWidgetsSchema.safeParse(context?.structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY])
          .success,
      ).toBe(true);
      // Hosts that only forward model context still tell the model what is pinned.
      expect(context?.content).toEqual([
        { type: 'text', text: 'The user pinned these widgets of this dashboard: "kpis", "Support runs".' },
      ]);
      // Pinning stays inside the MCP Apps spec.
      expect(host.notifications).toEqual([]);
      // The host owns the state: until it answers, the widget still shows unpinned.
      expect(within(widgetCell('support-runs')).getByRole('button', { name: 'Pin Support runs' })).toBeTruthy();

      await host.setHostContext({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ['kpis', 'support-runs'] });

      expect(
        await within(widgetCell('support-runs')).findByRole('button', { name: 'Unpin Support runs' }),
      ).toBeTruthy();
      expect(within(widgetCell('kpis')).getByRole('button', { name: 'Unpin widget' })).toBeTruthy();
    });

    it('reports the list without a widget the user unpins', async () => {
      const host = await showDashboard(['kpis']);

      fireEvent.click(within(widgetCell('kpis')).getByRole('button', { name: 'Unpin widget' }));

      await expect.poll(() => host.modelContexts).toHaveLength(1);
      expect(lastContext(host)?.structuredContent).toEqual({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [] });
      expect(lastContext(host)?.content).toEqual([
        { type: 'text', text: 'The user has no widgets of this dashboard pinned.' },
      ]);
    });

    it('builds each click on the previous one when the host has not answered yet', async () => {
      const host = await showDashboard([]);

      fireEvent.click(within(widgetCell('support-runs')).getByRole('button', { name: 'Pin Support runs' }));
      fireEvent.click(within(widgetCell('kpis')).getByRole('button', { name: 'Pin widget' }));

      await expect.poll(() => host.modelContexts).toHaveLength(2);
      expect(requestedIds(host)).toEqual(['support-runs', 'kpis']);
    });

    it('keeps building on its own clicks through context changes that leave the pins out', async () => {
      const host = await showDashboard([]);

      fireEvent.click(within(widgetCell('support-runs')).getByRole('button', { name: 'Pin Support runs' }));
      await expect.poll(() => host.modelContexts).toHaveLength(1);
      await host.setHostContext({ theme: 'light' });
      fireEvent.click(within(widgetCell('kpis')).getByRole('button', { name: 'Pin widget' }));

      await expect.poll(() => host.modelContexts).toHaveLength(2);
      expect(requestedIds(host)).toEqual(['support-runs', 'kpis']);
    });

    it('builds on what the host sends back, even when it declines a pin', async () => {
      const host = await showDashboard([]);

      fireEvent.click(within(widgetCell('support-runs')).getByRole('button', { name: 'Pin Support runs' }));
      await expect.poll(() => host.modelContexts).toHaveLength(1);
      await host.setHostContext({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ['kpis'] });
      fireEvent.click(within(widgetCell('kpis')).getByRole('button', { name: 'Unpin widget' }));

      await expect.poll(() => host.modelContexts).toHaveLength(2);
      expect(requestedIds(host)).toEqual([]);
    });

    it('keeps the pinned widgets in the model context a drilldown sends, and the drilldown in later pins', async () => {
      const host = await showDashboard(['kpis']);

      fireEvent.click(within(widgetCell('support-runs')).getByRole('button', { name: 'View in traces' }));

      await expect.poll(() => host.chat).toEqual(['context', 'message']);
      expect(lastContext(host)?.structuredContent).toEqual({
        drilldown: expect.objectContaining({ page: 'traces' }),
        [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [
          { widget: expect.objectContaining({ id: 'kpis' }), scope: 'org', defaults: pageDefaults },
        ],
      });
      const sentDrilldown = lastContext(host)?.structuredContent.drilldown;

      fireEvent.click(within(widgetCell('support-runs')).getByRole('button', { name: 'Pin Support runs' }));

      await expect.poll(() => host.modelContexts).toHaveLength(2);
      expect(lastContext(host)?.structuredContent.drilldown).toEqual(sentDrilldown);
      expect(requestedIds(host)).toEqual(['kpis', 'support-runs']);
    });

    it('follows the host when it unpins a widget itself', async () => {
      const host = await showDashboard(['kpis', 'support-runs']);

      await host.setHostContext({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ['support-runs'] });

      expect(await within(widgetCell('kpis')).findByRole('button', { name: 'Pin widget' })).toBeTruthy();
      expect(within(widgetCell('support-runs')).getByRole('button', { name: 'Unpin Support runs' })).toBeTruthy();
      expect(host.modelContexts).toEqual([]);
    });

    it('keeps the pinned widgets through context changes that leave them out', async () => {
      const host = await showDashboard(['kpis']);

      await host.setHostContext({ theme: 'light' });
      await expect.poll(() => document.documentElement.classList.contains('light')).toBe(true);

      expect(within(widgetCell('kpis')).getByRole('button', { name: 'Unpin widget' })).toBeTruthy();
    });

    it('hides the pin buttons when the host turns pinning off', async () => {
      const host = await showDashboard(['kpis']);

      await host.setHostContext({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: null });

      await expect.poll(() => screen.queryByRole('button', { name: /pin/i })).toBeNull();
    });
  });

  describe("when the host can't pin widgets", () => {
    async function showDashboard(options: Parameters<typeof renderWithHost>[1]) {
      server.use(http.post(AGGREGATE_API, () => HttpResponse.json(agentRunsAggregate)));
      const host = await renderWithHost(app, options);
      await host.sendToolResult({ content: [], structuredContent: { definition: agentRunsDashboard } });
      expect(await screen.findByText('Agent runs')).toBeTruthy();
      return host;
    }

    it('shows no pin buttons when the host keeps no pinned widgets', async () => {
      await showDashboard({});

      expect(screen.queryByRole('button', { name: /pin/i })).toBeNull();
    });

    it('shows no pin buttons when the host takes model context only as text', async () => {
      await showDashboard({
        hostContext: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [] },
        capabilities: { serverTools: {}, message: {}, updateModelContext: { text: {} } },
      });

      expect(screen.queryByRole('button', { name: /pin/i })).toBeNull();
    });

    it('leaves the pin key out of the model context a drilldown sends', async () => {
      server.use(http.post(TIME_SERIES_API, () => HttpResponse.json(emptyTimeSeries)));
      const host = await renderWithHost(app, {
        hostContext: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ['support-runs'] },
        capabilities: { serverTools: {}, message: {}, updateModelContext: { text: {} } },
      });
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      fireEvent.click(await screen.findByRole('button', { name: 'View in traces' }));

      await expect.poll(() => host.modelContexts).toHaveLength(1);
      expect(Object.keys(lastContext(host)?.structuredContent ?? {})).toEqual(['drilldown']);
    });
  });
});
