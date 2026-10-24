// @vitest-environment jsdom
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeDataSource } from '../../data-source';
import { KnowledgeDataSourceProvider } from '../../data-source';
import type { KnowledgeActivityPayload, KnowledgeScopeNode, KnowledgeSearchPayload } from '../../types';
import { KnowledgeScopeFlyout } from '../KnowledgeScopeFlyout';
import { KnowledgeSearch } from '../KnowledgeSearch';

const scope: KnowledgeScopeNode = {
  id: 's1',
  address: 'resource:p1',
  name: 'Payments',
  parentIds: [],
  memberCount: 2,
  memberCountTruncated: false,
  contentNodeCount: 1,
  childScopeCount: 1,
};

const activity: KnowledgeActivityPayload = {
  events: [
    {
      id: 'e1',
      action: 'created',
      recordType: 'record',
      scope: ['resource:p1'],
      node: { id: 'n1', name: 'Refund policy', rung: 'resource' },
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const searchPayload: KnowledgeSearchPayload = {
  results: [{ id: 'n1', name: 'Refund policy', kind: 'topic', type: 'node', rung: 'resource' }],
  truncated: false,
};

// The host seam: real React Query hooks over fixtures, the way Factory and Studio wrap their routes.
function makeSource(overrides: Partial<KnowledgeDataSource> = {}): KnowledgeDataSource {
  return {
    useNode: () => useQuery({ queryKey: ['node'], queryFn: skipToken }),
    useActivity: () =>
      useInfiniteQuery({
        queryKey: ['activity'],
        queryFn: async () => activity,
        initialPageParam: undefined as string | undefined,
        getNextPageParam: () => undefined,
      }),
    useSearch: query =>
      useQuery({
        queryKey: ['search', query],
        queryFn: query.trim().length >= 2 ? async () => searchPayload : skipToken,
      }),
    ...overrides,
  };
}

describe('Knowledge components with a host data source', () => {
  it('shows the host-provided label and activity in the scope flyout', async () => {
    const source = makeSource({ displayAddress: address => address.replace('resource:', 'project:') });
    renderWithProviders(
      <KnowledgeDataSourceProvider value={source}>
        <KnowledgeScopeFlyout
          selection={{ scopeNodeId: 's1' }}
          scope={scope}
          childScopeCount={1}
          contentNodeCount={1}
          countsTruncated={false}
          onSelectActivity={() => {}}
          onClose={() => {}}
        />
      </KnowledgeDataSourceProvider>,
    );

    expect(screen.getByText('project:p1')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Refund policy' })).toBeTruthy();
  });

  it('falls back to the raw address when the host gives no label', () => {
    renderWithProviders(
      <KnowledgeDataSourceProvider value={makeSource()}>
        <KnowledgeScopeFlyout
          selection={{ scopeNodeId: 's1' }}
          scope={scope}
          childScopeCount={1}
          contentNodeCount={1}
          countsTruncated={false}
          onSelectActivity={() => {}}
          onClose={() => {}}
        />
      </KnowledgeDataSourceProvider>,
    );
    expect(screen.getByText('resource:p1')).toBeTruthy();
  });

  it('searches through the host and reports the chosen result', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <KnowledgeDataSourceProvider value={makeSource()}>
        <KnowledgeSearch onSelect={onSelect} />
      </KnowledgeDataSourceProvider>,
    );

    await userEvent.type(screen.getByRole('combobox'), 're');
    await userEvent.click(await screen.findByText('Refund policy'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(searchPayload.results[0]));
  });

  it('refuses to render outside a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderWithProviders(<KnowledgeSearch onSelect={() => {}} />)).toThrow(/KnowledgeDataSourceProvider/);
    error.mockRestore();
  });
});
