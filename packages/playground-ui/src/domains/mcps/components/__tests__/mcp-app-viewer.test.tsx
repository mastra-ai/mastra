// @vitest-environment jsdom
import { App } from '@modelcontextprotocol/ext-apps';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { McpAppViewer } from '../mcp-app-viewer';
import type { McpAppViewerProps } from '../mcp-app-viewer';

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
async function renderApp(props: Partial<McpAppViewerProps> = {}) {
  const { container } = render(
    <McpAppViewer html={HTML} toolName="showDashboard" sandboxUrl={SANDBOX_URL} {...props} />,
  );
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

  it('runs the tool the app asks for and returns its output as structured content', async () => {
    const onToolCall = vi.fn(async () => ({ status: 200, body: { value: 12 } }));
    const app = await renderApp({ onToolCall });

    const result = await app.callServerTool({
      name: 'mastraApi',
      arguments: { method: 'POST', path: '/observability/metrics/aggregate' },
    });

    expect(onToolCall).toHaveBeenCalledWith('mastraApi', { method: 'POST', path: '/observability/metrics/aggregate' });
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

  it('refuses model context when the chat has nowhere to put it', async () => {
    const app = await renderApp({ onSendMessage: vi.fn() });

    await expect(
      app.updateModelContext({ content: [{ type: 'text', text: 'The user drilled into traces.' }] }),
    ).rejects.toThrow('No handler for method: ui/update-model-context');
  });
});
