import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RerunExperimentButton } from '../rerun-experiment-button';
import { experiments } from './fixtures/experiments';
import { datasetVersionsResponse } from '@/domains/datasets/components/__tests__/fixtures/dataset-versions';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  agent,
  noProcessors,
  noWorkflows,
  scorer,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const mockNavigate = vi.fn();

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@mastra/playground-ui/components/Combobox', () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
    placeholder,
  }: {
    options: Array<{ label: string; value: string }>;
    value?: string | string[];
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder}
      value={Array.isArray(value) ? (value[0] ?? '') : (value ?? '')}
      onChange={event => onValueChange?.(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Request context JSON" value={value} onChange={event => onChange?.(event.target.value)} />
  ),
}));

const original = {
  ...experiments[0],
  datasetId: 'dataset-1',
  datasetVersion: 11,
  targetType: 'agent' as const,
  targetId: 'agent-1',
  scorerIds: ['answer-relevancy'],
};

const triggerCalls: Array<{ datasetId: string; body: Record<string, unknown> }> = [];

beforeEach(() => {
  triggerCalls.length = 0;
  mockNavigate.mockClear();
  const dataset = buildDataset();
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/versions`, () => HttpResponse.json(datasetVersionsResponse)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({ 'agent-1': agent('agent-1', 'Agent One') })),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
      HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () =>
      HttpResponse.json({ 'answer-relevancy': scorer('answer-relevancy', 'Answer relevancy') }),
    ),
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
});

afterEach(cleanup);

const renderButton = (experiment = original) =>
  renderWithProviders(
    <TestLinkProvider>
      <RerunExperimentButton experiment={experiment} />
    </TestLinkProvider>,
    { router: true },
  );

describe('RerunExperimentButton', () => {
  it('opens the run dialog prefilled from the experiment and creates a new run with the same config', async () => {
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: /rerun/i }));
    await screen.findByRole('dialog', { name: /run experiment/i });

    const datasetCombobox = await screen.findByRole('combobox', { name: 'Select a dataset...' });
    await waitFor(() => expect((datasetCombobox as HTMLSelectElement).value).toBe('dataset-1'));
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Select version' }) as HTMLSelectElement).value).toBe('11'),
    );
    expect((screen.getByRole('combobox', { name: 'Select target type' }) as HTMLSelectElement).value).toBe('agent');
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Select agent' }) as HTMLSelectElement).value).toBe('agent-1'),
    );
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Select scorers...' }) as HTMLSelectElement).value).toBe(
        'answer-relevancy',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(triggerCalls).toHaveLength(1));
    expect(triggerCalls[0].datasetId).toBe('dataset-1');
    expect(triggerCalls[0].body).toMatchObject({
      targetType: 'agent',
      targetId: 'agent-1',
      version: 11,
      scorerIds: ['answer-relevancy'],
    });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/experiments/exp-42'));
  });

  it('falls back to the scorers that actually produced scores when none are pinned on the experiment', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
        HttpResponse.json({
          scores: [
            { entityId: 'item-1', scorerId: 'answer-relevancy', score: 0.5 },
            { entityId: 'item-2', scorerId: 'answer-relevancy', score: 0.7 },
          ],
          pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
        }),
      ),
    );
    renderButton({ ...original, scorerIds: null });

    fireEvent.click(screen.getByRole('button', { name: /rerun/i }));
    await screen.findByRole('dialog', { name: /run experiment/i });

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Select scorers...' }) as HTMLSelectElement).value).toBe(
        'answer-relevancy',
      ),
    );
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Select agent' }) as HTMLSelectElement).value).toBe('agent-1'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(triggerCalls).toHaveLength(1));
    expect(triggerCalls[0].body).toMatchObject({ scorerIds: ['answer-relevancy'] });
  });

  it('should prefill the dialog name and description from the original experiment', async () => {
    // Given an experiment with a name and description
    renderButton({ ...original, name: 'Original run', description: 'Original description' });

    // When the rerun dialog opens
    fireEvent.click(screen.getByRole('button', { name: /rerun/i }));
    await screen.findByRole('dialog', { name: /run experiment/i });

    // Then the name/description inputs are prefilled and sent with the new run
    expect((screen.getByLabelText('Name *') as HTMLInputElement).value).toBe('Original run');
    expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe('Original description');

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Select agent' }) as HTMLSelectElement).value).toBe('agent-1'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(triggerCalls).toHaveLength(1));
    expect(triggerCalls[0].body).toMatchObject({ name: 'Original run', description: 'Original description' });
  });

  it('is hidden when the experiment has no dataset', () => {
    renderButton({ ...original, datasetId: null });
    expect(screen.queryByRole('button', { name: /rerun/i })).toBeNull();
  });

  it('is hidden for caller-run experiments that have no target', () => {
    renderButton({ ...original, targetType: null, targetId: null });
    expect(screen.queryByRole('button', { name: /rerun/i })).toBeNull();
  });

  it('is hidden when the target type cannot be submitted from the run dialog', () => {
    renderButton({ ...original, targetType: 'processor', targetId: 'proc-1' });
    expect(screen.queryByRole('button', { name: /rerun/i })).toBeNull();
  });
});
