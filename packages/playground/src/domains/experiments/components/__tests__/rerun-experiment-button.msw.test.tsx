import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RerunExperimentButton } from '../rerun-experiment-button';
import { experiments } from './fixtures/experiments';
import { datasetVersionsResponse } from '@/domains/datasets/components/__tests__/fixtures/dataset-versions';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
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
    http.get(`${TEST_BASE_URL}/api/agents`, () =>
      HttpResponse.json({ 'agent-1': { name: 'Agent One', instructions: '', tools: {}, workflows: {} } }),
    ),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () =>
      HttpResponse.json({ 'answer-relevancy': { scorer: { config: { name: 'Answer relevancy' } } } }),
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

  it('is hidden when the experiment has no dataset', () => {
    renderButton({ ...original, datasetId: null });
    expect(screen.queryByRole('button', { name: /rerun/i })).toBeNull();
  });
});
