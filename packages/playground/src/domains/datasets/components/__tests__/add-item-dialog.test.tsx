// @vitest-environment jsdom
import { toast } from '@mastra/playground-ui/utils/toast';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent, PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddItemDialog } from '../add-item-dialog';
import { createdDatasetItem, createdDatasetItemWithoutMocks, createdDatasetItemWithTimeout } from './fixtures/add-item';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Thin stub for the heavy Dialog atom so this test focuses on the real client + mutation behavior.
vi.mock('@mastra/playground-ui/components/Dialog', () => {
  const Dialog = ({ open, children }: PropsWithChildren<{ open: boolean }>) => (open ? <div>{children}</div> : null);

  return {
    Dialog,
    DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
    DialogBody: ({ children }: PropsWithChildren) => <div>{children}</div>,
  };
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

/** The form has a known order of CodeEditors: input, groundTruth, expectedTrajectory, toolMocks, requestContext. */
function getEditors() {
  return screen.getAllByRole<HTMLTextAreaElement>('textbox');
}

function submitDialog() {
  const form = screen.getByRole('button', { name: /add item/i }).closest('form');
  if (!form) throw new Error('Add item form not found');
  fireEvent.submit(form);
}

describe('AddItemDialog', () => {
  describe('when valid Tool Mocks JSON is provided', () => {
    it('posts the parsed mocks when creating a dataset item', async () => {
      const capture = vi.fn();
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

      submitDialog();

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { city: 'Seattle' },
          toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
        }),
      );
    });
  });

  describe('when Tool Mocks is left empty', () => {
    it('omits toolMocks from the request', async () => {
      const capture = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithoutMocks);
        }),
      );

      renderDialog();

      const [input] = getEditors();
      fireEvent.change(input, { target: { value: '{"city":"Seattle"}' } });

      submitDialog();

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture).toHaveBeenCalledWith(expect.not.objectContaining({ toolMocks: expect.anything() }));
    });
  });

  describe('when Tool Mocks JSON is not an array', () => {
    it('rejects the value before making a request', async () => {
      const capture = vi.fn();
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

      submitDialog();

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tool Mocks must be a JSON array'));
      expect(capture).not.toHaveBeenCalled();
    });
  });

  describe('when the server rejects Tool Mocks', () => {
    it('renders the field validation error', async () => {
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

      submitDialog();

      expect(await screen.findByText(/0\.output/)).not.toBeNull();
      expect(screen.getByText(/Required/)).not.toBeNull();
    });
  });

  describe('when a valid item timeout is provided', () => {
    it('posts the timeout in milliseconds', async () => {
      const capture = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithTimeout);
        }),
      );

      renderDialog();

      fireEvent.change(screen.getByRole<HTMLInputElement>('spinbutton', { name: /item timeout/i }), {
        target: { value: '15000' },
      });
      submitDialog();

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture).toHaveBeenCalledWith(expect.objectContaining({ timeout: 15_000 }));
    });
  });

  describe('when the item timeout is left empty', () => {
    it('omits timeout from the request', async () => {
      const capture = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItemWithoutMocks);
        }),
      );

      renderDialog();
      submitDialog();

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture).toHaveBeenCalledWith(expect.not.objectContaining({ timeout: expect.anything() }));
    });
  });

  describe('when the item timeout is not a positive whole number', () => {
    it.each(['0', '-1', '1.5'])('rejects %s before making a request', async timeout => {
      const capture = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(createdDatasetItem);
        }),
      );

      renderDialog();

      fireEvent.change(screen.getByRole<HTMLInputElement>('spinbutton', { name: /item timeout/i }), {
        target: { value: timeout },
      });
      submitDialog();

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Item timeout must be a positive whole number'));
      expect(capture).not.toHaveBeenCalled();
    });
  });
});
