import { InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostCapabilities, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MASTRA_API_TOOL, mastraApiRequestSchema } from '../mastra-api-protocol';
import type { McpAppDefinition } from '../runtime/define-mcp-app';

/** Where the test host's server answers `mastraApi` calls; MSW handlers mock its routes. */
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

/** Answers `mastraApi` the way the server's tool does: by calling the route and returning its response. */
async function relayToServer(args: unknown): Promise<CallToolResult> {
  const { method, path, body } = mastraApiRequestSchema.parse(args);
  const response = await fetch(`${MASTRA_SERVER}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
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
 * server and accepts chat messages, unless `capabilities` says otherwise. Resolves once the app
 * has started, with the messages a host sends it and what the app asked of the host.
 */
export async function renderWithHost<Input>(
  definition: McpAppDefinition<Input>,
  { hostContext = {}, capabilities = { serverTools: {}, message: {} } }: HostOptions = {},
) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, capabilities, { hostContext });
  const toolCalls: string[] = [];
  const messages: string[] = [];
  bridge.oncalltool = async ({ name, arguments: args }) => {
    toolCalls.push(name);
    if (name !== MASTRA_API_TOOL) return { isError: true, content: [{ type: 'text', text: `Unknown tool ${name}` }] };
    return relayToServer(args);
  };
  bridge.onmessage = async ({ content }) => {
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
    toolCalls,
    messages,
    sendToolResult: (params: Parameters<AppBridge['sendToolResult']>[0]) => act(() => bridge.sendToolResult(params)),
    sendToolCancelled: () => act(() => bridge.sendToolCancelled({})),
    setHostContext: (context: McpUiHostContext) =>
      act(async () => {
        bridge.setHostContext(context);
      }),
  };
}
