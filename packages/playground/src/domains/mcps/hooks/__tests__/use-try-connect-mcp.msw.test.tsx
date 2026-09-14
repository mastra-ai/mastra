// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TRY_CONNECT_PROTOCOL_VERSION, useTryConnectMcp } from '../use-try-connect-mcp';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const MCP_URL = 'http://mcp.example.test/mcp';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL} headers={{ 'x-mastra-auth': 'studio-token' }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

interface CapturedRequest {
  headers: Record<string, string | null>;
  body: { method: string; params: { _meta: Record<string, unknown> } };
}

describe('useTryConnectMcp', () => {
  it('probes with a single self-contained 2026-07-28 tools/list request', async () => {
    const onRequest = vi.fn<(captured: CapturedRequest) => void>();
    server.use(
      http.post(MCP_URL, async ({ request }) => {
        onRequest({
          headers: {
            protocolVersion: request.headers.get('mcp-protocol-version'),
            method: request.headers.get('mcp-method'),
            auth: request.headers.get('x-mastra-auth'),
          },
          body: (await request.json()) as CapturedRequest['body'],
        });
        return HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          result: { tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object' } }] },
        });
      }),
    );

    const { result } = renderHook(() => useTryConnectMcp(), { wrapper: makeWrapper() });
    const outcome = await result.current.mutateAsync(MCP_URL);

    expect(outcome.tools.map(tool => tool.name)).toEqual(['echo']);
    expect(onRequest).toHaveBeenCalledTimes(1);
    const captured = onRequest.mock.calls[0][0];
    expect(captured.headers).toEqual({
      protocolVersion: TRY_CONNECT_PROTOCOL_VERSION,
      method: 'tools/list',
      auth: 'studio-token',
    });
    expect(captured.body.method).toBe('tools/list');
    expect(captured.body.params._meta['io.modelcontextprotocol/protocolVersion']).toBe(TRY_CONNECT_PROTOCOL_VERSION);
    expect(captured.body.params._meta).toHaveProperty('io.modelcontextprotocol/clientInfo');
    expect(captured.body.params._meta).toHaveProperty('io.modelcontextprotocol/clientCapabilities');
  });

  it('reads the response from a streamed reply, skipping leading notifications', async () => {
    server.use(
      http.post(MCP_URL, () => {
        const stream = [
          'event: message',
          `data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', data: 'hello' } })}`,
          '',
          'event: message',
          `data: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'streamed' }] } })}`,
          '',
        ].join('\n');
        return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const { result } = renderHook(() => useTryConnectMcp(), { wrapper: makeWrapper() });
    const outcome = await result.current.mutateAsync(MCP_URL);

    expect(outcome.tools.map(tool => tool.name)).toEqual(['streamed']);
  });

  it('surfaces a legacy-only server as a protocol failure instead of a passing probe', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.json(
          {
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32022, message: 'Unsupported protocol version: 2026-07-28' },
          },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useTryConnectMcp(), { wrapper: makeWrapper() });

    await expect(result.current.mutateAsync(MCP_URL)).rejects.toThrow(
      'tools/list failed: 400 Bad Request: Unsupported protocol version: 2026-07-28',
    );
  });

  it('surfaces JSON-RPC errors returned with a 200 status', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.json({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }),
      ),
    );

    const { result } = renderHook(() => useTryConnectMcp(), { wrapper: makeWrapper() });

    await expect(result.current.mutateAsync(MCP_URL)).rejects.toThrow('tools/list failed: Method not found');
  });
});
