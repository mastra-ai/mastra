import type { DatasetExperiment, SerializedRouteResponse, UpdateDatasetExperimentParams } from '@mastra/client-js';
import { RenameExperimentDialog } from '@mastra/playground-ui/domains/experiments';
import { useDatasetExperiment } from '@mastra/react/hooks/datasets';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { experiments } from '../../components/__tests__/fixtures/experiments';
import { useRenameExperiment } from '../use-rename-experiment';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type RenameBody = Omit<UpdateDatasetExperimentParams, 'datasetId' | 'experimentId'>;
type RenameResponse = SerializedRouteResponse<'PATCH /datasets/:datasetId/experiments/:experimentId'>;

const base: DatasetExperiment = {
  ...experiments[0],
  datasetId: 'dataset-1',
  name: 'Baseline run',
  description: 'First pass',
};

let current: DatasetExperiment = base;
const patchCalls: Array<{ datasetId: string; experimentId: string; body: RenameBody }> = [];

/** Mirrors the detail page: the title comes from the experiment query so a rename must refresh it. */
function Harness() {
  const { data } = useDatasetExperiment({
    datasetId: 'dataset-1',
    experimentId: base.id,
    queryOptions: { enabled: Boolean('dataset-1') && Boolean(base.id) },
  });
  const [open, setOpen] = useState(false);
  const renameHandlerFor = useRenameExperiment();
  if (!data) return null;
  const onRename = renameHandlerFor(data);
  return (
    <>
      <h1>{data.name || `Experiment #${data.id.slice(0, 8)}`}</h1>
      {onRename && <button onClick={() => setOpen(true)}>Rename</button>}
      {onRename && open && <RenameExperimentDialog experiment={data} open onOpenChange={setOpen} onRename={onRename} />}
    </>
  );
}

beforeEach(() => {
  current = base;
  patchCalls.length = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () => HttpResponse.json(current)),
    http.patch(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, async ({ params, request }) => {
      const body = (await request.json()) as RenameBody;
      patchCalls.push({ datasetId: String(params.datasetId), experimentId: String(params.experimentId), body });
      current = { ...current, ...body };
      const response: RenameResponse = current;
      return HttpResponse.json(response);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openDialog = async () => {
  renderWithProviders(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: /rename/i }));
  return screen.findByRole('dialog', { name: /rename experiment/i });
};

const nameInput = () => screen.getByLabelText<HTMLInputElement>(/^Name/);
const descriptionInput = () => screen.getByLabelText<HTMLInputElement>('Description');
const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('useRenameExperiment', () => {
  describe('when the rename is saved', () => {
    it('PATCHes the dataset-scoped experiment and refreshes the title', async () => {
      await openDialog();

      fireEvent.change(nameInput(), { target: { value: '  Renamed run  ' } });
      fireEvent.change(descriptionInput(), { target: { value: '' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(patchCalls).toHaveLength(1));
      expect(patchCalls[0]).toMatchObject({ datasetId: 'dataset-1', experimentId: base.id });
      expect(patchCalls[0].body).toEqual({ name: 'Renamed run', description: '' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await screen.findByRole('heading', { name: 'Renamed run' });
    });
  });

  describe('when the server rejects the rename', () => {
    beforeEach(() => {
      server.use(
        http.patch(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );
    });

    it('shows an error toast and keeps the dialog open', async () => {
      const toastError = vi.spyOn(toast, 'error');
      await openDialog();

      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          expect.stringMatching(/failed to rename experiment/i),
          expect.anything(),
        ),
      );
      expect(screen.getByRole('dialog', { name: /rename experiment/i })).toBeTruthy();
    });
  });

  describe('when the experiment belongs to no dataset', () => {
    beforeEach(() => {
      current = { ...base, datasetId: null };
    });

    it('offers no rename', async () => {
      renderWithProviders(<Harness />);

      expect(await screen.findByRole('heading', { name: 'Baseline run' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /rename/i })).toBeNull();
    });
  });
});
