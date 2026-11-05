import { isValidationError } from '@mastra/core/tools';
import { InMemoryTransport, ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostCapabilities, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { z } from 'zod';
import { dashboardContract } from '../apps/dashboard-renderer/contract';
import { createMcpApp } from '../create-mcp-app';
import { defineMcpAppUi } from '../define-mcp-app-ui';
import type { mcpAppDataInputSchema } from '../reads';
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

/** The context the test host's tool returns; a tool result can carry it to the app. */
const hostContextSchema = z.object({ projectId: z.string().min(1).optional() });

// The host's server: the dashboard's real data tool, sending each read to MASTRA_SERVER.
const { tools } = createMcpApp({
  ui: defineMcpAppUi({ ...dashboardContract, html: '' }),
  tool: {
    id: 'showDashboard',
    description: 'Shows a dashboard',
    inputSchema: z.object({}),
    context: hostContextSchema,
    execute: () => ({}) as never,
  },
  prepareRequest: ({ path }) => ({ url: `${MASTRA_SERVER}${path}` }),
});
const serverDataTool = tools[dashboardContract.dataTool]!;

/** A data tool call the app made, as the tool's input schema parses it. */
export type DataToolCall = z.output<
  ReturnType<typeof mcpAppDataInputSchema<typeof dashboardContract.reads, typeof hostContextSchema>>
>;

async function relayToServer(
  name: string,
  args: Record<string, unknown> = {},
  hasDataTool: boolean,
): Promise<CallToolResult> {
  // Real hosts reject a tool their server doesn't have as a protocol error, not a tool result.
  if (!hasDataTool || name !== dashboardContract.dataTool) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown tool: ${name}`);
  }
  const result: unknown = await serverDataTool.execute!(args, {});
  if (isValidationError(result)) return { content: [{ type: 'text', text: result.message }], isError: true };
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
}

type HostOptions = {
  hostContext?: McpUiHostContext;
  capabilities?: McpUiHostCapabilities;
  /** Whether the host's server registered the data tool. */
  dataTool?: boolean;
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
    dataTool = true,
  }: HostOptions = {},
) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, capabilities, { hostContext });
  // The tool calls the app made, with the read each one carried.
  const toolCalls: Array<{ name: string; call?: DataToolCall }> = [];
  const messages: string[] = [];
  const modelContexts: unknown[] = [];
  // What the app asked of the host's chat, in order: a model context update or a message.
  const chat: Array<'context' | 'message'> = [];
  bridge.oncalltool = async ({ name, arguments: args }) => {
    const call = (serverDataTool.inputSchema as z.ZodType<DataToolCall>).safeParse(args);
    toolCalls.push({ name, ...(call.success && { call: call.data }) });
    return relayToServer(name, args, dataTool);
  };
  bridge.onupdatemodelcontext = async params => {
    chat.push('context');
    modelContexts.push(params);
    return {};
  };
  // Notifications outside the MCP Apps spec; apps should send none.
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
