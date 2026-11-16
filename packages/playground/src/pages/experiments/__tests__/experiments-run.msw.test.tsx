import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import ExperimentsPage from '..';
import { storageWithoutMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { emptyDatasetItems } from '@/domains/datasets/components/__tests__/fixtures/dataset-items';
import { datasetVersionsResponse } from '@/domains/datasets/components/__tests__/fixtures/dataset-versions';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  emptyReviewSummary,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import {
  agent,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const mockNavigate = vi.fn();

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Request context JSON" value={value} onChange={event => onChange?.(event.target.value)} />
  ),
}));

function setupHandlers() {
  const triggerCalls: Array<{ datasetId: string; body: Record<string, unknown> }> = [];
  const dataset = buildDataset();

  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/items`, () => HttpResponse.json(emptyDatasetItems)),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/versions`, () => HttpResponse.json(datasetVersionsResponse)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({ 'agent-1': agent('agent-1', 'Agent One') })),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.post(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, async ({ params, request }) => {
      triggerCalls.push({
        datasetId: String(params.datasetId),
        body: (await request.json()) as Record<string, unknown>,
      });
      return HttpResponse.json({
        experimentId: 'exp-42',
        status: 'pending',
        totalItems: 0,
        succeededCount: 0,
        failedCount: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        results: [],
      });
    }),
  );

  return { triggerCalls };
}

describe('Experiments page — New experiment', () => {
  it('runs an experiment from scratch and navigates to it', async () => {
    const { triggerCalls } = setupHandlers();
    mockNavigate.mockClear();
    renderWithProviders(<ExperimentsPage />, { router: true });

    fireEvent.click(await screen.findByRole('button', { name: /new experiment/i }));
    const dialog = within(await screen.findByRole('dialog', { name: /new experiment/i }));

    // The dataset starts on the newest one; pick the target and name the run under Advanced.
    await waitFor(() =>
      expect(dialog.getByRole<HTMLInputElement>('combobox', { name: /^Dataset/ }).value).toBe('Dataset 1'),
    );
    const target = dialog.getByRole<HTMLInputElement>('combobox', { name: /^Target/ });
    await waitFor(() => expect(target.disabled).toBe(false));
    fireEvent.keyDown(target, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Agent One' }));

    fireEvent.click(dialog.getByRole('button', { name: 'Advanced' }));
    fireEvent.change(await dialog.findByLabelText('Experiment name'), { target: { value: 'My experiment' } });

    fireEvent.click(dialog.getByRole('button', { name: 'Run experiment' }));

    await waitFor(() => expect(triggerCalls).toHaveLength(1));
    expect(triggerCalls[0].datasetId).toBe('dataset-1');
    expect(triggerCalls[0].body).toMatchObject({ name: 'My experiment', targetType: 'agent', targetId: 'agent-1' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/experiments/exp-42'));
  });
});
