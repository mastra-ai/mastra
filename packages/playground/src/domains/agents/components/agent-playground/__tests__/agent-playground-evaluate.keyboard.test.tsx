import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import { PlaygroundModelProvider } from '../../../context/playground-model-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { AgentPlaygroundEvaluate } from '../agent-playground-evaluate';
import { GenerationProvider } from '@/domains/datasets/context/generation-context';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
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
          <AgentPlaygroundEvaluate agentId="chef-agent" />
        </GenerationProvider>
      </PlaygroundModelProvider>
    </AgentEditFormProvider>
  );
}

const setupHandlers = (experiments: DatasetExperiment[] = []) => {
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
    http.get('*/api/experiments', () =>
      HttpResponse.json({ experiments: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.get('*/api/scores/scorers', () => HttpResponse.json({})),
  );
};

describe('Evaluate navigation', () => {
  describe('when opened on the Review tab', () => {
    it('shows the review queue empty state', async () => {
      setupHandlers();
      renderWithProviders(<Harness />, { router: { initialEntries: ['/agents/chef-agent/evaluate?tab=review'] } });
      expect(await screen.findByText('No items to review')).not.toBeNull();
      expect(screen.getByRole('tab', { name: 'Review' }).getAttribute('aria-selected')).toBe('true');
    });
  });
  describe('when opened on Experiments', () => {
    it('provides Run options inside Evaluate', async () => {
      setupHandlers();
      renderWithProviders(<Harness />, { router: true });
      expect(await screen.findByTestId('agent-top-bar-run-options-trigger')).not.toBeNull();
    });
  });
});

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
          <Route path="/datasets/new" element={<div>Create dataset page</div>} />
        </Routes>,
        { router: { initialEntries: ['/'] } },
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
      expect(await screen.findByRole('button', { name: 'New dataset' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'New scorer' })).toBeNull();

      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create dataset page')).toBeTruthy();
    });

    it('shows New scorer on the Scorers tab and opens the new scorer view on C', async () => {
      setupHandlers();
      renderWithProviders(
        <Routes>
          <Route path="/" element={<Harness />} />
          <Route path="/datasets/new" element={<div>Create dataset page</div>} />
        </Routes>,
        { router: { initialEntries: ['/'] } },
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Scorers' }));
      expect(await screen.findByRole('button', { name: 'New scorer' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'New dataset' })).toBeNull();

      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByRole('button', { name: 'Back to Scorers' })).toBeTruthy();
      expect(screen.queryByText('Create dataset page')).toBeNull();
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
    it('opens Run options on U', async () => {
      setupHandlers();
      renderWithProviders(<Harness />, { router: true });
      await screen.findByTestId('agent-top-bar-run-options-trigger');

      fireEvent.keyDown(window, { key: 'u' });

      expect(await screen.findByRole('heading', { name: 'Run options' })).toBeTruthy();
    });

    it('opens the Attach dataset dialog on A from the Datasets tab', async () => {
      setupHandlers();
      server.use(
        http.get('*/api/datasets', () =>
          HttpResponse.json({
            datasets: [...datasets, { ...makeDataset('ds-4', 'Dataset Four'), targetIds: ['other-agent'] }],
            pagination: { total: 4, page: 0, perPage: 100, hasMore: false },
          }),
        ),
      );
      renderWithProviders(<Harness />, { router: true });
      fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
      await screen.findByRole('button', { name: 'Attach' });

      fireEvent.keyDown(window, { key: 'a' });

      expect(await screen.findByRole('dialog', { name: 'Attach Existing Dataset' })).toBeTruthy();
    });
  });

  describe('when only a workflow-targeted dataset is unattached', () => {
    it('hides the Attach action so the dataset cannot be mislabeled as an agent dataset', async () => {
      setupHandlers();
      server.use(
        http.get('*/api/datasets', () =>
          HttpResponse.json({
            datasets: [
              ...datasets,
              { ...makeDataset('ds-wf', 'Workflow Dataset'), targetType: 'workflow', targetIds: ['my-workflow'] },
            ],
            pagination: { total: 4, page: 0, perPage: 100, hasMore: false },
          }),
        ),
      );
      renderWithProviders(<Harness />, { router: true });
      fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
      await screen.findByText('Dataset One');

      expect(screen.queryByRole('button', { name: 'Attach' })).toBeNull();
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
