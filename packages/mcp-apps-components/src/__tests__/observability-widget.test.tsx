/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ObservabilityWidget } from '../apps/observability-widget/observability-widget';
import { serveAndConnect } from './greeting-server';
import { agentRunsKpi, observabilityServer } from './observability-server';

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
  hostContext: { theme?: 'light' | 'dark' } = {},
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
  const bridge = new AppBridge(client, { name: 'test-host', version: '1.0.0' }, { serverTools: {} }, { hostContext });
  bridge.oninitialized = () => void bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  await bridge.connect(hostTransport);

  render(<ObservabilityWidget />);
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
