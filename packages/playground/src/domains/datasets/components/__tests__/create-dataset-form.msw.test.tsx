import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CreateDatasetForm } from '../create-dataset-form';
import { buildDataset } from './fixtures/datasets';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function setupHandlers() {
  const createBodies: Array<Record<string, unknown>> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
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
  return { onSuccess };
}

const nameInput = () => screen.getByLabelText<HTMLInputElement>(/^Name/);
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create Dataset' }));

describe('CreateDatasetForm', () => {
  describe('when the form opens', () => {
    it('pre-fills the name with Dataset and a short id', async () => {
      setupHandlers();
      await renderForm();

      expect(nameInput().value).toMatch(/^Dataset [0-9a-f]{4}$/);
    });

    it('creates the dataset with the pre-filled name', async () => {
      const { createBodies } = setupHandlers();
      const { onSuccess } = await renderForm();
      const defaultName = nameInput().value;

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies[0].name).toBe(defaultName);
    });

    it('does not ask for a description', async () => {
      setupHandlers();
      await renderForm();

      expect(screen.queryByLabelText(/^Description/)).toBeNull();
    });

    it('creates the dataset without a description', async () => {
      const { createBodies } = setupHandlers();
      const { onSuccess } = await renderForm();

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies[0]).not.toHaveProperty('description');
    });

    it('does not offer default scorers', async () => {
      setupHandlers();
      await renderForm();

      expect(screen.queryByText('Default scorers')).toBeNull();
    });

    it('creates the dataset without scorerIds', async () => {
      const { createBodies } = setupHandlers();
      const { onSuccess } = await renderForm();

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies[0]).not.toHaveProperty('scorerIds');
    });

    it('keeps the name the user typed', async () => {
      const { createBodies } = setupHandlers();
      const { onSuccess } = await renderForm();

      typeName('Refund questions');
      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
      expect(createBodies[0].name).toBe('Refund questions');
    });
  });
});
