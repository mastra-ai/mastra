import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenameExperimentButton } from '../rename-experiment-button';
import { experiments } from './fixtures/experiments';
import { useDatasetExperiment } from '@/domains/datasets/hooks/use-dataset-experiments';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const base = { ...experiments[0], datasetId: 'dataset-1', name: 'Baseline run', description: 'First pass' };

let current = base;
const patchCalls: Array<{ datasetId: string; experimentId: string; body: Record<string, unknown> }> = [];

/** Mirrors the detail page: the title comes from the experiment query so a rename must refresh it. */
function Harness() {
  const { data } = useDatasetExperiment('dataset-1', base.id);
  if (!data) return null;
  return (
    <>
      <h1>{data.name || `Experiment #${data.id.slice(0, 8)}`}</h1>
      <RenameExperimentButton experiment={data} />
    </>
  );
}

beforeEach(() => {
  current = base;
  patchCalls.length = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () => HttpResponse.json(current)),
    http.patch(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patchCalls.push({ datasetId: String(params.datasetId), experimentId: String(params.experimentId), body });
      current = { ...current, ...body } as typeof base;
      return HttpResponse.json(current);
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

const nameInput = () => screen.getByLabelText('Name *') as HTMLInputElement;
const descriptionInput = () => screen.getByLabelText('Description') as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('RenameExperimentButton', () => {
  it('should open the dialog prefilled with the current name and description', async () => {
    await openDialog();

    expect(nameInput().value).toBe('Baseline run');
    expect(descriptionInput().value).toBe('First pass');
  });

  it('should disable Save when the name is empty', async () => {
    await openDialog();

    fireEvent.change(nameInput(), { target: { value: '   ' } });

    expect(saveButton().disabled).toBe(true);
  });

  it('should PATCH the new name and refresh the title', async () => {
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

  it('should show an error toast when the update fails', async () => {
    const toastError = vi.spyOn(toast, 'error');
    server.use(
      http.patch(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    await openDialog();

    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/failed to rename experiment/i), expect.anything()),
    );
    expect(screen.getByRole('dialog', { name: /rename experiment/i })).toBeTruthy();
  });
});
