import type { CreateDatasetParams } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { CreateDatasetDialog } from '../create-dataset-dialog';
import { buildDataset } from './fixtures/datasets';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function setupHandlers() {
  const createBodies: CreateDatasetParams[] = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.post<never, CreateDatasetParams>(`${TEST_BASE_URL}/api/datasets`, async ({ request }) => {
      createBodies.push(await request.json());
      return HttpResponse.json(buildDataset({ id: 'created-dataset' }));
    }),
  );

  return { createBodies };
}

function DatasetProbe() {
  const { datasetId } = useParams();
  return <div data-testid="dataset-probe">{datasetId}</div>;
}

type DialogProps = ComponentProps<typeof CreateDatasetDialog>;

async function renderDialog(props: Partial<DialogProps> = {}) {
  const onOpenChange = vi.fn<DialogProps['onOpenChange']>();
  renderWithProviders(
    <Routes>
      <Route path="/datasets" element={<CreateDatasetDialog open onOpenChange={onOpenChange} {...props} />} />
      <Route path="/datasets/:datasetId" element={<DatasetProbe />} />
    </Routes>,
    { router: { initialEntries: ['/datasets'] } },
  );
  await screen.findByRole('dialog', { name: 'Create new dataset' });
  return { onOpenChange };
}

const nameInput = () => screen.getByLabelText<HTMLInputElement>(/^Name/);
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create dataset' }));

describe('CreateDatasetDialog', () => {
  describe('when the dialog opens', () => {
    it('shows the create dataset title', async () => {
      setupHandlers();
      await renderDialog();

      expect(screen.getByRole('dialog', { name: 'Create new dataset' })).not.toBeNull();
    });

    it('pre-fills the name with Dataset and a short id', async () => {
      setupHandlers();
      await renderDialog();

      expect(nameInput().value).toMatch(/^Dataset [0-9a-f]{4}$/);
    });

    it('does not ask for a description', async () => {
      setupHandlers();
      await renderDialog();

      expect(screen.queryByLabelText(/^Description/)).toBeNull();
    });

    it('does not offer default scorers', async () => {
      setupHandlers();
      await renderDialog();

      expect(screen.queryByText('Default scorers')).toBeNull();
    });

    it('does not ask for a target type', async () => {
      setupHandlers();
      await renderDialog();

      expect(screen.queryByText('Target type')).toBeNull();
    });

    it('does not offer schema configuration', async () => {
      setupHandlers();
      await renderDialog();

      expect(screen.queryByText(/Schema Configuration/)).toBeNull();
    });
  });

  describe('when the dataset is created without a target', () => {
    it('sends the pre-filled name', async () => {
      const { createBodies } = setupHandlers();
      await renderDialog();
      const defaultName = nameInput().value;

      submit();

      await waitFor(() => expect(createBodies).toHaveLength(1));
      expect(createBodies[0].name).toBe(defaultName);
    });

    it('keeps the name the user typed', async () => {
      const { createBodies } = setupHandlers();
      await renderDialog();

      typeName('Refund questions');
      submit();

      await waitFor(() => expect(createBodies).toHaveLength(1));
      expect(createBodies[0].name).toBe('Refund questions');
    });

    it('sends no target, description or scorers', async () => {
      const { createBodies } = setupHandlers();
      await renderDialog();

      submit();

      await waitFor(() => expect(createBodies).toHaveLength(1));
      expect(createBodies[0]).not.toHaveProperty('targetType');
      expect(createBodies[0]).not.toHaveProperty('targetIds');
      expect(createBodies[0]).not.toHaveProperty('description');
      expect(createBodies[0]).not.toHaveProperty('scorerIds');
    });

    it('sends no schemas', async () => {
      const { createBodies } = setupHandlers();
      await renderDialog();

      submit();

      await waitFor(() => expect(createBodies).toHaveLength(1));
      expect(createBodies[0]).not.toHaveProperty('inputSchema');
      expect(createBodies[0]).not.toHaveProperty('groundTruthSchema');
      expect(createBodies[0]).not.toHaveProperty('requestContextSchema');
    });
  });

  describe('when the dialog is scoped to a target', () => {
    it('sends the targetType and targetIds', async () => {
      const { createBodies } = setupHandlers();
      await renderDialog({ targetType: 'workflow', targetIds: ['my-wf', 'other-wf'] });

      submit();

      await waitFor(() => expect(createBodies).toHaveLength(1));
      expect(createBodies[0].targetType).toBe('workflow');
      expect(createBodies[0].targetIds).toEqual(['my-wf', 'other-wf']);
    });

    it('does not ask for a target type', async () => {
      setupHandlers();
      await renderDialog({ targetType: 'agent', targetIds: ['weather-agent'] });

      expect(screen.queryByText('Target type')).toBeNull();
    });

    it('does not offer a custom schema', async () => {
      setupHandlers();
      await renderDialog({ targetType: 'agent', targetIds: ['weather-agent'] });

      expect(screen.queryByRole('button', { name: '+ Custom schema' })).toBeNull();
    });
  });

  describe('when the dataset is created without an onSuccess handler', () => {
    it('navigates to the new dataset', async () => {
      setupHandlers();
      await renderDialog();

      submit();

      expect((await screen.findByTestId('dataset-probe')).textContent).toBe('created-dataset');
    });

    it('closes the dialog', async () => {
      setupHandlers();
      const { onOpenChange } = await renderDialog();

      submit();

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });

  describe('when the dataset is created with an onSuccess handler', () => {
    it('hands the new dataset id to onSuccess', async () => {
      setupHandlers();
      const onSuccess = vi.fn<(datasetId: string) => void>();
      await renderDialog({ onSuccess });

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('created-dataset'));
    });

    it('does not navigate', async () => {
      setupHandlers();
      const onSuccess = vi.fn<(datasetId: string) => void>();
      await renderDialog({ onSuccess });

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(screen.queryByTestId('dataset-probe')).toBeNull();
    });

    it('closes the dialog', async () => {
      setupHandlers();
      const onSuccess = vi.fn<(datasetId: string) => void>();
      const { onOpenChange } = await renderDialog({ onSuccess });

      submit();

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });

  describe('when the user cancels', () => {
    it('closes the dialog', async () => {
      setupHandlers();
      const { onOpenChange } = await renderDialog();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything()));
    });
  });
});
