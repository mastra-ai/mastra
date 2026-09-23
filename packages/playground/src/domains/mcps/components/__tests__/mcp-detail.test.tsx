import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { MCPDetail } from '../MCPDetail';
import { emptyToolList, legacyServer, legacyServerWithoutTransports, v2Server } from './fixtures/mcp-servers';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const mockToolsHandler = () => {
  server.use(http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(emptyToolList)));
};

const renderDetail = (detailServer: typeof legacyServer) => {
  mockToolsHandler();
  return renderWithProviders(
    <TestLinkProvider>
      <MCPDetail isLoading={false} server={detailServer} />
    </TestLinkProvider>,
  );
};

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('MCPDetail connect card', () => {
  describe('when rendering an MCP v2 server', () => {
    it('shows the Connect title', async () => {
      const { queryClient } = renderDetail(v2Server);
      expect(screen.getByRole('heading', { name: 'Connect' })).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });

    it('shows the Streamable HTTP endpoint by default', async () => {
      const { queryClient } = renderDetail(v2Server);
      expect(screen.getByText('http://localhost:4111/api/mcp/v2/mcp')).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });

    it('does not offer an SSE tab', async () => {
      const { queryClient } = renderDetail(v2Server);
      expect(screen.queryByRole('tab', { name: 'SSE' })).toBeNull();
      await waitForMutationsIdle(queryClient);
    });

    it('points the CLI at the Streamable HTTP endpoint', async () => {
      const { queryClient } = renderDetail(v2Server);
      openTab('CLI');
      expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/v2/mcp')).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when rendering a legacy server', () => {
    it('shows the SSE endpoint in the SSE tab', async () => {
      const { queryClient } = renderDetail(legacyServer);
      openTab('SSE');
      expect(screen.getByText('http://localhost:4111/api/mcp/legacy/sse')).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });

    it('points the CLI at the SSE endpoint', async () => {
      const { queryClient } = renderDetail(legacyServer);
      openTab('CLI');
      expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/legacy/sse')).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when rendering a server that omits transports', () => {
    it('shows the SSE endpoint in the SSE tab', async () => {
      const { queryClient } = renderDetail(legacyServerWithoutTransports);
      openTab('SSE');
      expect(screen.getByText('http://localhost:4111/api/mcp/older/sse')).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });

    it('points the CLI at the SSE endpoint', async () => {
      const { queryClient } = renderDetail(legacyServerWithoutTransports);
      openTab('CLI');
      expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/older/sse')).not.toBeNull();
      await waitForMutationsIdle(queryClient);
    });
  });
});
