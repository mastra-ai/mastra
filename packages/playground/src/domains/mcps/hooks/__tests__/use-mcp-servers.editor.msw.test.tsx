import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, renderHookWithProviders, TEST_BASE_URL } from '@/test/render';
import { useMCPServerToolsById } from '../use-mcp-server-tools-by-id';
import { useMCPServers } from '../use-mcp-servers';
import { mcpServersResponse, mcpToolsResponse } from './fixtures/editor-mcps';

describe('when Studio users browse runtime MCP servers', () => {
  it('lists runtime MCP servers and loads their tools through real client-js routes', async () => {
    let serversUrl: URL | undefined;
    server.use(
      http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, ({ request }) => {
        serversUrl = new URL(request.url);
        return HttpResponse.json(mcpServersResponse);
      }),
      http.get(`${TEST_BASE_URL}/api/mcp/simple-mcp-server/tools`, () => HttpResponse.json(mcpToolsResponse)),
    );

    const { wrapper } = makeWrapper();
    const servers = renderHook(() => useMCPServers(), { wrapper });
    const tools = renderHook(() => useMCPServerToolsById('simple-mcp-server'), { wrapper });

    await waitFor(() => expect(servers.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(tools.result.current.isSuccess).toBe(true));

    expect(servers.result.current.data).toEqual(mcpServersResponse.servers);
    expect(tools.result.current.data?.['simple-mcp-server/weather']?.name).toBe('weather');
    expect(serversUrl?.pathname).toBe('/api/mcp/v0/servers');
  });

  it('does not load MCP server tools until a server id is available', async () => {
    const onTools = vi.fn();
    server.use(
      http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => {
        onTools();
        return HttpResponse.json(mcpToolsResponse);
      }),
    );

    const { result } = renderHookWithProviders(() => useMCPServerToolsById(null));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onTools).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
