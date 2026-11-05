// @vitest-environment jsdom
import type { McpServerToolListResponse } from '@mastra/client-js';
import { App } from '@modelcontextprotocol/ext-apps';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMcpAppToolCall } from '../../hooks/use-mcp-app-tool-call';
import { McpAppViewer } from '../mcp-app-viewer';
import type { McpAppViewerProps } from '../mcp-app-viewer';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '@/test/render';

type AppTransport = Parameters<App['connect']>[0];

const SANDBOX_URL = new URL('http://sandbox.test/proxy.html');
const HTML = '<!DOCTYPE html><html><body>app</body></html>';

const apps = new Set<App>();

afterEach(async () => {
  await Promise.all([...apps].map(app => app.close()));
  apps.clear();
});

/**
 * Renders the viewer and connects a real MCP App to it, standing in for the sandbox proxy page
 * it loads: the proxy announces itself, then relays JSON-RPC between the viewer and the app.
 */
async function renderApp(
  props: Partial<McpAppViewerProps> = {},
  setup?: (app: App) => void,
  viewer: ReactElement = <McpAppViewer html={HTML} toolName="showDashboard" sandboxUrl={SANDBOX_URL} {...props} />,
) {
  const { container } = renderWithProviders(viewer);
  const frame = await waitFor(() => {
    const contentWindow = container.querySelector('iframe')?.contentWindow;
    if (!contentWindow) throw new Error('sandbox iframe not mounted yet');
    return contentWindow;
  });

  // The viewer only accepts messages coming from its sandbox iframe.
  const fromSandbox = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, source: frame }));
  const onHostMessage = (event: MessageEvent) => transport.onmessage?.(event.data);
  const transport: AppTransport = {
    async start() {
      frame.addEventListener('message', onHostMessage);
    },
    async send(message) {
      // Like a real postMessage, deliver on a later task, once the viewer is listening.
      setTimeout(() => fromSandbox(message));
    },
    async close() {
      frame.removeEventListener('message', onHostMessage);
      transport.onclose?.();
    },
  };

  fromSandbox({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} });
  const app = new App({ name: 'test-app', version: '1.0.0' }, {}, { autoResize: false });
  apps.add(app);
  setup?.(app);
  await app.connect(transport);
  return app;
}

describe('McpAppViewer', () => {
  it('tells the app only about the host features it was given handlers for', async () => {
    const app = await renderApp({ onToolCall: vi.fn() });

    const capabilities = app.getHostCapabilities();
    expect(capabilities).toMatchObject({ openLinks: {}, serverTools: {} });
    expect(capabilities).not.toHaveProperty('message');
    expect(capabilities).not.toHaveProperty('updateModelContext');
  });

  it('tells the app it can post messages and update model context when the chat handles them', async () => {
    const app = await renderApp({ onToolCall: vi.fn(), onSendMessage: vi.fn(), onUpdateModelContext: vi.fn() });

    expect(app.getHostCapabilities()).toMatchObject({
      serverTools: {},
      message: {},
      updateModelContext: { text: {}, structuredContent: {} },
    });
  });

  it("hands the app the tool's structured output, with its JSON as the text fallback", async () => {
    const output = { definition: { widgets: [] }, scope: 'project' };
    const received = new Promise<CallToolResult>(resolve => {
      void renderApp({ toolResult: output }, app => {
        app.ontoolresult = resolve;
      });
    });

    expect(await received).toEqual({
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output,
    });
  });

  it('hands the app plain-text tool output as text only', async () => {
    const received = new Promise<CallToolResult>(resolve => {
      void renderApp({ toolResult: 'done' }, app => {
        app.ontoolresult = resolve;
      });
    });

    expect(await received).toEqual({ content: [{ type: 'text', text: 'done' }] });
  });

  it('runs the tool the app asks for and returns its output as structured content', async () => {
    const onToolCall = vi.fn(async () => ({ status: 200, body: { value: 12 } }));
    const app = await renderApp({ onToolCall });

    const result = await app.callServerTool({
      name: 'observabilityMetricAggregate',
      arguments: { name: ['mastra_agent_duration_ms'], aggregation: 'count' },
    });

    expect(onToolCall).toHaveBeenCalledWith('observabilityMetricAggregate', {
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
    });
    expect(result.structuredContent).toEqual({ status: 200, body: { value: 12 } });
  });

  it("posts the app's message to the chat", async () => {
    const onSendMessage = vi.fn();
    const app = await renderApp({ onSendMessage });

    await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Show me the traces' }] });

    expect(onSendMessage).toHaveBeenCalledWith('Show me the traces');
  });

  it("hands the app's model context to the chat as text labelled with the app, and clears it", async () => {
    const onUpdateModelContext = vi.fn();
    const app = await renderApp({ onUpdateModelContext });

    await app.updateModelContext({
      content: [{ type: 'text', text: 'The user drilled into traces.' }],
      structuredContent: { drilldown: { page: 'traces', timeRange: '7d' } },
    });
    expect(onUpdateModelContext).toHaveBeenLastCalledWith(
      [
        'Context from the "showDashboard" MCP App shown in this conversation:',
        'The user drilled into traces.',
        '{"drilldown":{"page":"traces","timeRange":"7d"}}',
      ].join('\n'),
    );

    await app.updateModelContext({});
    expect(onUpdateModelContext).toHaveBeenLastCalledWith(undefined);
  });

  it('opens web links the app asks for in a new tab, without giving the page a handle on Studio', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const app = await renderApp();

    await app.openLink({ url: 'https://mastra.ai/docs' });

    expect(open).toHaveBeenCalledWith('https://mastra.ai/docs', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('refuses links that would run code or read local files instead of opening a web page', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const app = await renderApp();

    for (const url of [
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'not a url',
    ]) {
      await expect(app.openLink({ url })).rejects.toThrow(/only opens http/);
    }
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('refuses model context when the chat has nowhere to put it', async () => {
    const app = await renderApp({ onSendMessage: vi.fn() });

    await expect(
      app.updateModelContext({ content: [{ type: 'text', text: 'The user drilled into traces.' }] }),
    ).rejects.toThrow('No handler for method: ui/update-model-context');
  });

  describe("when Studio relays an app's tool call to the app's MCP server", () => {
    /** The viewer as Studio mounts it: tool calls go to the server through Studio's API. */
    function StudioViewer({ serverId }: { serverId: string }) {
      const onToolCall = useMcpAppToolCall(serverId);
      return <McpAppViewer html={HTML} toolName="showDashboard" sandboxUrl={SANDBOX_URL} onToolCall={onToolCall} />;
    }

    function serveTools(tools: McpServerToolListResponse['tools']) {
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/apps/tools`, () => HttpResponse.json<McpServerToolListResponse>({ tools })),
      );
    }

    it("refuses a tool the server doesn't have with invalid params, as MCP servers do", async () => {
      serveTools([]);
      const app = await renderApp({}, undefined, <StudioViewer serverId="apps" />);

      await expect(app.callServerTool({ name: 'dashboardDataTool', arguments: {} })).rejects.toMatchObject({
        code: ErrorCode.InvalidParams,
        message: expect.stringContaining('isn\'t available to apps on MCP server "apps"'),
      });
    });

    it('refuses a tool the server keeps for the model the same way', async () => {
      serveTools([
        {
          name: 'dashboardDataTool',
          description: 'Reads data',
          inputSchema: { type: 'object' },
          _meta: { ui: { visibility: ['model'] } },
        },
      ]);
      const app = await renderApp({}, undefined, <StudioViewer serverId="apps" />);

      await expect(app.callServerTool({ name: 'dashboardDataTool', arguments: {} })).rejects.toMatchObject({
        code: ErrorCode.InvalidParams,
      });
    });
  });
});
