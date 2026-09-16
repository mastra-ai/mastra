// @vitest-environment jsdom
import { toast } from '@mastra/playground-ui/utils/toast';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent, PropsWithChildren } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddItemDialog } from '../add-item-dialog';
import {
  createdDatasetItem,
  createdDatasetItemWithEmptyScorers,
  createdDatasetItemWithScorers,
  createdDatasetItemWithoutMocks,
} from './fixtures/add-item';
import { itemScorers } from './fixtures/item-scorers';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Thin stub for the heavy SideDialog atom so this test focuses on the real client + mutation behavior.
vi.mock('@mastra/playground-ui/components/SideDialog', () => {
  const SideDialogRoot = ({
    isOpen,
    onClose,
    dialogTitle,
    dialogDescription,
    children,
  }: PropsWithChildren<{ isOpen: boolean; onClose: () => void; dialogTitle: string; dialogDescription: string }>) =>
    isOpen ? (
      <div role="dialog" aria-label={dialogTitle} aria-description={dialogDescription}>
        {children}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null;

  const SideDialog = Object.assign(SideDialogRoot, {
    Top: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Content: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Header: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Heading: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  });

  return { SideDialog };
});

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      value={value ?? ''}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AddItemDialog datasetId="dataset-1" open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function ReopenableDialog() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen dialog
      </button>
      <AddItemDialog datasetId="dataset-1" open={open} onOpenChange={setOpen} />
    </>
  );
}

function renderReopenableDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ReopenableDialog />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

/** The form has a known order of CodeEditors: input, groundTruth, expectedTrajectory, toolMocks, requestContext. */
function getEditors() {
  return screen.getAllByRole<HTMLTextAreaElement>('textbox');
}

const useScorerHandler = () => {
  server.use(http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(itemScorers)));
};

const selectScorer = async (name: string) => {
  const selector = await screen.findByRole('combobox');
  await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(false));
  fireEvent.click(selector);
  const option = await screen.findByRole('option', { name: new RegExp(name, 'i') });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
};

describe('AddItemDialog', () => {
  describe('when the form is open', () => {
    it('renders spacious JSON editors in a named and described side dialog', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog', { name: 'Add Item' });
      expect(dialog.getAttribute('aria-description')).toBe('Create a new dataset item');

      const [input, ...optionalEditors] = getEditors();
      expect(input.parentElement?.classList.contains('min-h-[240px]')).toBe(true);
      expect(optionalEditors).toHaveLength(4);
      optionalEditors.forEach(editor => {
        expect(editor.parentElement?.classList.contains('min-h-[200px]')).toBe(true);
      });
      expect(screen.queryByRole('button', { name: 'Copy to clipboard' })).toBeNull();
    });
  });

  describe('when valid tool mocks are entered', () => {
    it('persists parsed tool mocks through the dataset item API', async () => {
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItem);
        }),
      );

      renderDialog();

      const [input, , , toolMocks] = getEditors();
      fireEvent.change(input, { target: { value: '{"city":"Seattle"}' } });
      fireEvent.change(toolMocks, {
        target: {
          value: JSON.stringify([{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }]),
        },
      });
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).toMatchObject({
        input: { city: 'Seattle' },
        toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
      });
    });
  });

  describe('when tool mocks are left empty', () => {
    it('omits tool mocks from the dataset item request', async () => {
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithoutMocks);
        }),
      );

      renderDialog();
      fireEvent.change(getEditors()[0], { target: { value: '{"city":"Seattle"}' } });
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).not.toMatchObject({ toolMocks: expect.anything() });
    });
  });

  describe('when tool mocks contain non-array JSON', () => {
    it('prevents the invalid dataset item request', async () => {
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItem);
        }),
      );

      renderDialog();
      const [input, , , toolMocks] = getEditors();
      fireEvent.change(input, { target: { value: '{"city":"Seattle"}' } });
      fireEvent.change(toolMocks, { target: { value: '{"toolName":"getWeather"}' } });
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tool Mocks must be a JSON array'));
      expect(capture).not.toHaveBeenCalled();
    });
  });

  describe('when the API rejects the input', () => {
    it('shows the field-level validation result', async () => {
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () =>
          HttpResponse.json(
            { error: 'Validation failed', field: 'input', errors: [{ path: 'prompt', message: 'Required' }] },
            { status: 400 },
          ),
        ),
      );

      renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      expect(await screen.findByText(/prompt/)).not.toBeNull();
      expect(screen.getByText(/Required/)).not.toBeNull();
    });
  });

  describe('when the API rejects the ground truth', () => {
    it('shows the field-level validation result', async () => {
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () =>
          HttpResponse.json(
            {
              error: 'Validation failed',
              field: 'groundTruth',
              errors: [{ path: 'expected.answer', message: 'Required' }],
            },
            { status: 400 },
          ),
        ),
      );

      renderDialog();
      fireEvent.change(getEditors()[1], { target: { value: '{"expected":{}}' } });
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      expect(await screen.findByText(/expected\.answer/)).not.toBeNull();
      expect(screen.getByText(/Required/)).not.toBeNull();
    });
  });

  describe('when the API rejects tool mocks', () => {
    it('shows the field-level validation result', async () => {
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () =>
          HttpResponse.json(
            { error: 'Validation failed', field: 'toolMocks', errors: [{ path: '0.output', message: 'Required' }] },
            { status: 400 },
          ),
        ),
      );

      renderDialog();
      const [input, , , toolMocks] = getEditors();
      fireEvent.change(input, { target: { value: '{"city":"Seattle"}' } });
      fireEvent.change(toolMocks, {
        target: { value: JSON.stringify([{ toolName: 'getWeather', args: {} }]) },
      });
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      expect(await screen.findByText(/0\.output/)).not.toBeNull();
      expect(screen.getByText(/Required/)).not.toBeNull();
    });
  });

  describe('when dataset scorer inheritance is kept', () => {
    it('omits scorer IDs from the dataset item request', async () => {
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithoutMocks);
        }),
      );

      renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).not.toMatchObject({ scorerIds: expect.anything() });
    });
  });

  describe('when a scorer override is enabled', () => {
    it('persists selected registered and stored scorer IDs', async () => {
      useScorerHandler();
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithScorers);
        }),
      );

      renderDialog();
      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      await selectScorer('Stored judge');
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).toMatchObject({ scorerIds: ['stored-judge'] });
    });

    it('persists no selected scorers as an explicit empty override', async () => {
      useScorerHandler();
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithEmptyScorers);
        }),
      );

      renderDialog();
      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).toMatchObject({ scorerIds: [] });
    });

    it('resets scorer controls after a successful create', async () => {
      useScorerHandler();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () => HttpResponse.json(createdDatasetItemWithScorers)),
      );

      renderDialog();
      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      await selectScorer('Stored judge');
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item added successfully'));
      expect(screen.getByRole('switch', { name: 'Override dataset scorers' }).getAttribute('aria-checked')).toBe(
        'false',
      );
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  describe('when scorer override edits are canceled', () => {
    it('restores dataset scorer inheritance', async () => {
      useScorerHandler();
      renderDialog();

      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      await selectScorer('Quality scorer');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('switch', { name: 'Override dataset scorers' }).getAttribute('aria-checked')).toBe(
        'false',
      );
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  describe('when the side dialog is closed with a scorer override', () => {
    it('restores dataset scorer inheritance when reopened', async () => {
      useScorerHandler();
      renderReopenableDialog();

      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      await selectScorer('Quality scorer');
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.click(screen.getByRole('button', { name: 'Reopen dialog' }));

      expect(screen.getByRole('switch', { name: 'Override dataset scorers' }).getAttribute('aria-checked')).toBe(
        'false',
      );
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });
});
