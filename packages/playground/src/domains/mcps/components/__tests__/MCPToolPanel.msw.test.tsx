// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MCPToolPanel } from '../MCPToolPanel';
import { contextTool } from './fixtures/request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const requests = vi.fn();
  localStorage.setItem('mastra:request-context:mcp:server:context-tool', JSON.stringify({ locale: 'fr' }));
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/mcp/server/tools/context-tool`, () => HttpResponse.json(contextTool)),
    http.post(`${BASE_URL}/api/mcp/server/resources/read`, () =>
      HttpResponse.json({ contents: [{ uri: 'ui://context', text: '<html><body>Context app</body></html>' }] }),
    ),
    http.post(`${BASE_URL}/api/mcp/server/tools/context-tool/execute`, async ({ request }) => {
      requests(await request.json());
      return HttpResponse.json({ content: [{ type: 'text', text: 'Executed' }] });
    }),
  );
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <MCPToolPanel serverId="server" toolId="context-tool" />
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return requests;
}

async function connectApp() {
  await screen.findByRole('button', { name: 'Submit' });
  await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
  const frame = document.querySelector('iframe');
  const send = (data: unknown) =>
    window.dispatchEvent(new MessageEvent('message', { data, source: frame?.contentWindow }));
  await act(async () => {
    send({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} });
    await new Promise(resolve => setTimeout(resolve, 50));
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'ui/initialize',
      params: { protocolVersion: '2026-01-26', appInfo: { name: 'test', version: '1' }, appCapabilities: {} },
    });
    send({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
  });
  return async () => {
    await act(async () => {
      send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'context-tool', arguments: {} } });
    });
  };
}

async function saveContext() {
  fireEvent.click(await screen.findByTestId('tool-run-options-trigger'));
  await screen.findByText('Request Context (JSON)');
  const editor = document.querySelector('.cm-content[contenteditable="true"]');
  if (!editor) throw new Error('Request context editor not found');
  fireEvent.input(editor, { target: { textContent: '{"locale":"en"}' } });
  const save = screen.getByRole('button', { name: 'Save' });
  await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false));
  fireEvent.click(save);
  await waitFor(() =>
    expect(localStorage.getItem('mastra:request-context:mcp:server:context-tool')).toBe('{"locale":"en"}'),
  );
}

describe('MCPToolPanel', () => {
  describe('when request context is saved without remounting', () => {
    it('uses the updated context in App bridge executions', async () => {
      const requests = setup();
      const callTool = await connectApp();
      await saveContext();
      await callTool();
      await waitFor(() => expect(requests).toHaveBeenCalledWith({ data: {}, requestContext: { locale: 'en' } }));
    });
    it('uses the updated context in form executions', async () => {
      const requests = setup();
      await saveContext();
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(requests).toHaveBeenCalledWith({ data: {}, requestContext: { locale: 'en' } }));
    });
  });
  describe('when the tool has saved request context', () => {
    it('includes it in form executions', async () => {
      const requests = setup();
      fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(requests).toHaveBeenCalledWith({ data: {}, requestContext: { locale: 'fr' } }));
    });
    it('includes it in App bridge executions', async () => {
      const requests = setup();
      const callTool = await connectApp();
      await callTool();
      await waitFor(() => expect(requests).toHaveBeenCalledWith({ data: {}, requestContext: { locale: 'fr' } }));
    });
  });
});
