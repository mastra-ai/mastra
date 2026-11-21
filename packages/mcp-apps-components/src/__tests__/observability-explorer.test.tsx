/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import type { McpUiHostCapabilities } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ObservabilityExplorer } from '../apps/observability-explorer/observability-explorer';
import { MAX_CONTEXT } from '../apps/observability-explorer/view-sync';
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

const POLL = { timeout: 5_000 };

it('follows the model steering an open view, and reports what the user then has on screen', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();

  // The model shows error logs instead: the view, polling, switches to them without a new tool call opening it.
  Object.assign(mcp.view, { version: 1, by: 'model', state: { tool: 'list_logs', args: { level: 'error' } } });
  expect(await screen.findByText('Carrier lookup failed for order 42', undefined, POLL)).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Logs', selected: true })).toBeTruthy();
  expect(screen.queryByText('Forecast fetched for Lisbon')).toBeNull();

  // It reports what's on screen against the version it shows, keeping the model's list.
  await waitFor(() => {
    const report = mcp.calls.find(call => call.tool === 'sync_observability_view' && call.args.base === 1);
    expect(report?.args).toMatchObject({
      viewId: 'view-1',
      base: 1,
      state: { tool: 'list_logs', args: { level: 'error' }, context: expect.stringContaining('Logs tab') },
    });
  }, POLL);
  const reported = mcp.view.version;

  // The model opens a trace over the logs; the user closes it, and the view says so.
  Object.assign(mcp.view, {
    version: reported + 1,
    by: 'model',
    state: { tool: 'list_logs', args: { level: 'error' }, traceId: 'trace-1' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Back to Logs' }, POLL));
  await waitFor(() => {
    const last = mcp.calls.filter(call => call.tool === 'sync_observability_view').at(-1);
    expect(last?.args.base).toBe(reported + 1);
    expect(last?.args.state).not.toHaveProperty('traceId');
  }, POLL);
  expect(mcp.view.by).toBe('app');
}, 20_000);

it('brings the user back when the model sets the same view again after they moved off it', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();

  const errorLogs = { tool: 'list_logs', args: { level: 'error' } };
  Object.assign(mcp.view, { version: 1, by: 'model', state: errorLogs });
  expect(await screen.findByRole('tab', { name: 'Logs', selected: true }, POLL)).toBeTruthy();
  await waitFor(() => expect(mcp.view.version).toBe(2), POLL);

  // The user goes back to the traces; the model then asks for the error logs again.
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Traces' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Traces' }));
  expect(await screen.findByRole('tab', { name: 'Traces', selected: true })).toBeTruthy();
  await waitFor(() => expect(mcp.view.state?.context).toContain('Traces tab'), POLL);
  Object.assign(mcp.view, { version: mcp.view.version + 1, by: 'model', state: errorLogs });
  expect(await screen.findByRole('tab', { name: 'Logs', selected: true }, POLL)).toBeTruthy();
}, 20_000);

it('keeps following the model after a sync call fails', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  Object.assign(mcp.view, { failures: 2 });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();
  await waitFor(() => expect(mcp.view.failures).toBe(0), { timeout: 8_000 });

  Object.assign(mcp.view, { version: 1, by: 'model', state: { tool: 'list_logs', args: { level: 'error' } } });
  expect(await screen.findByText('Carrier lookup failed for order 42', undefined, POLL)).toBeTruthy();
}, 20_000);

it('cuts what it reports of the screen to what the server takes', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(
    mcp,
    'query_traces',
    { timeRange: lastHour(), textSearch: 'refund '.repeat(1000) },
    { meta: { 'mastra/viewId': 'view-1' } },
  );
  await waitFor(() => expect(mcp.calls.some(call => call.tool === 'sync_observability_view')).toBe(true), POLL);
  const report = mcp.calls.find(call => call.tool === 'sync_observability_view')!;
  expect(report.args.state.context.length).toBe(MAX_CONTEXT);
}, 20_000);

it("doesn't poll a view the server gave no id", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() });
  expect(await screen.findByText('weather-agent')).toBeTruthy();
  await new Promise(resolve => setTimeout(resolve, 2_000));
  expect(mcp.calls.some(call => call.tool === 'sync_observability_view')).toBe(false);
  expect(mcp.view.version).toBe(0);
});

it("keeps the user's latest change when they make two before the first report is answered", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();

  // The model shows error logs; the view applies them and reports that screen.
  Object.assign(mcp.view, { version: 1, by: 'model', state: { tool: 'list_logs', args: { level: 'error' } } });
  expect(await screen.findByRole('tab', { name: 'Logs', selected: true }, POLL)).toBeTruthy();
  await waitFor(() => expect(mcp.view.version).toBe(2), POLL);

  // The server is slow to answer: the user makes two changes before the first report comes back.
  let release!: () => void;
  mcp.view.reportsHeld = new Promise<void>(resolve => (release = resolve));
  const reports = () => mcp.calls.filter(call => call.tool === 'sync_observability_view');
  const before = reports().length;
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Traces' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Traces' }));
  await waitFor(() => expect(reports()).toHaveLength(before + 1), POLL);
  fireEvent.click(await screen.findByText('weather-agent'));
  expect(await screen.findByRole('button', { name: 'Back to the list' })).toBeTruthy();
  // Past the host's debounce, the second change waits for the first instead of racing it.
  await new Promise(resolve => setTimeout(resolve, 1_000));
  expect(reports()).toHaveLength(before + 1);
  release();

  // It goes out against the version the first one left, so the server takes it.
  await waitFor(() => expect(reports()).toHaveLength(before + 2), POLL);
  const [first, second] = reports().slice(before);
  expect(second!.args.base).toBe(first!.args.base + 1);
  await waitFor(() => expect(mcp.view.state?.context).toBe(second!.args.state.context), POLL);
  expect(mcp.view.by).toBe('app');
  // The next polls leave the user where they are instead of snapping back to the model's logs.
  await new Promise(resolve => setTimeout(resolve, 2_000));
  expect(screen.getByRole('button', { name: 'Back to the list' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Logs', selected: true })).toBeNull();
}, 20_000);

it('stops polling a view the server says is gone', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  Object.assign(mcp.view, { gone: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();
  await waitFor(() => expect(mcp.view.syncCalls).toBe(1), POLL);
  // A 404 (its status in the error, not its wording) is final: no retry follows.
  await new Promise(resolve => setTimeout(resolve, 3_500));
  expect(mcp.view.syncCalls).toBe(1);
}, 20_000);

it("doesn't send a change the user made before the model's, once the model's has replaced it", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();
  Object.assign(mcp.view, { version: 1, by: 'model', state: { tool: 'list_logs', args: { level: 'error' } } });
  expect(await screen.findByRole('tab', { name: 'Logs', selected: true }, POLL)).toBeTruthy();
  await waitFor(() => expect(mcp.view.version).toBe(2), POLL);

  // The server takes the user's first change but is slow to answer; their second waits behind it.
  let release!: () => void;
  mcp.view.reportsHeld = new Promise<void>(resolve => (release = resolve));
  const reports = () => mcp.calls.filter(call => call.tool === 'sync_observability_view');
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Traces' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Traces' }));
  await waitFor(() => expect(mcp.view.version).toBe(3), POLL);
  fireEvent.click(await screen.findByText('weather-agent'));
  expect(await screen.findByRole('button', { name: 'Back to the list' })).toBeTruthy();
  await new Promise(resolve => setTimeout(resolve, 1_000));

  // Meanwhile the model shows all logs. The view applies that, then the first answer comes back.
  Object.assign(mcp.view, { version: 4, by: 'model', state: { tool: 'list_logs', args: {} } });
  expect(await screen.findByRole('tab', { name: 'Logs', selected: true }, POLL)).toBeTruthy();
  release();

  // The trace the user opened before the model's change never goes out against it: the view reports the logs.
  await waitFor(() => expect(reports().some(call => call.args.base === 4)).toBe(true), POLL);
  await new Promise(resolve => setTimeout(resolve, 1_000));
  for (const call of reports().filter(report => report.args.base >= 4)) {
    expect(call.args.state.args).toEqual({});
    expect(call.args.state.context).toContain("They're on its Logs tab.");
  }
}, 20_000);

it("doesn't let a poll answered after a report take the view back to an older version", async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true, logs: true });
  await openList(mcp, 'query_traces', { timeRange: lastHour() }, { meta: { 'mastra/viewId': 'view-1' } });
  expect(await screen.findByText('weather-agent')).toBeTruthy();
  Object.assign(mcp.view, { version: 1, by: 'model', state: { tool: 'list_logs', args: { level: 'error' } } });
  expect(await screen.findByRole('tab', { name: 'Logs', selected: true }, POLL)).toBeTruthy();
  await waitFor(() => expect(mcp.view.version).toBe(2), POLL);

  // A poll reads the view at version 2 but is slow to answer; the user's change lands meanwhile, at 3.
  let release!: () => void;
  mcp.view.pollsHeld = new Promise<void>(resolve => (release = resolve));
  const polls = mcp.view.polled!.length;
  await waitFor(() => expect(mcp.view.polled!.length).toBe(polls + 1), POLL);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Traces' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Traces' }));
  await waitFor(() => expect(mcp.view.version).toBe(3), POLL);
  await new Promise(resolve => setTimeout(resolve, 200));
  mcp.view.pollsHeld = undefined;
  release();

  // The user's next change goes out against 3, so the server takes it instead of refusing it as stale.
  await new Promise(resolve => setTimeout(resolve, 50));
  fireEvent.click(await screen.findByText('weather-agent'));
  await waitFor(() => expect(mcp.view.version).toBe(4), POLL);
  const last = mcp.calls.filter(call => call.tool === 'sync_observability_view').at(-1)!;
  expect(last.args.base).toBe(3);
  expect(mcp.view.state?.context).toBe(last.args.state.context);
}, 20_000);

it('keeps polling a new view when the one before it turns out gone', async () => {
  const mcp = observabilityExplorerServer({ traceQuery: true });
  const bridge = await openList(
    mcp,
    'query_traces',
    { timeRange: lastHour() },
    { meta: { 'mastra/viewId': 'view-1' } },
  );
  expect(await screen.findByText('weather-agent')).toBeTruthy();

  // A poll for view 1 is out when the model opens view 2 in the same app; then view 1 turns out gone.
  let release!: () => void;
  mcp.view.pollsHeld = new Promise<void>(resolve => (release = resolve));
  await waitFor(() => expect(mcp.view.polled).toContain('view-1'), POLL);
  const called = await hosts.at(-1)!.client.callTool({ name: 'query_traces', arguments: { timeRange: lastHour() } });
  await bridge.sendToolResult({ ...called, _meta: { 'mastra/viewId': 'view-2' } } as never);
  mcp.view.gone = 'view-1';
  mcp.view.pollsHeld = undefined;
  release();

  // View 1's answer doesn't stop view 2's polling.
  await waitFor(() => expect(mcp.view.polled!.filter(id => id === 'view-2').length).toBeGreaterThanOrEqual(2), POLL);
}, 20_000);
