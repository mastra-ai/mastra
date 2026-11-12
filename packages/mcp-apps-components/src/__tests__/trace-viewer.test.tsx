/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import type { McpUiHostCapabilities } from '@modelcontextprotocol/ext-apps';
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
  { capabilities = {}, meta }: { capabilities?: McpUiHostCapabilities; meta?: Record<string, unknown> } = {},
) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const client: Client = host.client;
  const called = await client.callTool({ name: 'get_trace', arguments: { traceId } });
  const result = meta ? { ...called, _meta: { ...called._meta, ...meta } } : called;

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
  const bridge = new AppBridge(
    client,
    { name: 'test-host', version: '1.0.0' },
    { serverTools: {}, ...capabilities },
    { hostContext },
  );
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

it('tells the model which trace and span are open, when the host takes context updates', async () => {
  const contexts: string[] = [];
  const bridge = await openTrace(traceServer(), 'trace-1', {}, { capabilities: { updateModelContext: { text: {} } } });
  bridge.onupdatemodelcontext = async ({ content }) => {
    contexts.push(content?.map(block => (block.type === 'text' ? block.text : '')).join('') ?? '');
    return {};
  };

  await waitFor(() => expect(contexts.at(-1)).toContain("They're viewing trace trace-1"), { timeout: 3000 });
  expect(contexts.at(-1)).toContain(
    `whose root is agent_run "agent run: 'weather-agent'" (span root), succeeded, took 6000ms`,
  );
  expect(contexts.at(-1)).toContain('It has 3 spans.');

  fireEvent.click(await spanRow("tool: 'get-weather'"));
  await waitFor(
    () =>
      expect(contexts.at(-1)).toContain(
        `The span open beside it is tool_call "tool: 'get-weather'" (span tool), succeeded, took 2000ms.`,
      ),
    { timeout: 3000 },
  );
});

it('asks the model about the trace, then the picked span, as a user message', async () => {
  const messages: string[] = [];
  const bridge = await openTrace(traceServer(), 'trace-1', {}, { capabilities: { message: { text: {} } } });
  bridge.onmessage = async ({ content }) => {
    messages.push(content.map(block => (block.type === 'text' ? block.text : '')).join(''));
    return {};
  };

  fireEvent.click(await screen.findByRole('button', { name: 'Ask about this trace' }));
  await waitFor(() => expect(messages).toEqual(['Look into trace trace-1. Summarize what happened.']));

  fireEvent.click(await spanRow("tool: 'get-weather'"));
  fireEvent.click(await screen.findByRole('button', { name: 'Ask about this span' }));
  await waitFor(() =>
    expect(messages.at(-1)).toBe(
      `Look into the tool_call "tool: 'get-weather'" (span tool), succeeded, took 2000ms in trace trace-1. What did it do?`,
    ),
  );
});

it("opens the trace, and then the picked span, in Studio at the server's Studio URL", async () => {
  const links: string[] = [];
  const bridge = await openTrace(
    traceServer(),
    'trace-1',
    {},
    { capabilities: { openLinks: {} }, meta: { 'mastra/studioUrl': 'http://studio.test/' } },
  );
  bridge.onopenlink = async ({ url }) => {
    links.push(url);
    return {};
  };

  fireEvent.click(await screen.findByRole('button', { name: 'Open in Studio' }));
  await waitFor(() => expect(links).toEqual(['http://studio.test/traces?traceId=trace-1']));

  fireEvent.click(await spanRow("tool: 'get-weather'"));
  fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  await waitFor(() => expect(links.at(-1)).toBe('http://studio.test/traces?traceId=trace-1&spanId=tool'));
});

it('goes fullscreen and back when the host offers it', async () => {
  const bridge = await openTrace(traceServer(), 'trace-1', {
    displayMode: 'inline',
    availableDisplayModes: ['inline', 'fullscreen'],
  });
  const requested: string[] = [];
  bridge.onrequestdisplaymode = async ({ mode }) => {
    requested.push(mode);
    bridge.setHostContext({ displayMode: mode, availableDisplayModes: ['inline', 'fullscreen'] });
    return { mode };
  };

  fireEvent.click(await screen.findByRole('button', { name: 'Fullscreen' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Exit fullscreen' }));
  await waitFor(() => expect(requested).toEqual(['fullscreen', 'inline']));
  expect(await screen.findByRole('button', { name: 'Fullscreen' })).toBeTruthy();
});

it("offers no host actions the host doesn't support, or a Studio link without a Studio URL", async () => {
  await openTrace(traceServer(), 'trace-1', {}, { capabilities: { openLinks: {} } });

  expect(await spanRow("tool: 'get-weather'")).toBeTruthy();
  for (const name of ['Ask about this trace', 'Open in Studio', 'Fullscreen']) {
    expect(screen.queryByRole('button', { name })).toBeNull();
  }
});
