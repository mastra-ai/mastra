// @vitest-environment jsdom
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeDataSource } from '../../data-source';
import { KnowledgeDataSourceProvider } from '../../data-source-provider';
import type {
  KnowledgeActivityPayload,
  KnowledgeNodePayload,
  KnowledgeScopeNode,
  KnowledgeSearchPayload,
} from '../../types';
import { KnowledgeFlyout } from '../KnowledgeFlyout';
import { KnowledgeScopeFlyout } from '../KnowledgeScopeFlyout';
import { KnowledgeSearch } from '../KnowledgeSearch';

const scope: KnowledgeScopeNode = {
  id: 's1',
  address: 'project:p1',
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

const nodePayload: KnowledgeNodePayload = {
  node: {
    id: 'n1',
    name: 'Refund policy',
    kind: 'topic',
    content: '',
    description: 'How refunds work',
    scope: ['org:o1', 'resource:p1'],
    rung: 'resource',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  records: [
    {
      id: 'r1',
      node: 'n1',
      relation: 'owned',
      text: 'Refunds are issued within 14 days.',
      scope: ['org:o1', 'resource:p1'],
      rung: 'resource',
      sourceThreadId: 't1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      pinned: false,
    },
  ],
};

const searchPayload: KnowledgeSearchPayload = {
  results: [{ id: 'n1', name: 'Refund policy', kind: 'topic', type: 'node', rung: 'resource' }],
  truncated: false,
};

// The host seam: real React Query hooks over fixtures, the way Factory and Studio wrap their routes.
function makeSource(): KnowledgeDataSource {
  return {
    useNode: (nodeId, scopeLevel) =>
      useQuery({ queryKey: ['node', nodeId, scopeLevel], queryFn: async () => nodePayload }),
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
  };
}

describe('Knowledge components with a host data source', () => {
  it("shows the scope address and the host's activity in the scope flyout", async () => {
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

    expect(screen.getByText('project:p1')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Refund policy' })).toBeTruthy();
  });

  it("renders the host's node and its record rows in the node flyout", async () => {
    renderWithProviders(
      <KnowledgeDataSourceProvider value={makeSource()}>
        <KnowledgeFlyout nodeId="n1" scopeLevel="resource" onClose={() => {}} />
      </KnowledgeDataSourceProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Refund policy' })).toBeTruthy();
    expect(screen.getByText('How refunds work')).toBeTruthy();
    expect(await screen.findByText(/Refunds are issued within 14 days/)).toBeTruthy();
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
