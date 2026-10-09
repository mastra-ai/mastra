import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CreateDatasetForm } from '../create-dataset-form';
import { buildDataset, buildListDatasetsResponse } from './fixtures/datasets';
import { itemScorers } from './fixtures/item-scorers';
import { getMultiSelect, setMultiSelectValues } from '@/test/mock-combobox-helpers';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@mastra/playground-ui/components/Combobox', () => import('@/test/mock-combobox'));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const SCORERS_PLACEHOLDER = 'Select scorers...';

function setupHandlers(existingDatasets = [buildDataset()]) {
  const createBodies: Array<Record<string, unknown>> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(existingDatasets))),
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

const nameInput = () => screen.getByLabelText(/^Name/) as HTMLInputElement;
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });
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

  describe('when no datasets exist yet', () => {
    it('pre-fills the name with Dataset 1', async () => {
      setupHandlers([]);
      await renderForm();

      await waitFor(() => expect(nameInput().value).toBe('Dataset 1'));
    });
  });

  describe('when numbered datasets already exist', () => {
    const existingDatasets = [
      buildDataset({ id: 'dataset-4', name: 'Dataset 4' }),
      buildDataset({ id: 'dataset-3', name: 'Dataset 3' }),
      buildDataset({ id: 'not-english', name: 'not English' }),
    ];

    it('pre-fills the name with the next free number', async () => {
      setupHandlers(existingDatasets);
      await renderForm();

      await waitFor(() => expect(nameInput().value).toBe('Dataset 5'));
    });

    it('creates the dataset with the pre-filled name', async () => {
      const { createBodies } = setupHandlers(existingDatasets);
      const { onSuccess } = await renderForm();
      await waitFor(() => expect(nameInput().value).toBe('Dataset 5'));

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies[0].name).toBe('Dataset 5');
    });

    it('keeps the name the user typed', async () => {
      const { createBodies } = setupHandlers(existingDatasets);
      const { onSuccess } = await renderForm();
      await waitFor(() => expect(nameInput().value).toBe('Dataset 5'));

      typeName('Refund questions');
      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(nameInput().value).toBe('Refund questions');
      expect(createBodies[0].name).toBe('Refund questions');
    });
  });
});
