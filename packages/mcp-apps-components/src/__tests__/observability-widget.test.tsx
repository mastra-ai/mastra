/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ObservabilityWidget } from '../apps/observability-widget/observability-widget';
import { OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY, observabilityWidgetPins } from '../host';
import type { McpAppRef, ObservabilityWidgetPin } from '../host';
import { serveAndConnect } from './greeting-server';
import { agentRunsChart, agentRunsKpi, observabilityServer } from './observability-server';

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  document.documentElement.className = '';
  // The app reports its size to the host on the next animation frame; let that land before the
  // app unmounts and closes its connection, as it would in an iframe that stays open.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

/**
 * Calls the opening tool on a real MCP server, then renders the app as an iframe would run it, with
 * `window.parent` played by an `AppBridge` that hands the app that tool's result and forwards its
 * tool calls back to the server. Only the `postMessage` wire is stubbed.
 */
async function openWidget(
  mcp: ReturnType<typeof observabilityServer>,
  toolArguments: Record<string, unknown>,
  hostContext: Record<string, unknown> = {},
  capabilities: ConstructorParameters<typeof AppBridge>[2] = { serverTools: {} },
) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const client: Client = host.client;
  const result = await client.callTool({ name: 'showObservabilityWidget', arguments: toolArguments });

  const parent = { postMessage: (message: unknown) => hostTransport.onmessage?.(structuredClone(message) as never) };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
  const hostTransport: Transport = {
    start: async () => {},
    close: async () => {},
    send: async message => {
      const event = new MessageEvent('message', { data: structuredClone(message) });
      Object.defineProperty(event, 'source', { value: parent });
      window.dispatchEvent(event);
    },
  };
  const bridge = new AppBridge(client, { name: 'test-host', version: '1.0.0' }, capabilities, { hostContext });
  bridge.oninitialized = () => void bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  await bridge.connect(hostTransport);

  render(<ObservabilityWidget />);
  return bridge;
}

it('draws the widget from the answer the server reads for it, over the preset window', async () => {
  const mcp = observabilityServer({
    answers: {
      getMetricAggregate: { data: { value: 693, previousValue: 891, changePercent: -22.2 } },
    },
  });

  await openWidget(mcp, { widget: agentRunsKpi, datePreset: '7d' });

  expect(await screen.findByText('693')).toBeTruthy();
  expect(screen.getByText('Agent runs')).toBeTruthy();
  expect(mcp.calls).toHaveLength(1);
  const [call] = mcp.calls;
  expect(call).toMatchObject({
    action: 'getMetricAggregate',
    args: { name: ['mastra_agent_duration_ms'], aggregation: 'count', comparePeriod: 'previous_period' },
  });
  const { start, end } = (call!.args as { filters: { timestamp: { start: string; end: string } } }).filters.timestamp;
  expect(Date.parse(end) - Date.parse(start)).toBe(7 * 24 * 60 * 60 * 1000);
});

it('shows the widget as failed, without retrying, when the tool fails the read', async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { error: 'Not allowed to read metrics' } } });

  await openWidget(mcp, { widget: agentRunsKpi });

  expect(await screen.findByText("Couldn't load")).toBeTruthy();
  expect(mcp.calls).toHaveLength(1);
});

it('says so when the tool returns no valid widget', async () => {
  await openWidget(observabilityServer(), { widget: { id: 'broken', kind: 'kpis' } });

  expect((await screen.findByRole('alert')).textContent).toContain('The widget is invalid');
});

it("follows the host's theme, so a light host doesn't get dark-theme text", async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { data: { value: 1 } } } });

  await openWidget(mcp, { widget: agentRunsKpi }, { theme: 'light' });

  await screen.findByText('Agent runs');
  expect(document.documentElement.classList.contains('light')).toBe(true);
});

const PINNING = { serverTools: {}, updateModelContext: { text: {}, structuredContent: {} } };
const APP: McpAppRef = {
  toolName: 'showObservabilityWidget',
  toolCallId: 'call-1',
  resourceUri: 'ui://mastra/observability-widget',
};

/**
 * A host that owns the pinned ids through `observabilityWidgetPins`, as a chat would: it hears the
 * app's model context and sends its new ids back.
 */
function pinningHost() {
  let pinnedIds: string[] = [];
  const pins: Array<Omit<ObservabilityWidgetPin, 'pinned'>> = [];
  const unpins: string[] = [];
  const host = () =>
    observabilityWidgetPins({
      resourceUri: APP.resourceUri,
      pinnedIds,
      onPin: pin => {
        pins.push(pin);
        pinnedIds = [...pinnedIds, pin.widget.id];
      },
      onUnpin: id => {
        unpins.push(id);
        pinnedIds = pinnedIds.filter(pinned => pinned !== id);
      },
    });
  return {
    pins,
    unpins,
    hostContext: () => host().hostContext!(APP)!,
    pinnedIds: () => pinnedIds,
    connect: (connected: AppBridge) => {
      connected.onupdatemodelcontext = async params => {
        host().onModelContext!(APP, params);
        connected.setHostContext(host().hostContext!(APP) ?? {});
        return {};
      };
    },
  };
}

it.each([
  ['KPI group', agentRunsKpi, 'agent-runs'],
  ['chart', agentRunsChart, 'Agent runs over time'],
])('pins and unpins a %s through the host, which hears the widget and its window', async (_, widget, name) => {
  const mcp = observabilityServer({
    answers: {
      getMetricAggregate: { data: { value: 1 } },
      getMetricTimeSeries: { data: { series: [] } },
    },
  });
  const host = pinningHost();

  host.connect(await openWidget(mcp, { widget, datePreset: '7d' }, host.hostContext(), PINNING));

  fireEvent.click(await screen.findByRole('button', { name: `Pin ${name}` }));
  expect(await screen.findByRole('button', { name: `Unpin ${name}` })).toBeTruthy();
  expect(host.pins).toEqual([{ widget, datePreset: '7d' }]);
  expect(host.pinnedIds()).toEqual([widget.id]);

  fireEvent.click(screen.getByRole('button', { name: `Unpin ${name}` }));
  expect(await screen.findByRole('button', { name: `Pin ${name}` })).toBeTruthy();
  expect(host.unpins).toEqual([widget.id]);
  expect(host.pinnedIds()).toEqual([]);
});

it('shows the widget as pinned when the host already holds it, and follows the host when it unpins', async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { data: { value: 1 } } } });

  const bridge = await openWidget(
    mcp,
    { widget: agentRunsKpi },
    { [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: [agentRunsKpi.id] },
    PINNING,
  );

  expect(await screen.findByRole('button', { name: 'Unpin agent-runs' })).toBeTruthy();
  bridge.setHostContext({ [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: [] });
  expect(await screen.findByRole('button', { name: 'Pin agent-runs' })).toBeTruthy();
});

it('follows the host again once it answers a click, e.g. when the pin is removed elsewhere', async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { data: { value: 1 } } } });
  const host = pinningHost();
  const bridge = await openWidget(mcp, { widget: agentRunsKpi }, host.hostContext(), PINNING);
  host.connect(bridge);

  fireEvent.click(await screen.findByRole('button', { name: 'Pin agent-runs' }));
  await screen.findByRole('button', { name: 'Unpin agent-runs' });
  // Unpinned from another page: the host's ids change without the app asking.
  bridge.setHostContext({ [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: [] });
  expect(await screen.findByRole('button', { name: 'Pin agent-runs' })).toBeTruthy();
});

it('has no pin button when the host sends no pinned ids or takes no structured model context', async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { data: { value: 1 } } } });

  await openWidget(mcp, { widget: agentRunsKpi }, {}, PINNING);
  await screen.findByText('Agent runs');
  expect(screen.queryByRole('button', { name: /Pin agent-runs/ })).toBeNull();
});

it('has no pin button when the host takes only text model context', async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { data: { value: 1 } } } });

  await openWidget(
    mcp,
    { widget: agentRunsKpi },
    { [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: [] },
    { serverTools: {}, updateModelContext: { text: {} } },
  );
  await screen.findByText('Agent runs');
  expect(screen.queryByRole('button', { name: /Pin agent-runs/ })).toBeNull();
});

it('goes back to the host state when the host refuses the update', async () => {
  const mcp = observabilityServer({ answers: { getMetricAggregate: { data: { value: 1 } } } });
  const bridge = await openWidget(
    mcp,
    { widget: agentRunsKpi },
    { [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: [] },
    PINNING,
  );
  bridge.onupdatemodelcontext = async () => {
    throw new Error('No pins here');
  };

  fireEvent.click(await screen.findByRole('button', { name: 'Pin agent-runs' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pin agent-runs' })).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Unpin agent-runs' })).toBeNull();
});
