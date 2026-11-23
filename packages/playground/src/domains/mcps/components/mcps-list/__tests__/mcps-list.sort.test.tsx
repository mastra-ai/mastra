import type { McpServerListResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { McpServersList } from '../mcps-list';
import type { McpServersListProps } from '../mcps-list';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '@/test/render';

type McpServer = McpServerListResponse['servers'][number];

const mcpServers = [
  { id: 'server-c', name: 'Charlie' },
  { id: 'server-a', name: 'Alpha' },
  { id: 'server-b', name: 'Bravo' },
] as unknown as McpServer[];

const useToolsHandler = () => {
  server.use(http.get('*/api/mcp/:serverId/tools', () => HttpResponse.json({ tools: [] })));
};

const renderList = (props?: Partial<McpServersListProps>) =>
  renderWithProviders(
    <TestLinkProvider>
      <McpServersList mcpServers={mcpServers} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

const rowIds = () => interactiveRows().map(row => row.getAttribute('href')?.replace('/mcps/', ''));

describe('McpServersList', () => {
  describe('when sorted from the Name column', () => {
    it('reports the requested direction to the parent', async () => {
      useToolsHandler();
      const onSortChange = vi.fn();
      const { queryClient } = renderList({ onSortChange });

      fireEvent.click(screen.getByRole('button', { name: 'Name, not sorted, sort ascending' }));

      expect(onSortChange).toHaveBeenCalledWith('asc', 'name');
      await waitForMutationsIdle(queryClient);
    });

    it('orders servers A to Z when ascending', async () => {
      useToolsHandler();
      const { queryClient } = renderList({ sort: { key: 'name', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['server-a', 'server-b', 'server-c']);
      await waitForMutationsIdle(queryClient);
    });

    it('orders servers Z to A when descending', async () => {
      useToolsHandler();
      const { queryClient } = renderList({ sort: { key: 'name', direction: 'desc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['server-c', 'server-b', 'server-a']);
      await waitForMutationsIdle(queryClient);
    });
  });
});
