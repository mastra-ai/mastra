// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '../../../test/render';
import { useMcpAppTools } from '../use-mcp-app-tools';
import { useExecuteMCPTool, useMCPServerTool } from '../use-mcp-server-tool';
import { useMCPServerTools } from '../use-mcp-server-tools';
import { useMCPServerToolsById } from '../use-mcp-server-tools-by-id';
import { useMCPServers } from '../use-mcp-servers';
import { useTryConnectMcp } from '../use-try-connect-mcp';
import { mcpServersResponse, weatherToolsResponse } from './fixtures/mcp';

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

describe('useMCPServerTools', () => {
  describe('when a server is selected', () => {
    it('returns the tools keyed by name', async () => {
      server.use(http.get(TOOLS_URL, () => HttpResponse.json(weatherToolsResponse)));

      const { result } = renderHookWithProviders(() =>
        useMCPServerTools({
          id: 'weather-server',
          name: 'Weather Server',
          version_detail: mcpServersResponse.servers[0].version_detail,
        }),
      );

      await waitFor(() => expect(result.current.data?.getForecast?.description).toBe('Get the forecast'));
    });
  });
});

describe('useMCPServerTool', () => {
  describe('when the tool exists', () => {
    it('returns the tool details', async () => {
      server.use(http.get(`${TOOLS_URL}/getForecast`, () => HttpResponse.json(weatherToolsResponse.tools[0])));

      const { result } = renderHookWithProviders(() => useMCPServerTool('weather-server', 'getForecast'));

      await waitFor(() => expect(result.current.data?.name).toBe('getForecast'));
    });
  });
});

describe('useExecuteMCPTool', () => {
  describe('when the tool runs', () => {
    it('returns the tool result', async () => {
      server.use(
        http.post(`${TOOLS_URL}/getForecast/execute`, () => HttpResponse.json({ result: { forecast: 'sunny' } })),
      );

      const { result } = renderHookWithProviders(() => useExecuteMCPTool('weather-server', 'getForecast'));

      let response: unknown;
      await act(async () => {
        response = await result.current.mutateAsync({ data: { city: 'Paris' } });
      });

      expect(response).toEqual({ result: { forecast: 'sunny' } });
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
