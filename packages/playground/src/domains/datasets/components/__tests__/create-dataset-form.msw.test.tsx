import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CreateDatasetForm } from '../create-dataset-form';
import { buildDataset } from './fixtures/datasets';
import { itemScorers } from './fixtures/item-scorers';
import { getMultiSelect, setMultiSelectValues } from '@/test/mock-combobox-helpers';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@mastra/playground-ui/components/Combobox', () => import('@/test/mock-combobox'));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const SCORERS_PLACEHOLDER = 'Select scorers...';

function setupHandlers() {
  const createBodies: Array<Record<string, unknown>> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(itemScorers)),
    http.post(`${TEST_BASE_URL}/api/datasets`, async ({ request }) => {
      createBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(buildDataset({ id: 'created-dataset' }));
    }),
  );

  return { createBodies };
}

async function renderForm() {
  const onSuccess = vi.fn();
  renderWithProviders(<CreateDatasetForm onSuccess={onSuccess} onCancel={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('option', { name: 'Quality scorer' })).toBeDefined());
  return { onSuccess };
}

const typeName = (value: string) => fireEvent.change(screen.getByLabelText(/^Name/), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create Dataset' }));

describe('CreateDatasetForm', () => {
  describe('given registered scorers are available', () => {
    it('offers only registered scorers as default scorers', async () => {
      setupHandlers();
      await renderForm();

      expect(screen.getByText('Default scorers')).toBeDefined();
      const offered = Array.from(getMultiSelect(SCORERS_PLACEHOLDER).options, option => option.value);
      expect(offered).toEqual(['quality', 'stored-judge']);
    });

    it('creates the dataset without scorerIds when none is selected', async () => {
      const { createBodies } = setupHandlers();
      const { onSuccess } = await renderForm();

      typeName('My dataset');
      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies).toHaveLength(1);
      expect(createBodies[0].name).toBe('My dataset');
      expect(createBodies[0]).not.toHaveProperty('scorerIds');
    });

    it('sends the selected scorers as scorerIds when the user picks some', async () => {
      const { createBodies } = setupHandlers();
      const { onSuccess } = await renderForm();

      typeName('Scored dataset');
      setMultiSelectValues(SCORERS_PLACEHOLDER, ['quality', 'stored-judge']);
      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies[0].scorerIds).toEqual(['quality', 'stored-judge']);
    });
  });
});
