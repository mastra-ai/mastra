import type { DatasetExperiment, DatasetRecord, GetScorerResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import { PlaygroundModelProvider } from '../../../context/playground-model-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { AgentPlaygroundEvaluate } from '../agent-playground-evaluate';
import { GenerationProvider } from '@/domains/datasets/context/generation-context';
import { emptyReviewSummary } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

const makeDataset = (id: string, name: string): DatasetRecord => ({
  id,
  name,
  targetType: 'agent',
  targetIds: ['chef-agent'],
  version: 1,
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:00:00.000Z'),
});

const datasets = [
  makeDataset('ds-1', 'Dataset One'),
  makeDataset('ds-2', 'Dataset Two'),
  makeDataset('ds-3', 'Dataset Three'),
];

const completedExperiment: DatasetExperiment = {
  id: 'exp-1',
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
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  skippedCount: 0,
  startedAt: new Date('2026-08-25T10:00:00.000Z'),
  completedAt: new Date('2026-08-25T10:05:00.000Z'),
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:05:00.000Z'),
};

function Harness() {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Chef Agent',
      instructions: 'Cook well.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      tools: {},
    },
  });

  return (
    <AgentEditFormProvider form={form} mode="edit" isSubmitting={false} handlePublish={async () => {}}>
      <PlaygroundModelProvider>
        <GenerationProvider>
          <TestLinkProvider>
            <AgentPlaygroundEvaluate agentId="chef-agent" />
          </TestLinkProvider>
        </GenerationProvider>
      </PlaygroundModelProvider>
    </AgentEditFormProvider>
  );
}

const unattachedScorer = {
  scorer: { config: { id: 'scorer-a', name: 'Scorer A', description: 'Scorer A description' } },
  source: 'code',
  agentIds: [],
  workflowIds: [],
} as unknown as GetScorerResponse;

function LocationProbe({ label }: { label: string }) {
  const { search } = useLocation();
  return (
    <div>
      {label}
      <span data-testid="location-search">{search}</span>
    </div>
  );
}

const setupHandlers = (experiments: DatasetExperiment[] = [], scorers: Record<string, GetScorerResponse> = {}) => {
  server.use(
    http.get('*/api/datasets', () =>
      HttpResponse.json({ datasets, pagination: { total: 3, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.get('*/api/datasets/:datasetId/experiments', ({ params }) => {
      const datasetExperiments = params.datasetId === 'ds-1' ? experiments : [];
      return HttpResponse.json({
        experiments: datasetExperiments,
        pagination: { total: datasetExperiments.length, page: 0, perPage: 100, hasMore: false },
      });
    }),
    http.get('*/api/scores/scorers', () => HttpResponse.json(scorers)),
    http.get('*/api/experiments/review-summary', () => HttpResponse.json(emptyReviewSummary)),
    // Fetched by the Run experiment dialog's target selector.
    http.get('*/api/agents', () =>
      HttpResponse.json({ 'chef-agent': { name: 'Chef Agent', instructions: '', tools: {}, workflows: {} } }),
    ),
    http.get('*/api/workflows', () => HttpResponse.json({})),
    http.get('*/api/processors', () => HttpResponse.json({})),
  );
};

const renderDatasetsTab = async () => {
  setupHandlers();
  const utils = renderWithProviders(<Harness />, { router: true });

  fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
  await waitFor(() => expect(screen.getByText('Dataset One')).toBeTruthy());

  return utils;
};

describe('AgentPlaygroundEvaluate', () => {
  describe('when a completed experiment is available', () => {
    it('shows its status as a readable label', async () => {
      setupHandlers([completedExperiment]);
      renderWithProviders(<Harness />, { router: true });

      await waitFor(() => expect(screen.getByText('Run completed')).toBeTruthy());
      expect(screen.queryByText('completed')).toBeNull();
    });
  });

  describe('create actions', () => {
    it('shows New dataset on the Datasets tab and navigates to the create page on C', async () => {
      setupHandlers();
      renderWithProviders(
        <Routes>
          <Route path="/" element={<Harness />} />
          <Route path="/datasets/new" element={<LocationProbe label="Create dataset page" />} />
        </Routes>,
        { router: { initialEntries: ['/'] } },
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
      expect(await screen.findByRole('button', { name: 'New dataset' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'New scorer' })).toBeNull();

      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create dataset page')).toBeTruthy();
      // The create page uses agentId to come back to this tab once the dataset exists.
      expect(screen.getByTestId('location-search').textContent).toBe(
        '?targetType=agent&targetIds=chef-agent&agentId=chef-agent',
      );
    });

    it('shows New scorer on the Scorers tab and navigates to the scorer create page on C', async () => {
      setupHandlers();
      renderWithProviders(
        <Routes>
          <Route path="/" element={<Harness />} />
          <Route path="/datasets/new" element={<div>Create dataset page</div>} />
          <Route path="/cms/scorers/create" element={<LocationProbe label="Create scorer page" />} />
        </Routes>,
        { router: { initialEntries: ['/'] } },
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Scorers' }));
      expect(await screen.findByRole('button', { name: 'New scorer' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'New dataset' })).toBeNull();

      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create scorer page')).toBeTruthy();
      expect(screen.queryByText('Create dataset page')).toBeNull();
      expect(screen.getByTestId('location-search').textContent).toBe('?agentId=chef-agent');
    });

    it('attaches the scorer named by ?attachScorer on arrival, then drops the param', async () => {
      setupHandlers([], { 'scorer-a': unattachedScorer });
      let patchBody: Record<string, unknown> | undefined;
      server.use(
        http.patch('*/api/stored/agents/chef-agent', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'chef-agent' });
        }),
      );
      renderWithProviders(
        <Routes>
          <Route path="/" element={<Harness />} />
          <Route path="/agents/:agentId/evaluate" element={<Harness />} />
        </Routes>,
        { router: { initialEntries: ['/agents/chef-agent/evaluate?tab=scorers&attachScorer=scorer-a'] } },
      );

      await waitFor(() => expect(patchBody).toBeDefined());
      expect(patchBody?.scorers).toHaveProperty('scorer-a');
      await waitFor(() => expect(window.location.search).not.toContain('attachScorer'));
    });

    it('does not bind C on the Experiments tab', async () => {
      setupHandlers();
      renderWithProviders(
        <Routes>
          <Route path="/" element={<Harness />} />
          <Route path="/datasets/new" element={<div>Create dataset page</div>} />
        </Routes>,
        { router: { initialEntries: ['/'] } },
      );

      expect(screen.queryByRole('button', { name: 'New dataset' })).toBeNull();
      fireEvent.keyDown(window, { key: 'c' });

      expect(screen.queryByText('Create dataset page')).toBeNull();
    });
  });

  describe('shortcuts', () => {
    it('opens the Run experiment dialog with R on the Experiments tab, pre-targeting the agent', async () => {
      setupHandlers();
      renderWithProviders(<Harness />, { router: true });

      await screen.findByRole('button', { name: /run experiment/i });
      fireEvent.keyDown(window, { key: 'r' });

      const dialog = await screen.findByRole('dialog', { name: /run experiment/i });
      // Target type + target are preselected from the current agent.
      await waitFor(() => expect(within(dialog).getByText('Chef Agent')).toBeDefined());
    });

    it('toggles Run options with U', async () => {
      setupHandlers();
      renderWithProviders(<Harness />, { router: true });

      const trigger = screen.getByTestId('agent-top-bar-run-options-trigger');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      fireEvent.keyDown(window, { key: 'u' });
      await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));

      fireEvent.keyDown(window, { key: 'u' });
      await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
    });

    it('opens the Attach scorer combobox with A on the Scorers tab', async () => {
      setupHandlers([], { 'scorer-a': unattachedScorer });
      renderWithProviders(<Harness />, { router: true });

      fireEvent.click(screen.getByRole('tab', { name: 'Scorers' }));
      const attach = await screen.findByRole('combobox', { name: 'Attach scorer' });
      expect(attach.getAttribute('aria-expanded')).toBe('false');

      // Base UI popups don't render in jsdom; the trigger state is the observable contract.
      fireEvent.keyDown(window, { key: 'a' });
      await waitFor(() => expect(attach.getAttribute('aria-expanded')).toBe('true'));

      fireEvent.keyDown(window, { key: 'a' });
      await waitFor(() => expect(attach.getAttribute('aria-expanded')).toBe('false'));
    });

    it('does not bind A on the Experiments tab', async () => {
      setupHandlers([], { 'scorer-a': unattachedScorer });
      renderWithProviders(<Harness />, { router: true });

      expect(screen.queryByRole('combobox', { name: 'Attach scorer' })).toBeNull();
      fireEvent.keyDown(window, { key: 'a' });
      expect(screen.queryByRole('combobox', { name: 'Attach scorer' })).toBeNull();
    });
  });

  describe('when the datasets tab renders rows', () => {
    it('applies a roving tabindex across dataset rows', async () => {
      await renderDatasetsTab();
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
    });

    it('moves focus with Arrow/Home/End keys', async () => {
      await renderDatasetsTab();
      expectArrowNavigation(interactiveRows());
    });
  });
});
