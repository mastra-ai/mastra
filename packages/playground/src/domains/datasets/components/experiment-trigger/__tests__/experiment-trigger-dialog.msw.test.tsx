// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { datasetVersionsResponse } from '../../__tests__/fixtures/dataset-versions';
import { buildDataset, buildListDatasetsResponse } from '../../__tests__/fixtures/datasets';
import { ExperimentTriggerDialog } from '../experiment-trigger-dialog';
import type { ExperimentTriggerDialogProps } from '../experiment-trigger-dialog';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui/components/Combobox', () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
    placeholder,
  }: {
    options: Array<{ label: string; value: string }>;
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <select aria-label={placeholder} value={value ?? ''} onChange={event => onValueChange?.(event.target.value)}>
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const datasets = [
  buildDataset(),
  buildDataset({
    id: 'dataset-2',
    name: 'Dataset 2',
    requestContextSchema: {
      type: 'object',
      properties: { tenant: { type: 'string' } },
    },
  }),
];

const emptyVersionsResponse = {
  versions: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

function setupHandlers() {
  const triggerCalls: Array<{ datasetId: string; body: Record<string, unknown> }> = [];

  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(datasets))),
    http.get(`${BASE_URL}/api/datasets/:datasetId`, ({ params }) => {
      const dataset = datasets.find(d => d.id === params.datasetId);
      return dataset ? HttpResponse.json(dataset) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.get(`${BASE_URL}/api/datasets/:datasetId/versions`, ({ params }) =>
      HttpResponse.json(params.datasetId === 'dataset-1' ? datasetVersionsResponse : emptyVersionsResponse),
    ),
    http.get(`${BASE_URL}/api/agents`, () =>
      HttpResponse.json({ 'agent-1': { name: 'Agent One', instructions: '', tools: {}, workflows: {} } }),
    ),
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
    http.post(`${BASE_URL}/api/datasets/:datasetId/experiments`, async ({ params, request }) => {
      triggerCalls.push({
        datasetId: String(params.datasetId),
        body: (await request.json()) as Record<string, unknown>,
      });
      return HttpResponse.json({
        experimentId: 'exp-1',
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

function renderDialog(props: Partial<ExperimentTriggerDialogProps> = {}) {
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ExperimentTriggerDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { onSuccess, onOpenChange };
}

const selectOption = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });

const runButton = () => screen.getByRole('button', { name: 'Run' });

async function pickAgentTarget() {
  selectOption('Select target type', 'agent');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Agent One' })).toBeDefined());
  selectOption('Select agent', 'agent-1');
}

describe('ExperimentTriggerDialog', () => {
  describe('when opened without an initial dataset', () => {
    it('starts with an empty dataset combobox and a disabled Run button', async () => {
      setupHandlers();
      renderDialog();

      const datasetCombobox = await screen.findByRole('combobox', { name: 'Select a dataset...' });
      expect((datasetCombobox as HTMLSelectElement).value).toBe('');
      expect((runButton() as HTMLButtonElement).disabled).toBe(true);
    });

    it('runs against the selected dataset and reports the experiment id', async () => {
      const { triggerCalls } = setupHandlers();
      const toastSuccess = vi.spyOn(toast, 'success');
      const { onSuccess } = renderDialog();

      await screen.findByRole('combobox', { name: 'Select a dataset...' });
      await waitFor(() => expect(screen.getByRole('option', { name: 'Dataset 1' })).toBeDefined());
      selectOption('Select a dataset...', 'dataset-1');
      await pickAgentTarget();

      fireEvent.click(runButton());

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('exp-1'));
      expect(toastSuccess).toHaveBeenCalledWith('Experiment triggered successfully');
      expect(triggerCalls).toHaveLength(1);
      expect(triggerCalls[0].datasetId).toBe('dataset-1');
      expect(triggerCalls[0].body.targetType).toBe('agent');
      expect(triggerCalls[0].body.targetId).toBe('agent-1');
      expect(triggerCalls[0].body.version).toBeUndefined();
    });
  });

  describe('when opened with an initial dataset and version', () => {
    it('pre-fills the comboboxes and sends the initial version', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog({ initialDatasetId: 'dataset-1', initialDatasetVersion: 11 });

      const datasetCombobox = await screen.findByRole('combobox', { name: 'Select a dataset...' });
      await waitFor(() => expect((datasetCombobox as HTMLSelectElement).value).toBe('dataset-1'));
      await waitFor(() => expect(screen.getByRole('option', { name: 'v11' })).toBeDefined());
      expect((screen.getByRole('combobox', { name: 'Select version' }) as HTMLSelectElement).value).toBe('11');

      await pickAgentTarget();
      fireEvent.click(runButton());

      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].datasetId).toBe('dataset-1');
      expect(triggerCalls[0].body.version).toBe(11);
    });

    it('resets the version when the dataset changes', async () => {
      const { triggerCalls } = setupHandlers();
      renderDialog({ initialDatasetId: 'dataset-1', initialDatasetVersion: 11 });

      await screen.findByRole('combobox', { name: 'Select a dataset...' });
      await waitFor(() => expect(screen.getByRole('option', { name: 'Dataset 2' })).toBeDefined());
      selectOption('Select a dataset...', 'dataset-2');

      await pickAgentTarget();
      fireEvent.click(runButton());

      await waitFor(() => expect(triggerCalls).toHaveLength(1));
      expect(triggerCalls[0].datasetId).toBe('dataset-2');
      expect(triggerCalls[0].body.version).toBeUndefined();
    });
  });

  describe('request context form', () => {
    it('uses the selected dataset requestContextSchema to drive the form', async () => {
      setupHandlers();
      renderDialog();

      await screen.findByRole('combobox', { name: 'Select a dataset...' });
      // No dataset selected: raw JSON editor
      expect(screen.getByText('Request Context (JSON, optional)')).toBeDefined();

      await waitFor(() => expect(screen.getByRole('option', { name: 'Dataset 2' })).toBeDefined());
      selectOption('Select a dataset...', 'dataset-2');

      // dataset-2 has a requestContextSchema: schema-driven form replaces the JSON editor
      expect(await screen.findByText('Request Context')).toBeDefined();
      await waitFor(() => expect(screen.queryByText('Request Context (JSON, optional)')).toBeNull());
    });
  });
});
