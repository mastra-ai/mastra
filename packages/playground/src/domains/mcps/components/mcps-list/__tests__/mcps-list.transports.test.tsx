import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  emptyToolList,
  legacyServer,
  legacyServerWithoutTransports,
  v2Server,
} from '../../__tests__/fixtures/mcp-servers';
import { McpServersList } from '../mcps-list';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const useToolsHandler = () => {
  server.use(http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(emptyToolList)));
};

const renderList = (mcpServers: (typeof legacyServer)[]) =>
  renderWithProviders(
    <TestLinkProvider>
      <McpServersList mcpServers={mcpServers} isLoading={false} />
    </TestLinkProvider>,
  );

describe('McpServersList server URL', () => {
  describe('when a server reports Streamable HTTP only', () => {
    it('lists the /mcp endpoint', async () => {
      useToolsHandler();
      const { queryClient } = renderList([v2Server]);

      expect(screen.getByText(`${TEST_BASE_URL}/api/mcp/v2/mcp`)).not.toBeNull();
      expect(screen.queryByText(/\/api\/mcp\/v2\/sse/)).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when a server reports the SSE transport', () => {
    it('lists the /sse endpoint', async () => {
      useToolsHandler();
      const { queryClient } = renderList([legacyServer]);

      expect(screen.getByText(`${TEST_BASE_URL}/api/mcp/legacy/sse`)).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when a server omits transports', () => {
    it('lists the /sse endpoint', async () => {
      useToolsHandler();
      const { queryClient } = renderList([legacyServerWithoutTransports]);

      expect(screen.getByText(`${TEST_BASE_URL}/api/mcp/older/sse`)).not.toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });
});
