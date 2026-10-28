import type { CodeEditorProps } from '@mastra/playground-ui/components/CodeEditor';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JSONImportDialog } from '../json-import-dialog';
import { batchInsertResponse } from './fixtures/json-import';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

// CodeMirror doesn't render in jsdom; stub it so we can assert on the props it receives.
vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, language, onChange, editable = true, 'aria-label': label }: CodeEditorProps) =>
    onChange ? (
      <textarea
        aria-label={label}
        value={value}
        readOnly={!editable}
        onChange={event => onChange(event.target.value)}
      />
    ) : (
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
  const dialog = (open: boolean) => (
    <JSONImportDialog
      datasetId={DATASET_ID}
      datasetName="faz"
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      {...props}
      open={open}
    />
  );
  const result = renderWithProviders(dialog(props.open ?? true));
  const setOpen = (open: boolean) => result.rerender(dialog(open));
  return { ...result, onOpenChange, onSuccess, setOpen };
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
  describe('when its parent closes the dialog', () => {
    it('starts with an empty upload and paste form on the next open', async () => {
      const { setOpen } = renderDialog();
      await uploadFile('items.json', VALID_ITEMS);
      pasteJSON(VALID_ITEMS);

      setOpen(false);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      setOpen(true);

      expect(screen.getByRole('tab', { name: 'Upload file' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('json-dropzone')).not.toBeNull();
      expect(screen.queryByTestId('json-file-card')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('No items yet');
      fireEvent.click(screen.getByRole('tab', { name: 'Paste JSON' }));
      expect(screen.getByLabelText<HTMLTextAreaElement>('JSON items').value).toBe('');
    });
  });

  describe.each(['Cancel', 'Import'] as const)('when reopened after %s', action => {
    afterEach(() => {
      cleanup();
      vi.useRealTimers();
    });

    it('preserves a new draft after the previous dialog has closed', async () => {
      let resolveImport = () => {};
      const imported = new Promise<void>(resolve => {
        resolveImport = resolve;
      });
      server.use(http.post(BATCH_URL, () => HttpResponse.json(batchInsertResponse)));
      const { onOpenChange, setOpen } = renderDialog({ onSuccess: resolveImport });
      pasteJSON(VALID_ITEMS);

      // Advance time explicitly so the old 150 ms reset cannot race this assertion.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: action === 'Import' ? 'Import 3 items' : 'Cancel' }));
        if (action === 'Import') await imported;
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      setOpen(false);
      await act(async () => vi.advanceTimersToNextFrame());
      expect(screen.queryByRole('dialog')).toBeNull();
      setOpen(true);

      const nextDraft = '[{"input":"next import"}]';
      pasteJSON(nextDraft);
      await act(async () => vi.advanceTimersByTimeAsync(1000));

      expect(screen.getByLabelText<HTMLTextAreaElement>('JSON items').value).toBe(nextDraft);
      expect(screen.getByRole('status').textContent).toBe('1 item ready · 1 without groundTruth');
    });
  });

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

    pasteJSON('[]');
    expect(screen.getByRole('status').textContent).toBe('The array has no items');

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

  it('discards a file read that resolves after a newer selection', async () => {
    renderDialog();

    const OriginalFileReader = globalThis.FileReader;
    let releaseRead: (() => void) | undefined;
    class DelayedFileReader extends OriginalFileReader {
      readAsText(file: Blob) {
        releaseRead = () => super.readAsText(file);
      }
    }
    vi.stubGlobal('FileReader', DelayedFileReader);

    try {
      const slow = new File([VALID_ITEMS], 'slow.json', { type: 'application/json' });
      fireEvent.change(screen.getByLabelText('Choose a JSON file'), { target: { files: [slow] } });
      expect(releaseRead).toBeDefined();

      vi.stubGlobal('FileReader', OriginalFileReader);
      await uploadFile('fast.json', '[{"input":"only"}]');
      expect(screen.getByRole('status').textContent).toBe('1 item ready · 1 without groundTruth');

      releaseRead!();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(screen.getByText('fast.json')).not.toBeNull();
      expect(screen.queryByText('slow.json')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('1 item ready · 1 without groundTruth');
    } finally {
      vi.unstubAllGlobals();
    }
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
        return HttpResponse.json(batchInsertResponse);
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

  it('locks the paste editor while the import is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.post(BATCH_URL, async () => {
        await held;
        return HttpResponse.json(batchInsertResponse);
      }),
    );

    const { queryClient } = renderDialog();
    pasteJSON(VALID_ITEMS);
    const editor = screen.getByLabelText('JSON items') as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Import 3 items' }));
    await waitFor(() => expect(editor.readOnly).toBe(true));

    release();
    await waitForMutationsIdle(queryClient);
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
