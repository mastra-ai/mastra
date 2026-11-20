// @vitest-environment jsdom
import type { CreateDatasetParams } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CreateDatasetDialog } from '../create-dataset-dialog';
import { buildDataset } from './fixtures/datasets';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@/utils/toast', () => ({
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

type DialogProps = ComponentProps<typeof CreateDatasetDialog>;

async function renderDialog(props: Partial<DialogProps> = {}) {
  const onOpenChange = vi.fn<DialogProps['onOpenChange']>();
  const navigate = vi.fn();
  renderWithProviders(
    <TestLinkProvider navigate={navigate}>
      <CreateDatasetDialog open onOpenChange={onOpenChange} {...props} />
    </TestLinkProvider>,
  );
  await screen.findByRole('dialog', { name: 'Create new dataset' });
  return { onOpenChange, navigate };
}

const nameInput = () => screen.getByLabelText<HTMLInputElement>(/^Name/);
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create dataset' }));

describe('CreateDatasetDialog', () => {
  describe('when the dialog opens', () => {
    it('pre-fills the name with Dataset and a short id', async () => {
      setupHandlers();
      await renderDialog();

      expect(nameInput().value).toMatch(/^Dataset [0-9a-f]{4}$/);
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
  });

  describe('when the dataset is created without an onSuccess handler', () => {
    it('navigates to the new dataset', async () => {
      setupHandlers();
      const { navigate } = await renderDialog();

      submit();

      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/datasets/created-dataset'));
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
      const { navigate } = await renderDialog({ onSuccess });

      submit();

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(navigate).not.toHaveBeenCalled();
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
