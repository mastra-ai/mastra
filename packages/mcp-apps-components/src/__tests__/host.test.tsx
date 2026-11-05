// @vitest-environment jsdom
import type { DashboardDefinition } from '@mastra/client-js';
import type * as PlaygroundMcps from '@mastra/playground-ui/domains/mcps';
import { fireEvent, renderHook, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useCallback, useState } from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  agentRunsAggregate,
  agentRunsDashboard,
  emptyTimeSeries,
  supportRunsChart,
} from '../apps/dashboard-renderer/__tests__/fixtures/dashboard';
import { app as dashboardApp } from '../apps/dashboard-renderer/app';
import { DASHBOARD_PIN_REQUEST_CONTEXT_KEY, DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY, useMcpAppHost } from '../host';
import type { DashboardPinnedWidgetEntry, McpAppHostOptions, McpAppHostValue, McpAppRef } from '../host';
import { MASTRA_SERVER, renderWithHost } from '../test/host';
import { server } from '../test/msw-server';

const dashboard: McpAppRef = { toolName: 'showDashboard', toolCallId: 'call-1', resourceUri: 'ui://mastra/dashboard' };
const otherApp: McpAppRef = { toolName: 'showWeather', toolCallId: 'call-2', resourceUri: 'ui://weather/app' };

const supportRuns = supportRunsChart.rows[0]!.widgets[0]!;
const pinnedSupportRuns = { widget: supportRuns, scope: 'project', defaults: { datePreset: '24h', filters: [] } };

// The host types are copied by shape so hosts don't need this package to depend on playground-ui.
it('returns a value McpAppHostProvider accepts', () => {
  expectTypeOf<McpAppHostValue>().toExtend<PlaygroundMcps.McpAppHostValue>();
  expectTypeOf<PlaygroundMcps.McpAppRef>().toExtend<McpAppRef>();
});

/**
 * A chat host keeping the pinned widget ids of one dashboard in state. `save` decides what it keeps
 * of each list the app sends; by default, all of it.
 */
function usePinningHost(initial: string[] | null, save: (requested: string[]) => string[] = requested => requested) {
  const [ids, setIds] = useState(initial);
  const [received, setReceived] = useState<string[][]>([]);
  const pinnedIds = useCallback((app: McpAppRef) => (app.toolCallId === dashboard.toolCallId ? ids : undefined), [ids]);
  const host = useMcpAppHost({
    dashboardPins: {
      pinnedIds,
      onPinnedChange: pinned => {
        const requested = pinned.map(({ widget }) => widget.id);
        setReceived(lists => [...lists, requested]);
        setIds(save(requested));
      },
    },
  });
  return { host, ids, received };
}

// A KPI group and a chart, so each pin has to name the widget it was clicked on.
const twoWidgetDashboard: DashboardDefinition = {
  schemaVersion: 1,
  rows: [...agentRunsDashboard.rows, ...supportRunsChart.rows],
};

/** Renders the dashboard app with the given chat host wired in the way the playground-ui viewer wires it. */
async function connectDashboard(chat: { result: { current: ReturnType<typeof usePinningHost> } }) {
  server.use(
    http.post(`${MASTRA_SERVER}/observability/metrics/aggregate`, () => HttpResponse.json(agentRunsAggregate)),
    http.post(`${MASTRA_SERVER}/observability/metrics/timeseries`, () => HttpResponse.json(emptyTimeSeries)),
  );
  const hostContext = () => chat.result.current.host.hostContext?.(dashboard) ?? {};
  const host = await renderWithHost(dashboardApp, { hostContext: hostContext() });
  host.bridge.onupdatemodelcontext = async params => {
    chat.result.current.host.onModelContext?.(dashboard, params);
    return {};
  };
  await host.sendToolResult({ content: [], structuredContent: { definition: twoWidgetDashboard } });
  expect(await screen.findByText('Support runs')).toBeTruthy();
  /** Sends the app the host's current context once it has handled the app's last update. */
  const answer = async () => {
    // The app numbers its updates from 1, and each one here reaches the host.
    await expect
      .poll(() => {
        const sent = chat.result.current.received.length;
        return sent > 0 && hostContext()[DASHBOARD_PIN_REQUEST_CONTEXT_KEY] === sent;
      })
      .toBe(true);
    await host.setHostContext(hostContext());
  };
  return { host, answer };
}

describe('useMcpAppHost', () => {
  describe('with the dashboard app connected', () => {
    it('pins the widget the user clicks, and shows it pinned in the app', async () => {
      server.use(
        http.post(`${MASTRA_SERVER}/observability/metrics/aggregate`, () => HttpResponse.json(agentRunsAggregate)),
        http.post(`${MASTRA_SERVER}/observability/metrics/timeseries`, () => HttpResponse.json(emptyTimeSeries)),
      );
      const chat = renderHook(() => usePinningHost([]));
      const hostContext = () => chat.result.current.host.hostContext?.(dashboard) ?? {};
      const host = await renderWithHost(dashboardApp, { hostContext: hostContext() });
      // What the playground-ui viewer does with the app's model context.
      host.bridge.onupdatemodelcontext = async params => {
        chat.result.current.host.onModelContext?.(dashboard, params);
        return {};
      };
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      fireEvent.click(await screen.findByRole('button', { name: 'Pin Support runs' }));

      await expect.poll(() => chat.result.current.ids).toEqual(['support-runs']);
      await host.setHostContext(hostContext());
      expect(await screen.findByRole('button', { name: 'Unpin Support runs' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Unpin Support runs' }));

      await expect.poll(() => chat.result.current.ids).toEqual([]);
      await host.setHostContext(hostContext());
      expect(await screen.findByRole('button', { name: 'Pin Support runs' })).toBeTruthy();
    });

    it("stops asking for a pin the host turns down, even though its ids don't change", async () => {
      const chat = renderHook(() => usePinningHost([], () => []));
      const { answer } = await connectDashboard(chat);

      fireEvent.click(screen.getByRole('button', { name: 'Pin Support runs' }));
      await answer();
      expect(screen.getByRole('button', { name: 'Pin Support runs' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Pin widget' }));

      await expect.poll(() => chat.result.current.received).toEqual([['support-runs'], ['kpis']]);
    });

    it('builds on the pins the host took before the next click', async () => {
      const chat = renderHook(() => usePinningHost([]));
      const { answer } = await connectDashboard(chat);

      fireEvent.click(screen.getByRole('button', { name: 'Pin Support runs' }));
      await answer();
      expect(await screen.findByRole('button', { name: 'Unpin Support runs' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Pin widget' }));

      await expect.poll(() => chat.result.current.ids).toEqual(['support-runs', 'kpis']);
    });

    it("treats pins the host couldn't save as turned down", async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      let failing = true;
      const chat = renderHook(() =>
        usePinningHost([], requested => {
          if (failing) throw new Error('Storage is down');
          return requested;
        }),
      );
      const { answer } = await connectDashboard(chat);

      fireEvent.click(screen.getByRole('button', { name: 'Pin Support runs' }));
      await answer();
      failing = false;
      fireEvent.click(screen.getByRole('button', { name: 'Pin widget' }));

      await expect.poll(() => chat.result.current.ids).toEqual(['kpis']);
      expect(errors).toHaveBeenCalledWith(
        '[Mastra dashboard] Couldn\'t save the pins from "showDashboard"',
        expect.any(Error),
      );
      errors.mockRestore();
    });

    it('hides the pin buttons while the host turns pinning off', async () => {
      server.use(
        http.post(`${MASTRA_SERVER}/observability/metrics/timeseries`, () => HttpResponse.json(emptyTimeSeries)),
      );
      const chat = renderHook(() => usePinningHost(null));
      const host = await renderWithHost(dashboardApp, {
        hostContext: chat.result.current.host.hostContext?.(dashboard) ?? {},
      });
      await host.sendToolResult({ content: [], structuredContent: { definition: supportRunsChart } });

      expect(await screen.findByText('Support runs')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /pin/i })).toBeNull();
    });
  });

  describe('host context', () => {
    it('gives each dashboard its pinned ids, and other apps nothing', () => {
      const { result } = renderHook(() => usePinningHost(['support-runs']));

      expect(result.current.host.hostContext?.(dashboard)).toEqual({
        [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ['support-runs'],
      });
      expect(result.current.host.hostContext?.(otherApp)).toBeUndefined();
    });

    it('sends null to turn pinning off', () => {
      const { result } = renderHook(() => usePinningHost(null));

      expect(result.current.host.hostContext?.(dashboard)).toEqual({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: null });
    });

    it('leaves the apps alone when the host supports no features', () => {
      const { result } = renderHook(() => useMcpAppHost({}));

      expect(result.current).toEqual({});
    });
  });

  describe('model context from the app', () => {
    function renderPinHost(pinnedIds: (app: McpAppRef) => readonly string[] | null | undefined = () => []) {
      const onPinnedChange = vi.fn<(pinned: DashboardPinnedWidgetEntry[], app: McpAppRef) => void>();
      const rendered = renderHook((options: McpAppHostOptions) => useMcpAppHost(options), {
        initialProps: { dashboardPins: { pinnedIds, onPinnedChange } },
      });
      return { ...rendered, onPinnedChange };
    }

    it('hands the host the full pinned list with the app it came from', () => {
      const { result, onPinnedChange } = renderPinHost();

      result.current.onModelContext?.(dashboard, {
        structuredContent: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [pinnedSupportRuns] },
      });

      expect(onPinnedChange).toHaveBeenCalledWith([expect.objectContaining({ scope: 'project' })], dashboard);
      expect(onPinnedChange.mock.calls[0]?.[0][0]?.widget.id).toBe('support-runs');
    });

    it('treats an empty list as everything unpinned', () => {
      const { result, onPinnedChange } = renderPinHost();

      result.current.onModelContext?.(dashboard, { structuredContent: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [] } });

      expect(onPinnedChange).toHaveBeenCalledWith([], dashboard);
    });

    it('ignores updates without pin state, such as a drilldown on its own', () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result, onPinnedChange } = renderPinHost();

      result.current.onModelContext?.(dashboard, { structuredContent: { drilldown: { page: 'traces' } } });
      result.current.onModelContext?.(dashboard, { content: [{ type: 'text', text: 'Hi' }] });

      expect(onPinnedChange).not.toHaveBeenCalled();
      // Normal updates, not invalid ones.
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    it('drops and reports pinned widgets that are not valid', () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result, onPinnedChange } = renderPinHost();

      result.current.onModelContext?.(dashboard, {
        structuredContent: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [{ ...pinnedSupportRuns, scope: 'everyone' }] },
      });
      result.current.onModelContext?.(dashboard, {
        structuredContent: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: 'support-runs' },
      });

      expect(onPinnedChange).not.toHaveBeenCalled();
      expect(errors.mock.calls.map(([message]) => message)).toEqual([
        '[Mastra dashboard] Ignored invalid pinned widgets from "showDashboard"',
        '[Mastra dashboard] Ignored invalid pinned widgets from "showDashboard"',
      ]);
      errors.mockRestore();
    });

    it("ignores pins from apps the host doesn't let pin", () => {
      const { result, onPinnedChange } = renderPinHost(app =>
        app.toolCallId === dashboard.toolCallId ? null : undefined,
      );
      const update = { structuredContent: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [pinnedSupportRuns] } };

      result.current.onModelContext?.(dashboard, update);
      result.current.onModelContext?.(otherApp, update);

      expect(onPinnedChange).not.toHaveBeenCalled();
    });

    it('calls the latest handler the host passed', () => {
      const pinnedIds = () => [];
      const { result, rerender, onPinnedChange } = renderPinHost(pinnedIds);
      const latest = vi.fn();
      rerender({ dashboardPins: { pinnedIds, onPinnedChange: latest } });

      result.current.onModelContext?.(dashboard, { structuredContent: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [] } });

      expect(latest).toHaveBeenCalledWith([], dashboard);
      expect(onPinnedChange).not.toHaveBeenCalled();
    });
  });
});
