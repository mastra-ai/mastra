// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useMcpAppTools } from '../use-mcp-app-tools';
import { useMCPServerToolsById } from '../use-mcp-server-tools-by-id';
import { useMCPServers } from '../use-mcp-servers';
import { useTryConnectMcp } from '../use-try-connect-mcp';
import { mcpServersResponse, weatherToolsResponse } from './fixtures/mcp';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '@/test/render';

const SERVERS_URL = `${TEST_BASE_URL}/api/mcp/v0/servers`;
const TOOLS_URL = `${TEST_BASE_URL}/api/mcp/weather-server/tools`;

describe('useMCPServers', () => {
  describe('when the server lists MCP servers', () => {
    it('returns the servers', async () => {
      server.use(http.get(SERVERS_URL, () => HttpResponse.json(mcpServersResponse)));

      const { result } = renderHookWithProviders(() => useMCPServers());

      await waitFor(() => expect(result.current.data?.map(s => s.id)).toEqual(['weather-server']));
    });
  });
});

describe('useMCPServerToolsById', () => {
  describe('when a server id is given', () => {
    it('returns the tools keyed by name', async () => {
      server.use(http.get(TOOLS_URL, () => HttpResponse.json(weatherToolsResponse)));

      const { result } = renderHookWithProviders(() => useMCPServerToolsById('weather-server'));

      await waitFor(() => expect(Object.keys(result.current.data ?? {})).toEqual(['getForecast', 'showMap']));
    });
  });

  describe('when no server id is given', () => {
    it('does not fetch', () => {
      const { result } = renderHookWithProviders(() => useMCPServerToolsById(null));

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useMcpAppTools', () => {
  describe('when a tool declares an MCP App UI', () => {
    it('maps the namespaced tool name to its resource', async () => {
      server.use(
        http.get(SERVERS_URL, () => HttpResponse.json(mcpServersResponse)),
        http.get(TOOLS_URL, () => HttpResponse.json(weatherToolsResponse)),
      );

      const { result } = renderHookWithProviders(() => useMcpAppTools());

      await waitFor(() =>
        expect(result.current.data?.['weather-server_showMap']?.resourceUri).toBe('ui://weather/map'),
      );
    });
  });
});

describe('useTryConnectMcp', () => {
  describe('when the remote MCP server responds', () => {
    it('returns the listed tools', async () => {
      const remoteUrl = 'http://remote-mcp.test/mcp';
      server.use(
        http.post(remoteUrl, async ({ request }) => {
          const body = (await request.json()) as { id?: number; method: string };
          if (body.method === 'tools/list') {
            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'echo' }] } });
          }
          return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
        }),
      );

      const { result } = renderHookWithProviders(() => useTryConnectMcp());

      let tools: unknown;
      await act(async () => {
        tools = (await result.current.mutateAsync(remoteUrl)).tools;
      });

      expect(tools).toEqual([{ name: 'echo' }]);
    });
  });
});
