import { InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostCapabilities, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  DASHBOARD_DATA_REQUESTS,
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataInputSchema,
} from '../apps/dashboard-renderer/data';
import type { DashboardDataInput } from '../apps/dashboard-renderer/data';
import type { McpAppDefinition } from '../runtime/define-mcp-app';

/** Where the test host's Mastra server answers the dashboard's reads; MSW handlers mock its routes. */
export const MASTRA_SERVER = 'http://mastra.test/api';

const connections = new Set<{ app: App; bridge: AppBridge }>();

afterEach(async () => {
  // Unmount first so nothing renders over a closed connection.
  cleanup();
  await Promise.all([...connections].flatMap(({ app, bridge }) => [app.close(), bridge.close()]));
  connections.clear();
  document.documentElement.classList.remove('light');
});

const once = (bridge: AppBridge, event: 'initialized' | 'sizechange') =>
  new Promise<void>(resolve => bridge.addEventListener(event, () => resolve()));

/** Answers the data tool the way a Mastra server does: by calling the operation's route. */
async function relayToServer(name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  if (name !== DASHBOARD_DATA_TOOL_NAME) {
    return { isError: true, content: [{ type: 'text', text: `Unknown tool ${name}` }] };
  }
  const call = dashboardDataInputSchema.parse(args);
  const [method, path] = DASHBOARD_DATA_REQUESTS[call.operation].split(' ');
  const url = new URL(`${MASTRA_SERVER}${path}`);
  for (const [key, value] of Object.entries(call.query ?? {})) {
    for (const item of [value].flat()) url.searchParams.append(key, item);
  }
  const response = await fetch(url, {
    method,
    ...(call.body && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(call.body) }),
  });
  const structuredContent = { status: response.status, body: await response.json() };
  return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
}

type HostOptions = {
  hostContext?: McpUiHostContext;
  capabilities?: McpUiHostCapabilities;
};

/**
 * Renders `app` as its iframe entry does, connected over an in-memory transport to an
 * `AppBridge`: the same host side real MCP clients embed. The host relays tool calls to its
 * server and accepts chat messages and model context, unless `capabilities` says otherwise. Resolves once the app
 * has started, with the messages a host sends it and what the app asked of the host.
 */
export async function renderWithHost<Input>(
  definition: McpAppDefinition<Input>,
  {
    hostContext = {},
    capabilities = { serverTools: {}, message: {}, updateModelContext: { text: {}, structuredContent: {} } },
  }: HostOptions = {},
) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, capabilities, { hostContext });
  // The tool calls the app made, with the read each one carried.
  const toolCalls: Array<{ name: string; call?: DashboardDataInput }> = [];
  const messages: string[] = [];
  const modelContexts: unknown[] = [];
  // What the app asked of the host's chat, in order: a model context update or a message.
  const chat: Array<'context' | 'message'> = [];
  bridge.oncalltool = async ({ name, arguments: args }) => {
    const call = dashboardDataInputSchema.safeParse(args);
    toolCalls.push({ name, ...(call.success && { call: call.data }) });
    return relayToServer(name, args);
  };
  bridge.onupdatemodelcontext = async params => {
    chat.push('context');
    modelContexts.push(params);
    return {};
  };
  // Notifications outside the MCP Apps spec, e.g. the dashboard's pin requests.
  const notifications: Array<{ method: string; params?: unknown }> = [];
  bridge.fallbackNotificationHandler = async ({ method, params }) => {
    notifications.push({ method, params });
  };
  bridge.onmessage = async ({ content }) => {
    chat.push('message');
    messages.push(content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('\n'));
    return {};
  };

  const app = new App({ name: definition.name, version: '1.0.0' });
  connections.add({ app, bridge });
  // The app reports its size a frame after the handshake; that report ends its startup.
  const started = Promise.all([once(bridge, 'initialized'), once(bridge, 'sizechange')]);
  await bridge.connect(hostTransport);

  const session = definition.createSession(app);
  render(<definition.View session={session} />);
  await act(() => session.connect(appTransport));
  await act(() => started);

  return {
    bridge,
    toolCalls,
    messages,
    modelContexts,
    chat,
    notifications,
    sendToolResult: (params: Parameters<AppBridge['sendToolResult']>[0]) => act(() => bridge.sendToolResult(params)),
    sendToolCancelled: () => act(() => bridge.sendToolCancelled({})),
    setHostContext: (context: McpUiHostContext) =>
      act(async () => {
        bridge.setHostContext(context);
      }),
  };
}
