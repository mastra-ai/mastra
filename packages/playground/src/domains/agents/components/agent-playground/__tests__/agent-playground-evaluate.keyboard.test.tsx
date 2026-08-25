import type { DatasetRecord } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import { ReviewQueueProvider } from '../../../context/review-queue-context';
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
      <GenerationProvider>
        <ReviewQueueProvider>
          <AgentPlaygroundEvaluate agentId="chef-agent" />
        </ReviewQueueProvider>
      </GenerationProvider>
    </AgentEditFormProvider>
  );
}

const setupHandlers = () => {
  server.use(
    http.get('*/api/datasets', () =>
      HttpResponse.json({ datasets, pagination: { total: 3, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.get('*/api/datasets/:datasetId/experiments', () =>
      HttpResponse.json({ experiments: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.get('*/api/scores/scorers', () => HttpResponse.json({})),
  );
};

const renderDatasetsTab = async () => {
  setupHandlers();
  const utils = renderWithProviders(<Harness />);

  fireEvent.click(screen.getByRole('tab', { name: 'Datasets' }));
  await waitFor(() => expect(screen.getByText('Dataset One')).toBeTruthy());

  return utils;
};

describe('AgentPlaygroundEvaluate keyboard navigation', () => {
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
