import type { DatasetRecord } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CSVImportDialog } from '../csv-import-dialog';
import {
  batchInsertResponse,
  buildCsvDataset,
  buildCsvFile,
  CSV_DATASET_ID,
  datasetWithInputSchema,
  HEADERS_ONLY_CSV,
} from './fixtures/csv-import';
import { simulateDrop } from '@/test/mock-hello-pangea-dnd';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

vi.mock('@hello-pangea/dnd', () => import('@/test/mock-hello-pangea-dnd'));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const DATASET_URL = `${TEST_BASE_URL}/api/datasets/${CSV_DATASET_ID}`;

function givenDataset(dataset: DatasetRecord) {
  const batchBodies: unknown[] = [];
  server.use(
    http.get(DATASET_URL, () => HttpResponse.json(dataset)),
    http.post(`${DATASET_URL}/items/batch`, async ({ request }) => {
      batchBodies.push(await request.json());
      return HttpResponse.json(batchInsertResponse);
    }),
  );
  return { batchBodies };
}

function renderDialog() {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const result = renderWithProviders(
    <CSVImportDialog datasetId={CSV_DATASET_ID} open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
  );
  return { ...result, onOpenChange, onSuccess };
}

const heading = (name: string) => screen.findByRole('heading', { name });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function expectDisabled(name: string | RegExp) {
  const target = screen.getByRole<HTMLButtonElement>('button', { name });
  expect(target.disabled).toBe(true);
}

type DragEventType = 'dragenter' | 'dragover' | 'drop';

function dropOnWindow(file: File) {
  const fire = (type: DragEventType) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files: [file] } });
    act(() => {
      fireEvent(window, event);
    });
  };
  fire('dragenter');
  fire('dragover');
  fire('drop');
}

async function uploadAndMapColumns(file = buildCsvFile()) {
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
  await heading('Preview Data');
  click('Next');
  await heading('Map Columns');
  simulateDrop('question', 'input');
  simulateDrop('answer', 'groundTruth');
  simulateDrop('source', 'metadata');
}

describe('CSVImportDialog', () => {
  describe('when the dataset has no schema', () => {
    it('imports every mapped row in a single batch request', async () => {
      const { batchBodies } = givenDataset(buildCsvDataset());
      const { queryClient } = renderDialog();

      await uploadAndMapColumns();
      click('Next');
      await heading('Review Validation');
      click('Import 2 Rows');
      await heading('Import Complete');
      await waitForMutationsIdle(queryClient);

      expect(batchBodies).toEqual([
        {
          items: [
            { input: 'What is the capital of France?', groundTruth: 'Paris', metadata: { source: 'geo' } },
            { input: 'Too short', groundTruth: '4', metadata: { source: 'math' } },
          ],
        },
      ]);
    });

    it('closes, reports the import and calls onSuccess once on Done', async () => {
      givenDataset(buildCsvDataset());
      const { onOpenChange, onSuccess, queryClient } = renderDialog();

      await uploadAndMapColumns();
      click('Next');
      await heading('Review Validation');
      click('Import 2 Rows');
      await heading('Import Complete');
      await waitForMutationsIdle(queryClient);
      click('Done');

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Imported 2 rows');
    });

    it('closes without importing when Cancel is clicked on the upload step', async () => {
      const { batchBodies } = givenDataset(buildCsvDataset());
      const { onOpenChange, onSuccess } = renderDialog();

      await heading('Import CSV');
      click('Cancel');

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(batchBodies).toEqual([]);
    });

    it('opens the file picker from the Choose a file button', async () => {
      givenDataset(buildCsvDataset());
      renderDialog();
      await heading('Import CSV');
      const openPicker = vi.spyOn(screen.getByLabelText<HTMLInputElement>('CSV file'), 'click');

      click('Choose a file');

      expect(openPicker).toHaveBeenCalledTimes(1);
    });

    it('keeps Next disabled until a column is mapped to Input', async () => {
      givenDataset(buildCsvDataset());
      renderDialog();

      fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [buildCsvFile()] } });
      await heading('Preview Data');
      click('Next');
      await heading('Map Columns');

      expectDisabled('Next');
    });
  });

  describe('when a CSV file is dropped anywhere on the window', () => {
    it('parses it and shows the preview', async () => {
      givenDataset(buildCsvDataset());
      renderDialog();
      await heading('Import CSV');

      dropOnWindow(buildCsvFile());

      expect(await heading('Preview Data')).toBeDefined();
    });
  });

  describe('when a file that is not a CSV is dropped on the window', () => {
    it('stays on the upload step', async () => {
      givenDataset(buildCsvDataset());
      renderDialog();
      await heading('Import CSV');

      dropOnWindow(new File(['just some notes'], 'notes.txt', { type: 'text/plain' }));

      expect(screen.getByRole('heading', { name: 'Import CSV' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Preview Data' })).toBeNull();
    });
  });

  describe('when the CSV has no data rows', () => {
    it('keeps Import disabled', async () => {
      const { batchBodies } = givenDataset(buildCsvDataset());
      renderDialog();

      await uploadAndMapColumns(buildCsvFile(HEADERS_ONLY_CSV));
      click('Next');
      await heading('Review Validation');

      expectDisabled('Import 0 Rows');
      expect(batchBodies).toEqual([]);
    });
  });

  describe('when the dataset has an input schema', () => {
    it('skips rows that fail the schema and imports the valid ones', async () => {
      const { batchBodies } = givenDataset(datasetWithInputSchema);
      const { queryClient } = renderDialog();

      await uploadAndMapColumns();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Validate' })).toBeDefined());
      click('Validate');
      await heading('Review Validation');
      expect(screen.getByText('1 row will be skipped')).toBeDefined();

      click('Import 1 Valid Row');
      await heading('Import Complete');
      await waitForMutationsIdle(queryClient);

      expect(batchBodies).toEqual([
        {
          items: [{ input: 'What is the capital of France?', groundTruth: 'Paris', metadata: { source: 'geo' } }],
        },
      ]);
    });
  });
});
