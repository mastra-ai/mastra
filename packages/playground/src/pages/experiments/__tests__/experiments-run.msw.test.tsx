import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import ExperimentsPage from '..';
import { datasetVersionsResponse } from '@/domains/datasets/components/__tests__/fixtures/dataset-versions';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
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

function setupHandlers() {
  const triggerCalls: Array<{ datasetId: string; body: Record<string, unknown> }> = [];
  const dataset = buildDataset();

  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json({ experiments: [] })),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json({ experiments: [] })),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/versions`, () => HttpResponse.json(datasetVersionsResponse)),
    http.get(`${TEST_BASE_URL}/api/agents`, () =>
      HttpResponse.json({ 'agent-1': { name: 'Agent One', instructions: '', tools: {}, workflows: {} } }),
    ),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
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

const selectOption = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });

describe('Experiments page — Run Experiment', () => {
  it('runs an experiment from scratch and navigates to it', async () => {
    const { triggerCalls } = setupHandlers();
    mockNavigate.mockClear();
    renderWithProviders(<ExperimentsPage />, { router: true });

    fireEvent.click(await screen.findByRole('button', { name: /run experiment/i }));

    const dialog = await screen.findByRole('dialog', { name: /run experiment/i });
    expect(dialog).toBeDefined();

    // Select dataset, version, and target
    await waitFor(() => expect(screen.getByRole('option', { name: 'Dataset 1' })).toBeDefined());
    selectOption('Select a dataset...', 'dataset-1');
    await waitFor(() => expect(screen.getByRole('option', { name: 'v11' })).toBeDefined());
    selectOption('Select version', '11');
    selectOption('Select target type', 'agent');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Agent One' })).toBeDefined());
    selectOption('Select agent', 'agent-1');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(triggerCalls).toHaveLength(1));
    expect(triggerCalls[0].datasetId).toBe('dataset-1');
    expect(triggerCalls[0].body.targetType).toBe('agent');
    expect(triggerCalls[0].body.targetId).toBe('agent-1');
    expect(triggerCalls[0].body.version).toBe(11);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/experiments/exp-42'));
  });
});
