import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { JSONImportDialog } from '../json-import-dialog';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

type CodeEditorProps = { value?: string; language?: string };

// CodeMirror doesn't render in jsdom; stub it so we can assert on the props it receives.
vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, language }: CodeEditorProps) => (
    <pre data-testid="code-editor" data-language={language}>
      {value}
    </pre>
  ),
}));

const DATASET_ID = 'ds-1';
const BATCH_URL = `${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items/batch`;

const renderDialog = (props: Partial<React.ComponentProps<typeof JSONImportDialog>> = {}) => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const result = renderWithProviders(
    <JSONImportDialog
      datasetId={DATASET_ID}
      datasetName="faz"
      open
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      {...props}
    />,
  );
  return { ...result, onOpenChange, onSuccess };
};

const pasteJSON = (text: string) => {
  fireEvent.click(screen.getByRole('tab', { name: 'Paste JSON' }));
  fireEvent.change(screen.getByLabelText('JSON items'), { target: { value: text } });
};

const uploadFile = async (name: string, content: string) => {
  const file = new File([content], name, { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Choose a JSON file'), { target: { files: [file] } });
  await screen.findByTestId('json-file-card');
};

const VALID_ITEMS = JSON.stringify([
  { input: 'a', groundTruth: 'A' },
  { input: 'b', groundTruth: 'B' },
  { input: 'c' },
]);

describe('JSONImportDialog', () => {
  it('renders the header, tabs, format reference and docs link', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Import into dataset' })).not.toBeNull();
    expect(screen.getByText('faz')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Upload file' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Paste JSON' })).not.toBeNull();

    expect(screen.getByText('input')).not.toBeNull();
    expect(screen.getByText('groundTruth')).not.toBeNull();
    expect(screen.getByText('metadata')).not.toBeNull();
    expect(screen.getAllByText('required')).toHaveLength(1);
    expect(screen.getAllByText('optional')).toHaveLength(2);

    expect(screen.getByTestId('code-editor').getAttribute('data-language')).toBe('json');

    const link = screen.getByRole('link', { name: /Datasets documentation/ });
    expect(link.getAttribute('href')).toBe('https://mastra.ai/docs/evals/datasets');
    expect(link.getAttribute('target')).toBe('_blank');

    expect(screen.getByRole('status').textContent).toBe('No items yet');
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('validates pasted JSON live and enables import when ready', () => {
    renderDialog();

    pasteJSON(VALID_ITEMS);
    expect(screen.getByRole('status').textContent).toBe('3 items ready · 1 without groundTruth');
    expect((screen.getByRole('button', { name: 'Import 3 items' }) as HTMLButtonElement).disabled).toBe(false);

    pasteJSON('{}');
    expect(screen.getByRole('status').textContent).toBe('Top level must be an array of items');

    pasteJSON('[{"x":1}]');
    expect(screen.getByRole('status').textContent).toBe('1 of 1 item has no input');

    pasteJSON('[');
    expect(screen.getByRole('status').textContent).toMatch(/^Not valid JSON — /);
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a file card with a preview after upload and restores the dropzone on Replace', async () => {
    renderDialog();

    const items = Array.from({ length: 12 }, (_, i) => ({ input: `q${i}`, groundTruth: i === 0 ? undefined : 'a' }));
    items.push({ input: '' } as (typeof items)[number]);
    await uploadFile('items.json', JSON.stringify(items));

    expect(screen.getByText('items.json')).not.toBeNull();
    expect(screen.getByText('q0')).not.toBeNull();
    expect(screen.getByText('q9')).not.toBeNull();
    expect(screen.queryByText('q10')).toBeNull();
    expect(screen.getByText('+ 3 more')).not.toBeNull();
    expect(screen.getByText('no groundTruth')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('1 of 13 items has no input');

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.queryByTestId('json-file-card')).toBeNull();
    expect(screen.getByTestId('json-dropzone')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('No items yet');
  });

  it('rejects non-json files with a footer error', () => {
    renderDialog();

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Choose a JSON file'), { target: { files: [file] } });

    expect(screen.getByRole('status').textContent).toBe('Not valid JSON — Only .json files are supported');
  });

  it('keeps each tab validation independent when switching', async () => {
    renderDialog();

    await uploadFile('items.json', VALID_ITEMS);
    expect(screen.getByRole('status').textContent).toBe('3 items ready · 1 without groundTruth');

    fireEvent.click(screen.getByRole('tab', { name: 'Paste JSON' }));
    expect(screen.getByRole('status').textContent).toBe('No items yet');

    fireEvent.click(screen.getByRole('tab', { name: 'Upload file' }));
    expect(screen.getByRole('status').textContent).toBe('3 items ready · 1 without groundTruth');
  });

  it('imports the validated items and closes the dialog', async () => {
    const onPost = vi.fn<(body: unknown) => void>();
    server.use(
      http.post(BATCH_URL, async ({ request }) => {
        onPost(await request.json());
        return HttpResponse.json({ items: [], count: 3 });
      }),
    );

    const { onOpenChange, onSuccess, queryClient } = renderDialog();
    pasteJSON(VALID_ITEMS);
    fireEvent.click(screen.getByRole('button', { name: 'Import 3 items' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitForMutationsIdle(queryClient);

    expect(onPost).toHaveBeenCalledWith({
      items: [{ input: 'a', groundTruth: 'A' }, { input: 'b', groundTruth: 'B' }, { input: 'c' }],
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('copies the example JSON and flips the button label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await screen.findByRole('button', { name: 'Copied' });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"input": "How do I reset my password?"'));
  });
});
