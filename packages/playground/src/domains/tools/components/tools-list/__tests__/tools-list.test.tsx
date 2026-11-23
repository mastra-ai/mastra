import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ToolsList } from '../tools-list';
import type { ToolsListProps } from '../tools-list';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const tools = {
  'weather-tool': { id: 'weather-tool', description: 'Gets the weather' },
  'search-tool': { id: 'search-tool', description: 'Searches the web' },
  'math-tool': { id: 'math-tool', description: 'Does math' },
} as unknown as Record<string, GetToolResponse>;

const agents = {
  a1: { id: 'a1', name: 'A1', tools: { 'math-tool': tools['math-tool'], 'search-tool': tools['search-tool'] } },
  a2: { id: 'a2', name: 'A2', tools: { 'math-tool': tools['math-tool'] } },
} as unknown as Record<string, GetAgentResponse>;

const renderList = (props?: Partial<ToolsListProps>) =>
  renderWithProviders(
    <TestLinkProvider>
      <ToolsList tools={tools} agents={agents} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

const rowIds = () => interactiveRows().map(row => row.getAttribute('href')?.replace('/tools/', ''));

describe('ToolsList', () => {
  describe('when sorted from the Name column', () => {
    it('reports the requested direction to the parent', () => {
      const onSortChange = vi.fn();
      renderList({ onSortChange });

      fireEvent.click(screen.getByRole('button', { name: 'Name, not sorted, sort ascending' }));

      expect(onSortChange).toHaveBeenCalledWith('asc', 'name');
    });

    it('orders tools A to Z', () => {
      renderList({ sort: { key: 'name', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['math-tool', 'search-tool', 'weather-tool']);
      expect(screen.getByRole('button', { name: 'Name, sorted ascending, sort descending' })).not.toBeNull();
    });
  });

  describe('when sorted from the Agents column', () => {
    it('puts the most-attached tool first when descending', () => {
      renderList({ sort: { key: 'agents', direction: 'desc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['math-tool', 'search-tool', 'weather-tool']);
    });
  });
});
