import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExperimentResultsList } from '../experiment-results-list';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const makeResult = (id: string, error: DatasetExperimentResult['error'] = null): DatasetExperimentResult => ({
  id,
  experimentId: 'exp-1',
  itemId: `item-${id}`,
  itemDatasetVersion: 1,
  input: 'input',
  output: 'output',
  groundTruth: null,
  error,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:00:01.000Z',
  retryCount: 0,
  traceId: null,
  status: null,
  tags: null,
  scores: [],
  createdAt: '2026-08-25T10:00:00.000Z',
});

const columns = [{ name: 'id', label: 'Item', size: '1fr' }];

const renderList = (results: DatasetExperimentResult[]) =>
  renderWithProviders(
    <ExperimentResultsList
      results={results}
      isLoading={false}
      featuredResultId={null}
      onResultClick={() => {}}
      columns={columns}
    />,
  );

describe('ExperimentResultsList', () => {
  afterEach(cleanup);

  describe('for a result without an error', () => {
    it('renders no success or status indicator', () => {
      renderList([makeResult('r-1')]);

      expect(screen.queryByRole('img', { name: 'Error' })).toBeNull();
      expect(screen.queryByText('Success')).toBeNull();
      expect(screen.queryByText('Status')).toBeNull();
    });
  });

  describe('for a result with an error', () => {
    it('renders an error marker', () => {
      renderList([makeResult('r-1', { message: 'boom' } as DatasetExperimentResult['error'])]);

      expect(screen.getByRole('img', { name: 'Error' })).toBeDefined();
    });
  });

  describe('scorer columns', () => {
    it('links the column header to the scorer page in the same tab', () => {
      renderWithProviders(
        <TestLinkProvider>
          <ExperimentResultsList
            results={[makeResult('r-1')]}
            isLoading={false}
            featuredResultId={null}
            onResultClick={() => {}}
            columns={[...columns, { name: 'answer-relevancy', label: 'Answer relevancy', size: '1fr' }]}
            scorerIds={['answer-relevancy']}
          />
        </TestLinkProvider>,
      );

      const link = screen.getByText('Answer relevancy').closest('a');
      expect(link?.getAttribute('href')).toBe('/scorers/answer-relevancy');
      expect(link?.hasAttribute('target')).toBe(false);
    });
  });
});
