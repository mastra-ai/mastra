import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { MCPDetail } from '../MCPDetail';
import { emptyToolList, legacyServer, v2Server } from './fixtures/mcp-servers';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const useToolsHandler = () => {
  server.use(http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(emptyToolList)));
};

const renderDetail = (detailServer: typeof legacyServer) =>
  renderWithProviders(
    <TestLinkProvider>
      <MCPDetail isLoading={false} server={detailServer} />
    </TestLinkProvider>,
  );

describe('MCPDetail transports', () => {
  it('shows the SSE endpoint for a legacy server', async () => {
    useToolsHandler();
    const { queryClient } = renderDetail(legacyServer);

    expect(screen.getByText('Server-Sent Events')).not.toBeNull();
    expect(screen.getByText('http://localhost:4111/api/mcp/legacy/sse')).not.toBeNull();
    expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/legacy/sse')).not.toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('offers only Streamable HTTP for an MCP v2 server', async () => {
    useToolsHandler();
    const { queryClient } = renderDetail(v2Server);

    expect(screen.getByText('http://localhost:4111/api/mcp/v2/mcp')).not.toBeNull();
    expect(screen.queryByText('Server-Sent Events')).toBeNull();
    expect(screen.queryByText(/\/api\/mcp\/v2\/sse/)).toBeNull();
    expect(screen.getByText('npx -y mcp-remote http://localhost:4111/api/mcp/v2/mcp')).not.toBeNull();

    await waitForMutationsIdle(queryClient);
  });
});
