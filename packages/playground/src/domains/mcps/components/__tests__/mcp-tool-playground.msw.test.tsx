import { App } from '@modelcontextprotocol/ext-apps';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { McpToolPlayground } from '../mcp-tool-playground';
import { authDisabled, dashboardAppResource, dashboardServerTools, dashboardTool } from './fixtures/mcp-servers';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type AppTransport = Parameters<App['connect']>[0];

const SERVER_URL = `${TEST_BASE_URL}/api/mcp/v2`;

const apps = new Set<App>();

beforeAll(() => {
  // jsdom has no blob URLs; the viewer only needs one to point its sandbox iframe at.
  URL.createObjectURL ??= () => 'blob:http://localhost/sandbox-proxy';
});

afterEach(async () => {
  await Promise.all([...apps].map(app => app.close()));
  apps.clear();
});

/** Renders the playground and connects a real MCP App in place of the sandbox page its viewer loads. */
async function renderPlaygroundApp() {
  const { container } = renderWithProviders(<McpToolPlayground serverId="v2" tool={dashboardTool} />);
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
      setTimeout(() => fromSandbox(message));
    },
    async close() {
      frame.removeEventListener('message', onHostMessage);
      transport.onclose?.();
    },
  };

  fromSandbox({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} });
  const app = new App({ name: 'dashboard', version: '1.0.0' }, {}, { autoResize: false });
  apps.add(app);
  await app.connect(transport);
  return app;
}

function serveDashboardApp() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
    http.post(`${SERVER_URL}/resources/read`, () => HttpResponse.json(dashboardAppResource)),
    http.get(`${SERVER_URL}/tools`, () => HttpResponse.json(dashboardServerTools)),
  );
}

describe('McpToolPlayground', () => {
  describe('when the app calls another app-visible tool on its server', () => {
    it('runs the tool the app asked for and hands it the unwrapped output', async () => {
      const onRelay = vi.fn<(body: unknown) => void>();
      serveDashboardApp();
      server.use(
        // Any call to the viewed tool would hit MSW's unhandled-request error instead.
        http.post(`${SERVER_URL}/tools/observabilityMetricAggregate/execute`, async ({ request }) => {
          onRelay(await request.json());
          return HttpResponse.json({ result: { status: 200, body: { value: 12 } } });
        }),
      );
      const app = await renderPlaygroundApp();

      const result = await app.callServerTool({
        name: 'observabilityMetricAggregate',
        arguments: { name: ['mastra_agent_duration_ms'], aggregation: 'count' },
      });

      expect(onRelay).toHaveBeenCalledWith({ data: { name: ['mastra_agent_duration_ms'], aggregation: 'count' } });
      expect(result.structuredContent).toEqual({ status: 200, body: { value: 12 } });
    });
  });

  describe('when the app calls a tool its server keeps for the model', () => {
    it('refuses the call without running the tool', async () => {
      const onExecute = vi.fn();
      serveDashboardApp();
      server.use(
        http.post(`${SERVER_URL}/tools/deleteTraces/execute`, () => {
          onExecute();
          return HttpResponse.json({ result: 'deleted' });
        }),
      );
      const app = await renderPlaygroundApp();

      await expect(app.callServerTool({ name: 'deleteTraces', arguments: {} })).rejects.toThrow(
        /isn't available to apps/,
      );
      expect(onExecute).not.toHaveBeenCalled();
    });
  });
});
