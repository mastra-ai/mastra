// @vitest-environment jsdom
import { toast } from '@mastra/playground-ui/utils/toast';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent, PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddItemDialog } from '../add-item-dialog';
import { createdDatasetItem, createdDatasetItemWithoutMocks } from './fixtures/add-item';
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
  return screen.getAllByRole('textbox') as HTMLTextAreaElement[];
}

describe('AddItemDialog', () => {
  it('posts parsed Tool Mocks JSON when creating a dataset item', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0]).toMatchObject({
      input: { city: 'Seattle' },
      toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
    });
  });

  it('omits toolMocks when the field is left empty', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0].toolMocks).toBeUndefined();
  });

  it('rejects non-array Tool Mocks JSON before making a request', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    // The non-array guard surfaces an error toast and short-circuits before any request.
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tool Mocks must be a JSON array'));
    expect(capture).not.toHaveBeenCalled();
  });

  it('renders server-side Tool Mocks validation errors inline', async () => {
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
