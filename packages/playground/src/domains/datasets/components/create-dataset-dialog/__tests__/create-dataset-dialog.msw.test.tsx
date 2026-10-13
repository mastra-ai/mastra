import type { CodeEditorProps } from '@mastra/playground-ui/components/CodeEditor';
import { toast } from '@mastra/playground-ui/utils/toast';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CreateDatasetDialog } from '../create-dataset-dialog';
import type { CreateDatasetDialogProps } from '../create-dataset-dialog';
import {
  batchInsertResponse,
  buildFile,
  CREATED_DATASET_ID,
  createdDataset,
  emptyAgents,
  emptyWorkflows,
} from './fixtures/create-dataset-dialog';
import { simulateDrop } from '@/test/mock-hello-pangea-dnd';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

vi.mock('@hello-pangea/dnd', () => import('@/test/mock-hello-pangea-dnd'));
vi.mock('@mastra/playground-ui/components/Combobox', () => import('@/test/mock-combobox'));

// CodeMirror doesn't render in jsdom; a labelled textarea keeps the editor drivable.
vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, 'aria-label': label }: CodeEditorProps) => (
    <textarea aria-label={label} value={value} onChange={event => onChange?.(event.target.value)} />
  ),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const DATASETS_URL = `${TEST_BASE_URL}/api/datasets`;
const BATCH_URL = `${DATASETS_URL}/${CREATED_DATASET_ID}/items/batch`;

interface Handlers {
  createStatus?: number;
  batchStatus?: number;
}

function givenServer({ createStatus = 200, batchStatus = 200 }: Handlers = {}) {
  const createBodies: Array<Record<string, unknown>> = [];
  const batchBodies: unknown[] = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(emptyAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(emptyWorkflows)),
    http.post(DATASETS_URL, async ({ request }) => {
      createBodies.push((await request.json()) as Record<string, unknown>);
      if (createStatus !== 200) return HttpResponse.json({ error: 'boom' }, { status: createStatus });
      return HttpResponse.json(createdDataset);
    }),
    http.post(BATCH_URL, async ({ request }) => {
      batchBodies.push(await request.json());
      if (batchStatus !== 200) return HttpResponse.json({ error: 'boom' }, { status: batchStatus });
      return HttpResponse.json(batchInsertResponse);
    }),
  );

  return { createBodies, batchBodies };
}

function renderDialog(props: Partial<CreateDatasetDialogProps> = {}) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const result = renderWithProviders(
    <CreateDatasetDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />,
  );
  return { ...result, onOpenChange, onSuccess };
}

const heading = (name: string) => screen.findByRole('heading', { name });
const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });
const click = (name: string | RegExp) => fireEvent.click(button(name));
const typeIn = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const schemaEditor = (name: string) => screen.getByLabelText<HTMLTextAreaElement>(name);
const OBJECT_SCHEMA = '{"type":"object"}';

function pickSource(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Import from' }));
  fireEvent.pointerDown(screen.getByRole('option', { name }), { pointerType: 'mouse' });
  fireEvent.click(screen.getByRole('option', { name }), { detail: 1 });
}

// A disabled button cannot take focus, so its explanation lives on a focusable wrapper.
async function expectDisabledBecause(name: string | RegExp, reason: string) {
  const target = button(name);
  expect(target.disabled).toBe(true);
  act(() => {
    (target.parentElement as HTMLElement).focus();
  });
  expect(await screen.findByText(reason)).toBeDefined();
}

async function fillDetails(name = 'My dataset') {
  await heading('Create dataset');
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: name } });
  click('Next');
  await heading('Choose a schema');
}

async function goToItems() {
  await fillDetails();
  click('Next');
  await heading('Add items');
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

async function uploadAndMapCsv() {
  click('Import from CSV');
  await heading('Import CSV');
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [buildFile()] } });
  await heading('Preview Data');
  click('Next');
  await heading('Map Columns');
  simulateDrop('question', 'input');
  simulateDrop('answer', 'groundTruth');
  // The mapping step reads "Validate" when the dataset has a schema.
  click(/^(Next|Validate)$/);
}

describe('CreateDatasetDialog', () => {
  describe('when the dialog opens', () => {
    it('starts with an empty name and Next disabled, and says why', async () => {
      const { createBodies } = givenServer();
      renderDialog();

      await heading('Create dataset');

      expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
      await expectDisabledBecause('Next', 'Enter a dataset name to continue');
      expect(createBodies).toEqual([]);
    });

    it('tells the user this is the first of three steps', async () => {
      givenServer();
      renderDialog();

      await heading('Create dataset');

      expect(screen.getByText('Step 1 of 3')).toBeDefined();
    });

    it('does not ask for default scorers', async () => {
      givenServer();
      renderDialog();

      await heading('Create dataset');

      expect(screen.queryByText('Default scorers')).toBeNull();
    });
  });

  describe('when the details are filled in', () => {
    it('moves on to the second step without creating the dataset', async () => {
      const { createBodies } = givenServer();
      renderDialog();

      await fillDetails();

      expect(screen.getByText('Step 2 of 3')).toBeDefined();
      expect(createBodies).toEqual([]);
    });

    it('shows the schema fields directly, without a collapsible section', async () => {
      givenServer();
      renderDialog();

      await fillDetails();

      expect(schemaEditor('Input schema')).toBeDefined();
      expect(screen.queryByRole('button', { name: /schema configuration/i })).toBeNull();
    });

    it('offers one tab per schema, starting on an empty Input schema', async () => {
      givenServer();
      renderDialog();

      await fillDetails();

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Input',
        'Ground truth',
        'Request context',
      ]);
      expect(screen.getByRole('tab', { name: 'Input' }).getAttribute('aria-selected')).toBe('true');
      expect(schemaEditor('Input schema').value).toBe('');
      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('labels the source picker with a visible "Import from" label', async () => {
      givenServer();
      renderDialog();

      await fillDetails();

      const label = screen.getByText('Import from');
      expect(label.tagName).toBe('LABEL');
      expect(screen.getByRole('combobox', { name: 'Import from' })).toBeDefined();
    });

    it('explains what the selected schema checks', async () => {
      givenServer();
      renderDialog();

      await fillDetails();
      expect(screen.getByText("Checks every item's input")).toBeDefined();
      fireEvent.click(screen.getByRole('tab', { name: 'Ground truth' }));
      expect(screen.getByText("Checks every item's expected output")).toBeDefined();
      fireEvent.click(screen.getByRole('tab', { name: 'Request context' }));
      expect(screen.getByText('Describes what experiments can pass to the target')).toBeDefined();
    });

    it('marks the step as optional with a badge next to its title', async () => {
      givenServer();
      renderDialog();

      await fillDetails();

      const title = await heading('Choose a schema');
      expect(screen.getByText('Optional').parentElement?.contains(title)).toBe(true);
      expect(screen.getByText(/^Schemas validate/)).toBeDefined();
    });

    it('only offers to go back or forward', async () => {
      givenServer();
      renderDialog();

      await fillDetails();

      expect(button('Next').disabled).toBe(false);
      expect(button('Back')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
      expect(screen.queryByRole('button', { name: /create/i })).toBeNull();
    });

    it('goes back to the details with the name kept', async () => {
      givenServer();
      renderDialog();

      await fillDetails('Kept name');
      click('Back');
      await heading('Create dataset');

      expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Kept name');
    });
  });

  describe('when the user reaches the last step', () => {
    it('still has not created the dataset, and offers to create it', async () => {
      const { createBodies } = givenServer();
      renderDialog();

      await goToItems();

      expect(screen.getByText('Step 3 of 3')).toBeDefined();
      expect(button('Create dataset')).toBeDefined();
      expect(button('Back')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
      expect(createBodies).toEqual([]);
    });

    it('describes each way of adding items', async () => {
      givenServer();
      renderDialog();

      await goToItems();

      expect(
        screen.getByRole('button', { name: 'Add items manually', description: /input and ground truth/i }),
      ).toBeDefined();
      expect(screen.getByRole('button', { name: 'Import from CSV', description: /drop it anywhere/i })).toBeDefined();
    });

    it('goes back through every step with the choices kept', async () => {
      givenServer();
      renderDialog();

      await fillDetails();
      typeIn('Input schema', OBJECT_SCHEMA);
      click('Next');
      await heading('Add items');
      click('Back');
      await heading('Choose a schema');

      expect(JSON.parse(schemaEditor('Input schema').value)).toEqual({ type: 'object' });

      click('Back');
      await heading('Create dataset');

      expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('My dataset');
    });
  });

  describe('when the dataset is created without items', () => {
    it('creates it with the trimmed details, calls onSuccess once and closes', async () => {
      const { createBodies, batchBodies } = givenServer();
      const { onOpenChange, onSuccess, queryClient } = renderDialog();

      await heading('Create dataset');
      typeIn('Description', ' Some notes ');
      await goToItems();
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(CREATED_DATASET_ID));
      await waitForMutationsIdle(queryClient);

      expect(createBodies).toEqual([{ name: 'My dataset', description: 'Some notes' }]);
      expect(batchBodies).toEqual([]);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(toast.success).toHaveBeenCalledWith('Dataset created');
    });

    it('keeps the line breaks of a multi-line description', async () => {
      const { createBodies } = givenServer();
      const { onSuccess } = renderDialog();

      await heading('Create dataset');
      typeIn('Description', 'First line\nSecond line');
      await goToItems();
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(createBodies).toEqual([{ name: 'My dataset', description: 'First line\nSecond line' }]);
    });

    it('sends targetType and targetIds when they are given', async () => {
      const { createBodies } = givenServer();
      const { onSuccess } = renderDialog({ targetType: 'workflow', targetIds: ['my-wf', 'other-wf'] });

      await goToItems();
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(createBodies[0].targetType).toBe('workflow');
      expect(createBodies[0].targetIds).toEqual(['my-wf', 'other-wf']);
    });
  });

  describe('when a schema is typed in', () => {
    it('creates the dataset with that schema on the last step', async () => {
      const { createBodies } = givenServer();
      const { onSuccess } = renderDialog();

      await fillDetails();
      typeIn('Input schema', OBJECT_SCHEMA);
      click('Next');
      await heading('Add items');
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(createBodies).toHaveLength(1);
      expect(createBodies[0].inputSchema).toEqual({ type: 'object' });
      expect(createBodies[0]).not.toHaveProperty('groundTruthSchema');
    });

    it('sends the schema typed in another tab', async () => {
      const { createBodies } = givenServer();
      const { onSuccess } = renderDialog();

      await fillDetails();
      fireEvent.click(screen.getByRole('tab', { name: 'Ground truth' }));
      typeIn('Ground truth schema', OBJECT_SCHEMA);
      click('Next');
      await heading('Add items');
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(createBodies[0].groundTruthSchema).toEqual({ type: 'object' });
      expect(createBodies[0]).not.toHaveProperty('inputSchema');
    });

    it('keeps an unfinished schema when switching tabs', async () => {
      givenServer();
      renderDialog();

      await fillDetails();
      typeIn('Input schema', '{"type":');
      fireEvent.click(screen.getByRole('tab', { name: 'Request context' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Input' }));

      expect(schemaEditor('Input schema').value).toBe('{"type":');
      expect(screen.getByText('Invalid JSON')).toBeDefined();
    });
  });

  describe('when a schema is cleared', () => {
    it('creates the dataset without it', async () => {
      const { createBodies } = givenServer();
      const { onSuccess } = renderDialog();

      await fillDetails();
      typeIn('Input schema', OBJECT_SCHEMA);
      typeIn('Input schema', '');
      click('Next');
      await heading('Add items');
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(createBodies[0]).not.toHaveProperty('inputSchema');
    });
  });

  describe('when the schemas are imported from an agent', () => {
    it('fills the input and ground truth editors', async () => {
      givenServer();
      renderDialog();

      await fillDetails();
      pickSource('Agent');

      await waitFor(() => expect(schemaEditor('Input schema').value).toMatch(/MessageListInput/));
      fireEvent.click(screen.getByRole('tab', { name: 'Ground truth' }));
      expect(schemaEditor('Ground truth schema').value).not.toBe('');
    });
  });

  describe('when the schema is changed after reaching the last step', () => {
    it('creates a single dataset with the latest schema', async () => {
      const { createBodies } = givenServer();
      const { onSuccess } = renderDialog();

      await goToItems();
      click('Back');
      await heading('Choose a schema');
      typeIn('Input schema', OBJECT_SCHEMA);
      click('Next');
      await heading('Add items');
      click('Create dataset');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(createBodies).toHaveLength(1);
      expect(createBodies[0].inputSchema).toEqual({ type: 'object' });
    });
  });

  describe('when the dialog is closed before the dataset is created', () => {
    it('closes from the first step without calling onSuccess', async () => {
      const { createBodies } = givenServer();
      const { onOpenChange, onSuccess } = renderDialog();

      await heading('Create dataset');
      click('Cancel');

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(createBodies).toEqual([]);
    });

    it('closes from the last step without creating anything', async () => {
      const { createBodies } = givenServer();
      const { onOpenChange, onSuccess } = renderDialog();

      await goToItems();
      click('Close');

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(createBodies).toEqual([]);
    });
  });

  describe('when dataset creation fails', () => {
    it('stays on the last step, reports the error and does not call onSuccess', async () => {
      givenServer({ createStatus: 500 });
      const { onSuccess, queryClient } = renderDialog();

      await goToItems();
      click('Create dataset');
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      await waitForMutationsIdle(queryClient);

      expect(screen.getByRole('heading', { name: 'Add items' })).toBeDefined();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('when the dataset takes a moment to be created', () => {
    it('keeps the dialog busy until it exists', async () => {
      givenServer();
      let respond = () => {};
      server.use(
        http.post(DATASETS_URL, async () => {
          await new Promise<void>(resolve => {
            respond = resolve;
          });
          return HttpResponse.json(createdDataset);
        }),
      );
      const { onSuccess } = renderDialog();

      await goToItems();
      click('Create dataset');
      await waitFor(() => expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBe('true'));

      expect(button('Close').disabled).toBe(true);

      respond();
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(CREATED_DATASET_ID));
    });
  });

  describe('when items are added manually', () => {
    it('creates the dataset, then sends one batch with the parsed rows', async () => {
      const { createBodies, batchBodies } = givenServer();
      const { onOpenChange, onSuccess, queryClient } = renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');

      expect(screen.getByText('Step 3 of 3')).toBeDefined();

      typeIn('Item 1 input', '{"question":"What is the capital of France?"}');
      typeIn('Item 1 ground truth', '"Paris"');
      click('Add another item');
      typeIn('Item 2 input', '"What is 2 + 2?"');
      click('Create dataset with 2 items');

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(CREATED_DATASET_ID));
      await waitForMutationsIdle(queryClient);

      expect(createBodies).toEqual([{ name: 'My dataset' }]);
      expect(batchBodies).toEqual([
        {
          items: [
            { input: { question: 'What is the capital of France?' }, groundTruth: 'Paris' },
            { input: 'What is 2 + 2?' },
          ],
        },
      ]);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(toast.success).toHaveBeenCalledWith('Dataset created with 2 items');
    });

    it('drops a removed row from the batch', async () => {
      const { batchBodies } = givenServer();
      const { onSuccess, queryClient } = renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      typeIn('Item 1 input', '"keep me"');
      click('Add another item');
      typeIn('Item 2 input', '"remove me"');
      click('Remove item 2');
      click('Create dataset with 1 item');

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      await waitForMutationsIdle(queryClient);

      expect(batchBodies).toEqual([{ items: [{ input: 'keep me' }] }]);
    });

    it('shows an inline error for invalid JSON and creates nothing', async () => {
      const { createBodies, batchBodies } = givenServer();
      const { onSuccess } = renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      typeIn('Item 1 input', '{not json');
      click('Create dataset with 1 item');

      expect(await screen.findByText('Input must be valid JSON')).toBeDefined();
      expect(createBodies).toEqual([]);
      expect(batchBodies).toEqual([]);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('keeps the action disabled until every row has an input, and says why', async () => {
      givenServer();
      renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      typeIn('Item 1 input', '"filled"');
      click('Add another item');

      await expectDisabledBecause('Create dataset with 2 items', 'Fill in the input of every item');
    });

    it('goes back to the choice of how to add items', async () => {
      givenServer();
      renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      click('Back');

      expect(await heading('Add items')).toBeDefined();
    });
  });

  describe('when the items fail to be added', () => {
    it('reports the error and keeps the rows the user entered', async () => {
      givenServer({ batchStatus: 500 });
      const { onSuccess, queryClient } = renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      typeIn('Item 1 input', '"kept"');
      click('Create dataset with 1 item');

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      await waitForMutationsIdle(queryClient);

      expect(screen.getByLabelText<HTMLTextAreaElement>('Item 1 input').value).toBe('"kept"');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('retries only the items, without creating a second dataset', async () => {
      const { createBodies } = givenServer({ batchStatus: 500 });
      const { onSuccess, queryClient } = renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      typeIn('Item 1 input', '"kept"');
      click('Create dataset with 1 item');
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      await waitForMutationsIdle(queryClient);

      server.use(http.post(BATCH_URL, () => HttpResponse.json(batchInsertResponse)));
      click('Create dataset with 1 item');

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(CREATED_DATASET_ID));

      expect(createBodies).toHaveLength(1);
    });

    it('reports the dataset when the user closes the dialog', async () => {
      givenServer({ batchStatus: 500 });
      const { onSuccess, queryClient } = renderDialog();

      await goToItems();
      click('Add items manually');
      await heading('Add items manually');
      typeIn('Item 1 input', '"kept"');
      click('Create dataset with 1 item');
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      await waitForMutationsIdle(queryClient);
      click('Close');

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(CREATED_DATASET_ID);
    });
  });

  describe('when a CSV file is chosen', () => {
    it('creates the dataset with the mapped rows and calls onSuccess on Done', async () => {
      const { createBodies, batchBodies } = givenServer();
      const { onOpenChange, onSuccess, queryClient } = renderDialog();

      await goToItems();
      await uploadAndMapCsv();
      await heading('Review Validation');
      click('Create dataset with 2 items');
      await heading('Import Complete');
      await waitForMutationsIdle(queryClient);
      click('Done');

      expect(createBodies).toEqual([{ name: 'My dataset' }]);
      expect(batchBodies).toEqual([
        {
          items: [
            { input: 'What is the capital of France?', groundTruth: 'Paris' },
            { input: 'What is 2 + 2?', groundTruth: '4' },
          ],
        },
      ]);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(CREATED_DATASET_ID);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows Next on the upload step, disabled until a file is chosen', async () => {
      givenServer();
      renderDialog();

      await goToItems();
      click('Import from CSV');
      await heading('Import CSV');

      expect(screen.getByText('Step 3 of 3')).toBeDefined();
      await expectDisabledBecause('Next', 'Upload a CSV file to continue');
    });

    it('goes back to the "Add items" step from the upload step', async () => {
      givenServer();
      renderDialog();

      await goToItems();
      click('Import from CSV');
      await heading('Import CSV');
      click('Back');

      expect(await heading('Add items')).toBeDefined();
    });
  });

  describe('when a schema was chosen before importing a CSV', () => {
    it('validates the rows against it before anything is created', async () => {
      const { createBodies } = givenServer();
      renderDialog();

      await fillDetails();
      typeIn('Input schema', OBJECT_SCHEMA);
      click('Next');
      await heading('Add items');
      await uploadAndMapCsv();

      expect(await screen.findByText(/All rows failed schema validation/)).toBeDefined();
      expect(createBodies).toEqual([]);
    });
  });

  describe('when a CSV file is dropped on the window', () => {
    it('goes straight to the preview step', async () => {
      givenServer();
      renderDialog();

      await goToItems();
      dropOnWindow(buildFile());

      expect(await heading('Preview Data')).toBeDefined();
      expect(screen.getByText('What is the capital of France?')).toBeDefined();
    });

    it('ignores a file that is not a CSV', async () => {
      givenServer();
      renderDialog();

      await goToItems();
      dropOnWindow(buildFile('{}', 'items.json', 'application/json'));

      expect(screen.getByRole('heading', { name: 'Add items' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Preview Data' })).toBeNull();
    });
  });

  describe('when the dialog is reopened', () => {
    it('starts over on the first step', async () => {
      givenServer();
      const { rerender, onOpenChange, onSuccess } = renderDialog();

      await goToItems();
      rerender(<CreateDatasetDialog open={false} onOpenChange={onOpenChange} onSuccess={onSuccess} />);
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add items' })).toBeNull());
      rerender(<CreateDatasetDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />);

      expect(await heading('Create dataset')).toBeDefined();
      expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
    });

    it('starts over after a creation, and reports the dataset only once', async () => {
      givenServer();
      const { rerender, onOpenChange, onSuccess } = renderDialog();

      await goToItems();
      click('Create dataset');
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      rerender(<CreateDatasetDialog open={false} onOpenChange={onOpenChange} onSuccess={onSuccess} />);
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add items' })).toBeNull());
      rerender(<CreateDatasetDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />);

      expect(await heading('Create dataset')).toBeDefined();
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
