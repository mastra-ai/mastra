import type { McpServerListResponse } from '@mastra/client-js';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { McpServersList } from '../mcps-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '@/test/render';

type McpServer = McpServerListResponse['servers'][number];

const mcpServers = [
  { id: 'server-a', name: 'Server A' },
  { id: 'server-b', name: 'Server B' },
  { id: 'server-c', name: 'Server C' },
] as unknown as McpServer[];

const useToolsHandler = () => {
  server.use(http.get('*/api/mcp/:serverId/tools', () => HttpResponse.json({ tools: [] })));
};

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <McpServersList mcpServers={mcpServers} isLoading={false} />
    </TestLinkProvider>,
  );

describe('McpServersList keyboard navigation', () => {
  it('applies a roving tabindex to server rows', async () => {
    useToolsHandler();
    const { queryClient } = renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);

    await waitForMutationsIdle(queryClient);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', async () => {
    useToolsHandler();
    const { queryClient } = renderList();

    expectArrowNavigation(interactiveRows());

    await waitForMutationsIdle(queryClient);
  });

  it('keeps row links navigable (href preserved on the focus target)', async () => {
    useToolsHandler();
    const { queryClient } = renderList();

    expect(interactiveRows().map(row => row.getAttribute('href'))).toEqual([
      '/mcps/server-a',
      '/mcps/server-b',
      '/mcps/server-c',
    ]);

    await waitForMutationsIdle(queryClient);
  });
});
