/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TraceViewer } from '../apps/trace-viewer/trace-viewer';
import { serveAndConnect } from './greeting-server';
import { traceServer } from './trace-server';

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  document.documentElement.className = '';
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

/**
 * Calls `get_trace` on a real MCP server, then renders the app as an iframe would run it, with `window.parent`
 * played by an `AppBridge` that hands the app that result and forwards its tool calls back to the server.
 */
async function openTrace(
  mcp: ReturnType<typeof traceServer>,
  traceId: string,
  hostContext: Record<string, unknown> = {},
) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const client: Client = host.client;
  const result = await client.callTool({ name: 'get_trace', arguments: { traceId } });

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

  render(<TraceViewer />);
  return bridge;
}

const spanRow = (name: string) => screen.findByLabelText(`View details for span ${name}`);

it("draws the trace's spans on Studio's timeline", async () => {
  const mcp = traceServer();
  await openTrace(mcp, 'trace-1');

  expect(await spanRow("agent run: 'weather-agent'")).toBeTruthy();
  expect(await spanRow("llm: 'gpt-5'")).toBeTruthy();
  expect(await spanRow("tool: 'get-weather'")).toBeTruthy();
  expect(mcp.calls.map(call => call.tool)).toEqual(['get_trace']);
});

it('loads the rest of a trace that get_trace returned in pages', async () => {
  const mcp = traceServer({ pageSize: 1 });
  await openTrace(mcp, 'trace-1');

  expect(await spanRow("tool: 'get-weather'")).toBeTruthy();
  expect(await spanRow("llm: 'gpt-5'")).toBeTruthy();
  expect(mcp.calls.map(call => call.args.offset)).toEqual([undefined, 1, 2]);
});

it("loads a picked span's details through get_span", async () => {
  const mcp = traceServer();
  await openTrace(mcp, 'trace-1');

  fireEvent.click(await spanRow("tool: 'get-weather'"));

  // The panel shows the span `get_span` returned, with its recorded input and output.
  expect(await screen.findByText('Parent span')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Output' }));
  await waitFor(() => expect(document.body.textContent).toContain('Sunny, 24°C'));
  expect(mcp.calls.at(-1)).toEqual({ tool: 'get_span', args: { traceId: 'trace-1', spanId: 'tool' } });
});

it('says so when get_trace failed', async () => {
  await openTrace(traceServer(), 'missing');

  expect(await screen.findByText('The trace could not be loaded.')).toBeTruthy();
});

it("follows the host's theme", async () => {
  await openTrace(traceServer(), 'trace-1', { theme: 'light' });

  await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));
});
