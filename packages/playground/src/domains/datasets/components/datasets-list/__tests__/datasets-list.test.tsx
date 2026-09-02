import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatasetsList } from '../datasets-list';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const dataset = (id: string, name: string): DatasetRecord => ({
  id,
  name,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

const experiment = (id: string, datasetId: string): DatasetExperiment => ({
  id,
  datasetId,
  datasetVersion: 1,
  targetType: 'agent',
  targetId: 'agent-1',
  status: 'completed',
  totalItems: 1,
  processedItems: 1,
  errorCount: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
});

const datasets = [dataset('ds-a', 'Dataset A'), dataset('ds-b', 'Dataset B')];
const experiments = [experiment('exp-1', 'ds-a'), experiment('exp-2', 'ds-a')];

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <DatasetsList datasets={datasets} experiments={experiments} isLoading={false} />
    </TestLinkProvider>,
  );

describe('DatasetsList', () => {
  it('does not render a Review column', () => {
    renderList();
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('links the experiments action to the global experiments page filtered by dataset', () => {
    renderList();
    const link = screen.getByRole('link', { name: /2 \(100%\)/ });
    expect(link.getAttribute('href')).toBe('/experiments?dataset=ds-a');
  });

  it('does not render an experiments action for datasets without experiments', () => {
    renderList();
    expect(screen.queryByRole('link', { name: /0 \(/ })).toBeNull();
  });
});
