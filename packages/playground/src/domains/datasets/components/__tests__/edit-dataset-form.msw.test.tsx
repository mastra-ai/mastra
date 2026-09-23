import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { EditDatasetForm } from '../edit-dataset-form';
import { buildDataset } from './fixtures/datasets';
import { itemScorers } from './fixtures/item-scorers';
import { getMultiSelectValues, setMultiSelectValues } from '@/test/mock-combobox-helpers';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@mastra/playground-ui/components/Combobox', () => import('@/test/mock-combobox'));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const SCORERS_PLACEHOLDER = 'Select scorers...';

function setupHandlers() {
  const updateBodies: Array<Record<string, unknown>> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(itemScorers)),
    http.patch(`${TEST_BASE_URL}/api/datasets/:datasetId`, async ({ request }) => {
      updateBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(buildDataset({ id: 'ds-1' }));
    }),
  );

  return { updateBodies };
}

async function renderForm(scorerIds: string[]) {
  const onSuccess = vi.fn();
  renderWithProviders(
    <EditDatasetForm dataset={{ id: 'ds-1', name: 'Dataset 1', scorerIds }} onSuccess={onSuccess} onCancel={vi.fn()} />,
  );
  await waitFor(() => expect(screen.getByRole('option', { name: 'Quality scorer' })).toBeDefined());
  return { onSuccess };
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

describe('EditDatasetForm', () => {
  describe('given a dataset that already has default scorers', () => {
    it('shows the existing default scorers pre-selected', async () => {
      setupHandlers();
      await renderForm(['quality']);

      expect(getMultiSelectValues(SCORERS_PLACEHOLDER)).toEqual(['quality']);
    });

    it('sends the extended list when the user adds a scorer', async () => {
      const { updateBodies } = setupHandlers();
      const { onSuccess } = await renderForm(['quality']);

      setMultiSelectValues(SCORERS_PLACEHOLDER, ['quality', 'stored-judge']);
      save();

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(updateBodies[0].scorerIds).toEqual(['quality', 'stored-judge']);
    });

    it('sends scorerIds: null when the user clears every scorer', async () => {
      const { updateBodies } = setupHandlers();
      const { onSuccess } = await renderForm(['quality']);

      setMultiSelectValues(SCORERS_PLACEHOLDER, []);
      save();

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(updateBodies[0].scorerIds).toBeNull();
    });
  });
});
