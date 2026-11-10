/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TraceList } from '../apps/trace-list/trace-list';
import { serveAndConnect } from './greeting-server';
import { traceListServer } from './trace-list-server';

// jsdom doesn't lay out, so Studio's virtualized lists would measure a zero-height viewport and draw no rows.
const restoreViewport: Array<() => void> = [];
beforeEach(() => {
  for (const [key, size] of [
    ['clientHeight', 720],
    ['clientWidth', 1024],
  ] as const) {
    const spy = vi.spyOn(HTMLElement.prototype, key, 'get').mockReturnValue(size);
    restoreViewport.push(() => spy.mockRestore());
  }
});

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  restoreViewport.splice(0).forEach(restore => restore());
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

/**
 * Has the model call `tool` on a real MCP server, then renders the app as a host's iframe runs it: an
 * `AppBridge` hands it the call's arguments and result and forwards its tool calls back to the server.
 */
async function openList(mcp: ReturnType<typeof traceListServer>, tool: string, args: Record<string, unknown>) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const client: Client = host.client;
  const result = await client.callTool({ name: tool, arguments: args });
  mcp.calls.length = 0;

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
  const bridge = new AppBridge(client, { name: 'test-host', version: '1.0.0' }, { serverTools: {} });
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    await bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  };
  await bridge.connect(hostTransport);

  render(<TraceList />);
}

const lastHour = () => ({
  from: new Date(Date.now() - 3_600_000).toISOString(),
  to: new Date(Date.now() + 60_000).toISOString(),
});

it("keeps the model's trace query applied until the user clears it", async () => {
  const mcp = traceListServer({ traceQuery: true });
  const where = { op: 'eq', left: { path: 'entityName' }, right: { literal: 'support-agent' } };
  await openList(mcp, 'query_traces', { timeRange: lastHour(), where });

  expect(await screen.findByText('support-agent')).toBeTruthy();
  expect(screen.queryByText('weather-agent')).toBeNull();
  expect(screen.getByText('Also filtered by the query from the conversation.')).toBeTruthy();
  // Every trace query the explorer sent carried the model's predicate, and passed the real request schema.
  const queries = mcp.calls.filter(call => call.tool === 'query_traces');
  expect(queries.length).toBeGreaterThan(0);
  for (const query of queries) expect(JSON.stringify(query.args.where)).toContain('support-agent');

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

  expect(await screen.findByText('weather-agent')).toBeTruthy();
  expect(screen.getByText('support-agent')).toBeTruthy();
  expect(screen.queryByText('Also filtered by the query from the conversation.')).toBeNull();
  expect(JSON.stringify(mcp.calls.at(-1)?.args.where ?? null)).not.toContain('support-agent');
});

it('opens a picked trace on the timeline through get_trace', async () => {
  const mcp = traceListServer({ traceQuery: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });

  fireEvent.click(await screen.findByText('weather-agent'));

  expect(await screen.findByLabelText("View details for span agent run: 'weather-agent'")).toBeTruthy();
  expect(mcp.calls.at(-1)).toEqual({ tool: 'get_trace', args: { traceId: 'trace-1' } });
  expect(screen.getByRole('button', { name: 'Back to the list' })).toBeTruthy();
});

// Studio sends list paging as query-string text; the tool only takes integers.
it('lists traces from a store without trace queries', async () => {
  const mcp = traceListServer({ traceQuery: false });
  await openList(mcp, 'list_traces', {});

  expect(await screen.findByText('weather-agent')).toBeTruthy();
  expect(screen.getByText('support-agent')).toBeTruthy();
  const list = mcp.calls.find(call => call.tool === 'list_traces');
  expect(typeof list?.args.page).toBe('number');
  expect(typeof list?.args.perPage).toBe('number');
});
