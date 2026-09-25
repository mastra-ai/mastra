import type {
  DatasetExperiment,
  DatasetExperimentResult,
  DatasetRecord,
  UpdateExperimentResultParams,
} from '@mastra/client-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { DatasetReview } from '../dataset-review';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { server } from '@/test/msw-server';
import { makeWrapper, renderWithProviders } from '@/test/render';

const dataset: DatasetRecord = {
  id: 'ds-1',
  name: 'Dataset One',
  version: 1,
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:00:00.000Z'),
};

const makeExperiment = (id: string): DatasetExperiment => ({
  id,
  datasetId: 'ds-1',
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'chef-agent',
  provenance: null,
  runnerAttestation: null,
  experimentSetId: null,
  comparisonId: null,
  variantId: null,
  trialIndex: 0,
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  skippedCount: 0,
  startedAt: new Date('2026-08-25T10:00:00.000Z'),
  completedAt: new Date('2026-08-25T10:05:00.000Z'),
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:05:00.000Z'),
});

const makeResult = (id: string, experimentId: string, input: string): DatasetExperimentResult => ({
  id,
  experimentId,
  itemId: `item-${id}`,
  itemDatasetVersion: 1,
  input,
  output: `output for ${input}`,
  groundTruth: null,
  error: null,
  startedAt: new Date('2026-08-25T10:00:00.000Z'),
  completedAt: new Date('2026-08-25T10:01:00.000Z'),
  retryCount: 0,
  traceId: null,
  status: 'needs-review',
  tags: [],
  scores: [],
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
});

const resultsByExperiment: Record<string, DatasetExperimentResult[]> = {
  'exp-1': [makeResult('r-1', 'exp-1', 'exp one input')],
  'exp-2': [makeResult('r-2', 'exp-2', 'exp two input')],
};

// Experiments and results resolve slowly so the component mounts before the review
// queue is known — the deep-link case (`/experiments/review-queue?experiment=<id>&review=<resultId>`)
// on a cold cache.
const setupHandlers = () => {
  server.use(
    http.get('*/api/datasets/ds-1', () => HttpResponse.json(dataset)),
    http.get('*/api/experiments', async () => {
      await delay(50);
      return HttpResponse.json({
        experiments: [makeExperiment('exp-1'), makeExperiment('exp-2')],
        pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
      });
    }),
    http.get('*/api/datasets/:datasetId/experiments/:experimentId/results', async ({ params }) => {
      await delay(50);
      const results = resultsByExperiment[String(params.experimentId)] ?? [];
      return HttpResponse.json({
        results,
        pagination: { total: results.length, page: 0, perPage: 100, hasMore: false },
      });
    }),
  );
};

function SendToReview() {
  const { updateExperimentResult } = useDatasetMutations();
  return (
    <button
      onClick={() =>
        updateExperimentResult.mutate({
          datasetId: 'ds-1',
          experimentId: 'exp-1',
          resultId: 'r-1',
          status: 'needs-review',
        })
      }
    >
      Send to Review
    </button>
  );
}

describe('DatasetReview with a parent experiment source', () => {
  describe('when a result is sent to review and completed', () => {
    it('persists the transition through invalidation and a fresh mount', async () => {
      let persisted: DatasetExperimentResult = { ...makeResult('r-1', 'exp-1', 'persisted input'), status: null };
      server.use(
        http.get('*/api/datasets/:datasetId/experiments/:experimentId/results', () =>
          HttpResponse.json({ results: [persisted], pagination: { total: 1, page: 0, perPage: 100, hasMore: false } }),
        ),
        http.patch<never, UpdateExperimentResultParams>(
          '*/api/datasets/ds-1/experiments/exp-1/results/r-1',
          async ({ request }) => {
            const body = await request.json();
            persisted = { ...persisted, status: body.status ?? null };
            return HttpResponse.json(persisted);
          },
        ),
      );
      const first = renderWithProviders(
        <>
          <SendToReview />
          <DatasetReview withQueryTrace withFeedback experiments={[makeExperiment('exp-1')]} />
        </>,
      );
      expect(await screen.findByText('No items to review')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Send to Review' }));
      expect(await screen.findByText(/persisted input/)).toBeTruthy();
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
      expect(await screen.findByText('No items to review')).toBeTruthy();
      await waitFor(() => expect(persisted.status).toBe('complete'));
      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.pointerDown(screen.getByRole('option', { name: 'Completed' }), { pointerType: 'mouse' });
      fireEvent.click(screen.getByRole('option', { name: 'Completed' }), { detail: 1 });
      expect(await screen.findByText(/persisted input/)).toBeTruthy();
      first.unmount();
      renderWithProviders(<DatasetReview withQueryTrace withFeedback experiments={[makeExperiment('exp-1')]} />);
      expect(await screen.findByText('No items to review')).toBeTruthy();
      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.pointerDown(screen.getByRole('option', { name: 'Completed' }), { pointerType: 'mouse' });
      fireEvent.click(screen.getByRole('option', { name: 'Completed' }), { detail: 1 });
      expect(await screen.findByText(/persisted input/)).toBeTruthy();
    });
  });

  describe('when the parent is loading experiments', () => {
    it('waits for the parent instead of showing an empty queue', async () => {
      setupHandlers();
      const { rerender } = renderWithProviders(
        <DatasetReview withQueryTrace withFeedback experiments={[]} isLoadingExperiments />,
      );
      expect(screen.queryByText('No items to review')).toBeNull();
      rerender(<DatasetReview withQueryTrace withFeedback experiments={[]} isLoadingExperiments={false} />);
      expect(await screen.findByText('No items to review')).toBeTruthy();
    });
  });

  describe('when the parent supplies a restricted list', () => {
    it('shows only results from that list without discovering experiments', async () => {
      setupHandlers();
      const discover = vi.fn(() =>
        HttpResponse.json({ experiments: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
      );
      server.use(http.get('*/api/experiments', discover));
      renderWithProviders(<DatasetReview withQueryTrace withFeedback experiments={[makeExperiment('exp-2')]} />);
      expect(await screen.findByText(/exp two input/)).toBeTruthy();
      expect(screen.queryByText(/exp one input/)).toBeNull();
      expect(discover).not.toHaveBeenCalled();
    });
  });
});

describe('DatasetReview scoped to an experiment', () => {
  describe('when mounted before the review queue has loaded', () => {
    it('shows that experiment’s review items once they arrive', async () => {
      setupHandlers();
      renderWithProviders(<DatasetReview withQueryTrace withFeedback datasetId="ds-1" experimentId="exp-2" />);

      expect(await screen.findByText(/exp two input/)).toBeTruthy();
      expect(screen.queryByText(/exp one input/)).toBeNull();
    });

    it('never flashes the empty state while the dataset experiments are still loading', async () => {
      setupHandlers();
      renderWithProviders(<DatasetReview withQueryTrace withFeedback datasetId="ds-1" experimentId="exp-2" />);

      // Before any request resolves the queue is unknown: a spinner, not "No items to review".
      expect(screen.queryByText('No items to review')).toBeNull();
      await screen.findByText(/exp two input/);
    });
  });
});

describe('DatasetReview without a scope', () => {
  it('lists review items from every experiment in the project', async () => {
    setupHandlers();
    renderWithProviders(<DatasetReview withQueryTrace withFeedback />);

    expect(await screen.findByText(/exp one input/)).toBeTruthy();
    expect(await screen.findByText(/exp two input/)).toBeTruthy();
  });

  // Flagging a result elsewhere (experiment page) invalidates the cached queue; when the
  // user comes back, the stale snapshot must not stick — the refetched one has to win.
  it('shows a result flagged elsewhere when returning with a stale cached queue', async () => {
    const results: DatasetExperimentResult[] = [];
    server.use(
      http.get('*/api/experiments', () =>
        HttpResponse.json({
          experiments: [makeExperiment('exp-1')],
          pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
        }),
      ),
      http.get('*/api/datasets/:datasetId/experiments/:experimentId/results', () =>
        HttpResponse.json({ results, pagination: { total: results.length, page: 0, perPage: 100, hasMore: false } }),
      ),
    );

    const { wrapper, queryClient } = makeWrapper();
    const first = render(<DatasetReview withQueryTrace withFeedback />, { wrapper });
    expect(await screen.findByText('No items to review')).toBeTruthy();
    first.unmount();

    results.push(makeResult('r-1', 'exp-1', 'freshly flagged input'));
    await queryClient.invalidateQueries({ queryKey: ['review-items'] });

    render(<DatasetReview withQueryTrace withFeedback />, { wrapper });
    expect(await screen.findByText(/freshly flagged input/)).toBeTruthy();
  });
});

describe('DatasetReview scoped to an agent', () => {
  describe('when onCreateScorer is provided and review items are loaded', () => {
    it('calls onCreateScorer with the visible items input/output', async () => {
      setupHandlers();
      const onCreateScorer = vi.fn();
      renderWithProviders(
        <DatasetReview
          withQueryTrace
          withFeedback
          targetType="agent"
          targetId="chef-agent"
          onCreateScorer={onCreateScorer}
        />,
      );

      await screen.findByText(/exp one input/);
      await screen.findByText(/exp two input/);
      fireEvent.click(screen.getByRole('button', { name: 'Create Scorer' }));

      expect(onCreateScorer).toHaveBeenCalledTimes(1);
      expect(onCreateScorer.mock.calls[0]?.[0]).toEqual(
        expect.arrayContaining([
          { input: 'exp one input', output: 'output for exp one input' },
          { input: 'exp two input', output: 'output for exp two input' },
        ]),
      );
    });
  });

  describe('when onCreateScorer is not provided', () => {
    it('does not render the Create Scorer action', async () => {
      setupHandlers();
      renderWithProviders(<DatasetReview withQueryTrace withFeedback targetType="agent" targetId="chef-agent" />);

      await screen.findByText(/exp one input/);
      expect(screen.queryByRole('button', { name: 'Create Scorer' })).toBeNull();
    });
  });
});
