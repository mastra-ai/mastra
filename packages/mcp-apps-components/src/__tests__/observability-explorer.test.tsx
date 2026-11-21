/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import type { McpUiHostCapabilities } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ObservabilityExplorer } from '../apps/observability-explorer/observability-explorer';
import { serveAndConnect } from './greeting-server';
import { observabilityExplorerServer } from './observability-explorer-server';

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
  vi.useRealTimers();
  restoreViewport.splice(0).forEach(restore => restore());
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

/**
 * Has the model call `tool` on a real MCP server, then renders the app as a host's iframe runs it: an
 * `AppBridge` hands it the call's arguments and result and forwards its tool calls back to the server.
 */
async function openList(
  mcp: ReturnType<typeof observabilityExplorerServer>,
  tool: string,
  args: Record<string, unknown>,
  { capabilities = {}, meta }: { capabilities?: McpUiHostCapabilities; meta?: Record<string, unknown> } = {},
) {
  const host = await serveAndConnect(mcp.server);
  hosts.push(host);
  const client: Client = host.client;
  const called = await client.callTool({ name: tool, arguments: args });
  const result = meta ? { ...called, _meta: { ...called._meta, ...meta } } : called;
  const { tools } = await client.listTools();
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
  const bridge = new AppBridge(
    client,
    { name: 'test-host', version: '1.0.0' },
    { serverTools: {}, ...capabilities },
    { hostContext: { toolInfo: { id: 1, tool: tools.find(listed => listed.name === tool)! } } },
  );
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    await bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  };
  await bridge.connect(hostTransport);

  render(<ObservabilityExplorer />);
  return bridge;
}

const text = (content: { type: string; text?: string }[] | undefined) =>
  content?.map(block => block.text ?? '').join('') ?? '';

const lastHour = () => ({
  from: new Date(Date.now() - 3_600_000).toISOString(),
  to: new Date(Date.now() + 60_000).toISOString(),
});

it("shows the model's trace filters as chips and keeps the rest applied until the user clears it", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  const where = { op: 'eq', left: { path: 'entityName' }, right: { literal: 'support-agent' } };
  await openList(mcp, 'query_traces', { timeRange: lastHour(), where, textSearch: 'refund' });

  expect(await screen.findByText('support-agent')).toBeTruthy();
  expect(screen.queryByText('weather-agent')).toBeNull();
  const banner = "Also filtered by conditions from the conversation that the filter bar can't show.";
  expect(screen.getByText(banner)).toBeTruthy();
  // Every trace query carried the predicate (from the chip) and the text search, and passed the real request schema.
  await waitFor(() => expect(mcp.calls.some(call => call.tool === 'query_traces')).toBe(true), { timeout: 3000 });
  for (const query of mcp.calls.filter(call => call.tool === 'query_traces')) {
    expect(JSON.stringify(query.args.where)).toContain('support-agent');
    expect(query.args.textSearch).toBe('refund');
  }

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

  await waitFor(() => expect(screen.queryByText(banner)).toBeNull());
  await waitFor(() => expect(mcp.calls.at(-1)?.args.textSearch).toBeUndefined());
  // The chip is the user's filter now: clearing the leftover conditions keeps it.
  expect(JSON.stringify(mcp.calls.at(-1)?.args.where)).toContain('support-agent');
  expect(screen.queryByText('weather-agent')).toBeNull();
});

it('opens a picked trace on the timeline through get_trace', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });

  fireEvent.click(await screen.findByText('weather-agent'));

  expect(await screen.findByLabelText("View details for span agent run: 'weather-agent'")).toBeTruthy();
  expect(mcp.calls.at(-1)).toEqual({ tool: 'get_trace', args: { traceId: 'trace-1' } });
  expect(screen.getByRole('button', { name: 'Back to the list' })).toBeTruthy();
});

// Studio sends list paging as query-string text; the tool only takes integers.
it('lists traces from a store without trace queries', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: false });
  await openList(mcp, 'list_traces', {});

  expect(await screen.findByText('weather-agent')).toBeTruthy();
  expect(screen.getByText('support-agent')).toBeTruthy();
  const list = mcp.calls.find(call => call.tool === 'list_traces');
  expect(typeof list?.args.page).toBe('number');
  expect(typeof list?.args.perPage).toBe('number');
});

it("opens the model's log query on the Logs tab and keeps its level until cleared", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(mcp, 'list_logs', { level: 'error' });

  expect(await screen.findByText('Carrier lookup failed for order 42')).toBeTruthy();
  expect(screen.queryByText('Forecast fetched for Lisbon')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Logs', selected: true })).toBeTruthy();
  for (const call of mcp.calls.filter(call => call.tool === 'list_logs')) expect(call.args.level).toBe('error');

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

  expect(await screen.findByText('Forecast fetched for Lisbon')).toBeTruthy();
  expect(mcp.calls.at(-1)).toMatchObject({ tool: 'list_logs' });
  expect(mcp.calls.at(-1)?.args.level).toBeUndefined();
});

it('tells the model the tab, filters, and opened trace on screen, and links each to Studio', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  const where = { op: 'eq', left: { path: 'entityName' }, right: { literal: 'support-agent' } };
  const contexts: string[] = [];
  const links: string[] = [];
  const bridge = await openList(
    mcp,
    'query_traces',
    { timeRange: lastHour(), where },
    {
      capabilities: { updateModelContext: { text: {} }, openLinks: {} },
      meta: { 'mastra/studioUrl': 'http://studio.test' },
    },
  );
  bridge.onupdatemodelcontext = async ({ content }) => {
    contexts.push(text(content));
    return {};
  };
  bridge.onopenlink = async ({ url }) => {
    links.push(url);
    return {};
  };

  await waitFor(() => expect(contexts.at(-1)).toContain("They're on its Traces tab."), { timeout: 3000 });
  const context = contexts.at(-1)!;
  expect(context).toMatch(/^The user has Mastra's observability explorer open\./);
  expect(context).toContain("The trace list's filters, as Studio URL params: datePreset=custom&dateFrom=");
  // The model's predicate became a chip, so it travels in the URL params rather than as a leftover query.
  expect(context).toMatch(/Studio URL params: [^\n]*support-agent/);
  expect(context).not.toContain("It's also filtered by the query the model opened it with");
  fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  await waitFor(() =>
    expect(links.at(-1)).toMatch(/^http:\/\/studio\.test\/traces\?datePreset=custom&dateFrom=.*support-agent/),
  );

  // The chip shows the agent's name too; pick the trace row's.
  const names = await screen.findAllByText('support-agent');
  fireEvent.click(names.find(name => !name.closest('button[aria-label="Value: support-agent"]'))!);
  await waitFor(() => expect(contexts.at(-1)).toContain("They're viewing trace trace-2"), { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  await waitFor(() => expect(links.at(-1)).toBe('http://studio.test/traces?traceId=trace-2'));
});

it("links to Studio only once the conversation's leftover conditions, which Studio can't apply, are cleared", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  await openList(
    mcp,
    'query_traces',
    { timeRange: lastHour(), textSearch: 'refund' },
    { capabilities: { openLinks: {} }, meta: { 'mastra/studioUrl': 'http://studio.test' } },
  );

  expect(
    await screen.findByText("Also filtered by conditions from the conversation that the filter bar can't show."),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open in Studio' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

  expect(await screen.findByRole('button', { name: 'Open in Studio' })).toBeTruthy();
});

it('asks the model about the log open in the side panel', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  const messages: string[] = [];
  const contexts: string[] = [];
  const bridge = await openList(
    mcp,
    'list_logs',
    { level: 'error' },
    {
      capabilities: { message: { text: {} }, updateModelContext: { text: {} } },
    },
  );
  bridge.onmessage = async ({ content }) => {
    messages.push(text(content));
    return {};
  };
  bridge.onupdatemodelcontext = async ({ content }) => {
    contexts.push(text(content));
    return {};
  };

  expect(screen.queryByRole('button', { name: 'Ask about this log' })).toBeNull();
  fireEvent.click(await screen.findByText('Carrier lookup failed for order 42'));
  fireEvent.click(await screen.findByRole('button', { name: 'Ask about this log' }));

  await waitFor(() => expect(messages).toHaveLength(1));
  expect(messages[0]).toMatch(/^Look into this error log from \S+: "Carrier lookup failed for order 42"/);
  await waitFor(() => expect(contexts.at(-1)).toContain('The log open in the side panel'));
  expect(contexts.at(-1)).not.toMatch(/filters, as Studio URL params: [^.]*logId/);
  expect(messages[0]).toMatch(/What caused it\?$/);
});

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

it('lists spans through query_spans and opens a picked span on its trace', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, rows: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });
  await screen.findByText('weather-agent');

  openTab('Spans');

  // Both rows come from query_spans, whose request passed core's schema on the server.
  expect(await screen.findAllByText("agent run: 'support-agent'")).not.toHaveLength(0);
  expect(mcp.calls.some(call => call.tool === 'query_spans')).toBe(true);

  fireEvent.click(screen.getAllByText("agent run: 'weather-agent'")[0]!);

  expect(await screen.findByLabelText("View details for span agent run: 'weather-agent'")).toBeTruthy();
  expect(mcp.calls.at(-1)).toEqual({ tool: 'get_trace', args: { traceId: 'trace-1' } });
});

it("lists threads through query_threads and opens one's traces past the conversation's filter", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, rows: true });
  const where = { op: 'eq', left: { path: 'entityName' }, right: { literal: 'weather-agent' } };
  await openList(mcp, 'query_traces', { timeRange: lastHour(), where });
  await screen.findByText('weather-agent');

  openTab('Threads');

  // The request passed core's schema on the server, so its time range is the traces' window.
  await waitFor(() =>
    expect(mcp.calls.find(call => call.tool === 'query_threads')?.args.timeRange.traces).toBeDefined(),
  );
  const threads = await screen.findByRole('tabpanel', { name: 'Threads' });
  await waitFor(() => expect(within(threads).getByText('support-agent')).toBeTruthy());
  expect(within(threads).getByText('weather-agent')).toBeTruthy();

  fireEvent.click(within(threads).getByText('support-agent'));
  // The drawer reads the thread's traces without the conversation's `weather-agent` condition, which would hide them.
  await waitFor(() => expect(mcp.calls.at(-1)).toEqual({ tool: 'get_trace', args: { traceId: 'trace-2' } }));
  const drawerQuery = mcp.calls.filter(call => call.tool === 'query_traces').at(-1);
  expect(drawerQuery?.args.where).toEqual({
    op: 'eq',
    left: { path: 'threadId' },
    right: { literal: 'thread-trace-2' },
  });
  expect(screen.getByRole('dialog').textContent).toContain('thread-trace-2');
});

it('hides the Spans and Threads tabs when the store does not query rows', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });
  await screen.findByText('weather-agent');

  expect(screen.queryByRole('tab', { name: 'Spans' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Threads' })).toBeNull();
});

/** A run that ended just now, after the list loaded. */
const newRun = () => {
  const now = Date.now();
  return {
    traceId: 'trace-3',
    entityName: 'billing-agent',
    input: 'charge card',
    startedAt: new Date(now - 1000).toISOString(),
    endedAt: new Date(now).toISOString(),
  };
};

it('reloads a rolling trace list every 10 seconds with its end moved to now', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const mcp = observabilityExplorerServer({ traceQuery: true });
  await openList(mcp, 'query_traces', {});
  await screen.findByText('weather-agent');
  const first = mcp.calls.filter(call => call.tool === 'query_traces').at(-1)!;

  mcp.addRun(newRun());
  await vi.advanceTimersByTimeAsync(10_000);

  expect(await screen.findByText('billing-agent')).toBeTruthy();
  const reload = mcp.calls.filter(call => call.tool === 'query_traces').at(-1)!;
  expect(Date.parse(reload.args.timeRange.to)).toBeGreaterThan(Date.parse(first.args.timeRange.to));
  // As in Studio, the preset pins its start when picked; only the end follows the clock.
  expect(reload.args.timeRange.from).toBe(first.args.timeRange.from);
});

it('refetches a fixed trace window in place every 10 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const mcp = observabilityExplorerServer({ traceQuery: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });
  await screen.findByText('weather-agent');
  const first = mcp.calls.filter(call => call.tool === 'query_traces').at(-1)!;

  mcp.addRun(newRun());
  await vi.advanceTimersByTimeAsync(10_000);

  expect(await screen.findByText('billing-agent')).toBeTruthy();
  const refetch = mcp.calls.filter(call => call.tool === 'query_traces').at(-1)!;
  expect(refetch.args.timeRange).toEqual(first.args.timeRange);
});

it.each([
  { tab: 'Spans', tool: 'query_spans', row: "agent run: 'billing-agent'" },
  { tab: 'Threads', tool: 'query_threads', row: 'billing-agent' },
])('brings new rows into the $tab tab every 30 seconds without reloading its pages', async ({ tab, tool, row }) => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const mcp = observabilityExplorerServer({ traceQuery: true, rows: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });
  await screen.findByText('weather-agent');
  openTab(tab);
  const panel = await screen.findByRole('tabpanel', { name: tab });
  await waitFor(() => expect(within(panel).getAllByText(/support-agent/)).not.toHaveLength(0));
  const pages = () => mcp.calls.filter(call => call.tool === tool && call.args.page.limit === 25).length;
  const loaded = pages();

  mcp.addRun(newRun());
  await vi.advanceTimersByTimeAsync(30_000);

  await waitFor(() => expect(within(panel).getAllByText(row)).not.toHaveLength(0));
  // The head poll asked for the newest rows by end time; the loaded page stayed as it was.
  const head = mcp.calls.filter(call => call.tool === tool).at(-1)!;
  expect(head.args.page.limit).toBe(50);
  expect(head.args.orderBy).toEqual([{ field: 'endedAt', direction: 'desc' }]);
  expect(pages()).toBe(loaded);
});
