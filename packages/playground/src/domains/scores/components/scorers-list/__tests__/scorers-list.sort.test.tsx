import type { GetScorerResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScorersList } from '../scorers-list';
import type { ScorersListProps } from '../scorers-list';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const scorer = (name: string, source: 'code' | 'stored', agentIds: string[] = []): GetScorerResponse =>
  ({
    scorer: { config: { id: name, name, description: `${name} description` } },
    source,
    agentIds,
    workflowIds: [],
  }) as unknown as GetScorerResponse;

const scorers = {
  'scorer-c': scorer('Charlie', 'stored', ['a1']),
  'scorer-a': scorer('Alpha', 'code'),
  'scorer-b': scorer('Bravo', 'code', ['a1', 'a2']),
};

const renderList = (props?: Partial<ScorersListProps>) =>
  renderWithProviders(
    <TestLinkProvider>
      <ScorersList scorers={scorers} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

const rowIds = () => interactiveRows().map(row => row.getAttribute('href')?.replace('/scorers/', ''));

describe('ScorersList', () => {
  describe('when sorted from the Name column', () => {
    it('reports the requested direction to the parent', () => {
      const onSortChange = vi.fn();
      renderList({ onSortChange });

      fireEvent.click(screen.getByRole('button', { name: 'Name, not sorted, sort ascending' }));

      expect(onSortChange).toHaveBeenCalledWith('asc', 'name');
    });

    it('orders scorers A to Z', () => {
      renderList({ sort: { key: 'name', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['scorer-a', 'scorer-b', 'scorer-c']);
    });
  });

  describe('when sorted from the Source column', () => {
    it('groups code scorers before stored ones when ascending', () => {
      renderList({ sort: { key: 'source', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['scorer-a', 'scorer-b', 'scorer-c']);
    });
  });

  describe('when sorted from the Agents column', () => {
    it('puts the most-attached scorer first when descending', () => {
      renderList({ sort: { key: 'agents', direction: 'desc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['scorer-b', 'scorer-c', 'scorer-a']);
    });
  });
});
