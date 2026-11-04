// @vitest-environment jsdom
import type { App } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { McpAppViewer } from '../mcp-app-viewer';
import type { McpAppViewerProps } from '../mcp-app-viewer';
import { connectApp, sandboxFrame } from './connect-app';

const SANDBOX_URL = new URL('http://sandbox.test/proxy.html');
const HTML = '<!DOCTYPE html><html><body>app</body></html>';

function viewer(props: Partial<McpAppViewerProps>) {
  return <McpAppViewer html={HTML} toolName="showDashboard" sandboxUrl={SANDBOX_URL} {...props} />;
}

async function renderApp(props: Partial<McpAppViewerProps> = {}, setup?: (app: App) => void) {
  const { container } = render(viewer(props));
  return connectApp(container, setup);
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

  it("hands the app's raw model context to onModelContext, next to the text for the chat", async () => {
    const onUpdateModelContext = vi.fn();
    const onModelContext = vi.fn();
    const app = await renderApp({ onUpdateModelContext, onModelContext });

    const params = {
      content: [{ type: 'text' as const, text: 'Pinned: Agent runs' }],
      structuredContent: { 'mastra.ai/dashboard-pinned-widgets': [{ widget: { id: 'agent-runs' } }] },
    };
    await app.updateModelContext(params);

    expect(onModelContext).toHaveBeenLastCalledWith(params);
    expect(onUpdateModelContext).toHaveBeenLastCalledWith(
      [
        'Context from the "showDashboard" MCP App shown in this conversation:',
        'Pinned: Agent runs',
        '{"mastra.ai/dashboard-pinned-widgets":[{"widget":{"id":"agent-runs"}}]}',
      ].join('\n'),
    );
  });

  it('accepts model context with only onModelContext, advertising structured content', async () => {
    const onModelContext = vi.fn();
    const app = await renderApp({ onModelContext });

    expect(app.getHostCapabilities()?.updateModelContext).toEqual({ text: {}, structuredContent: {} });
    await app.updateModelContext({ structuredContent: { drilldown: { page: 'traces' } } });
    expect(onModelContext).toHaveBeenLastCalledWith({ structuredContent: { drilldown: { page: 'traces' } } });
  });

  it('sends extra host-context keys to the app, and their changes to the running app', async () => {
    const { container, rerender } = render(viewer({ hostContext: { 'mastra.ai/pins': ['a'] } }));
    const { frame } = await sandboxFrame(container);
    const app = await connectApp(container);
    expect(app.getHostContext()).toMatchObject({ 'mastra.ai/pins': ['a'], theme: expect.any(String) });

    const changed = new Promise(resolve => app.addEventListener('hostcontextchanged', resolve));
    rerender(viewer({ hostContext: { 'mastra.ai/pins': ['a', 'b'] } }));

    expect(await changed).toEqual({ 'mastra.ai/pins': ['a', 'b'] });
    expect(app.getHostContext()).toMatchObject({ 'mastra.ai/pins': ['a', 'b'] });
    // Same sandbox and bridge: the app was not reloaded.
    expect(container.querySelector('iframe')).toBe(frame);
  });

  it("keeps the viewer's theme over a host-context theme", async () => {
    const app = await renderApp({ hostContext: { theme: 'not-a-theme' } });

    expect(app.getHostContext()?.theme).not.toBe('not-a-theme');
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
});
