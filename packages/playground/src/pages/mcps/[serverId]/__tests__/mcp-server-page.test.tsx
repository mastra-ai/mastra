import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { McpServerPage } from '../index';
import {
  emptyMcpTools,
  legacyMcpServer,
  mcpServerList,
  modernMcpServer,
  unknownEraMcpServer,
} from './fixtures/mcp-server';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderServer = (serverInfo: typeof modernMcpServer | typeof legacyMcpServer | typeof unknownEraMcpServer) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(mcpServerList(serverInfo))),
    http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(emptyMcpTools)),
  );

  window.MASTRA_SERVER_HOST = 'localhost';
  window.MASTRA_SERVER_PORT = '4111';

  return renderWithProviders(
    <Routes>
      <Route path="/mcps/:serverId" element={<McpServerPage />} />
    </Routes>,
    { router: { initialEntries: [`/mcps/${serverInfo.id}`] } },
  );
};

describe('MCP server detail page', () => {
  describe('when the registered server uses MCP 2026-07-28', () => {
    it('advertises Streamable HTTP', async () => {
      renderServer(modernMcpServer);

      expect(await screen.findByText('Streamable HTTP Endpoint')).not.toBeNull();
      expect(screen.getByText('This MCP server uses the current Streamable HTTP transport.')).not.toBeNull();
      expect(screen.getByText('http://localhost:4111/api/mcp/modern-server/mcp')).not.toBeNull();
    });

    it('does not advertise deprecated SSE connection options', async () => {
      renderServer(modernMcpServer);

      await screen.findByText('Streamable HTTP Endpoint');
      expect(screen.queryByText('Server-Sent Events')).toBeNull();
      expect(screen.queryByText(/mcp-remote/)).toBeNull();
    });
  });

  describe('when the registered server explicitly uses MCP 2025-11-25', () => {
    it('retains legacy SSE connection options', async () => {
      renderServer(legacyMcpServer);

      expect(await screen.findByText('Server-Sent Events')).not.toBeNull();
      expect(
        screen.getByText(
          'This MCP server can be accessed through multiple transport methods. Choose the one that best fits your use case.',
        ),
      ).not.toBeNull();
      expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/legacy-server/sse')).not.toBeNull();
    });
  });

  describe('when an older server does not report its protocol era', () => {
    it('retains legacy SSE connection options for compatibility', async () => {
      renderServer(unknownEraMcpServer);

      expect(await screen.findByText('Server-Sent Events')).not.toBeNull();
      expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/unknown-server/sse')).not.toBeNull();
    });
  });
});
