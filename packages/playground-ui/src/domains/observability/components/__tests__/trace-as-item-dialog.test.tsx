// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceAsItemDialog } from '../trace-as-item-dialog';
import { datasetItem, datasetsList, trajectoryWithToolCalls } from './fixtures/add-trace-mocks';
import { createTraceDetails } from './fixtures/trace-as-item';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// CodeMirror doesn't run in jsdom: a textarea keeps the editor's value and accessible name.
vi.mock('@/ds/components/CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    'aria-label'?: string;
  }) => <textarea aria-label={ariaLabel} value={value ?? ''} onChange={event => onChange?.(event.target.value)} />,
}));

afterEach(() => cleanup());

function setupHandlers() {
  const spanRequested = vi.fn();
  const posted = vi.fn<(body: unknown) => void>();

  server.use(
    http.get(`${BASE_URL}/api/observability/traces/trace-1/spans/span-1`, () => {
      spanRequested();
      return HttpResponse.json({ span: createTraceDetails('fetched input', 'fetched output') });
    }),
    http.get(`${BASE_URL}/api/observability/traces/trace-1/trajectory`, () =>
      HttpResponse.json(trajectoryWithToolCalls),
    ),
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
    http.get(`${BASE_URL}/api/datasets/dataset-1`, () => HttpResponse.json(datasetsList.datasets[0])),
    http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
      posted(await request.json());
      return HttpResponse.json(datasetItem);
    }),
  );

  return { spanRequested, posted };
}

function renderDialog(props: Partial<ComponentProps<typeof TraceAsItemDialog>>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TraceAsItemDialog traceId="trace-1" isOpen onClose={vi.fn()} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const editor = (name: string) => screen.findByRole<HTMLTextAreaElement>('textbox', { name });

const pickDataset = async (name: string) => {
  const picker = await screen.findByRole('combobox', { name: 'Dataset' });
  await waitFor(() => expect(picker.getAttribute('data-disabled')).toBeNull());
  fireEvent.click(picker);
  const option = await screen.findByRole('option', { name });
  // Base UI only commits a pick on a real press: pointerdown followed by click.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(picker.textContent).toContain(name));
};

describe('TraceAsItemDialog (deprecated)', () => {
  describe('when given the root span id', () => {
    it('loads the trace through the client in context and saves it as an item', async () => {
      const { posted } = setupHandlers();
      renderDialog({ rootSpanId: 'span-1' });

      expect((await editor('Input')).value).toBe('fetched input');
      expect((await editor('Ground truth')).value).toBe('fetched output');

      await pickDataset('Dataset 1');
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({
        input: 'fetched input',
        groundTruth: 'fetched output',
        toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
        expectedTrajectory: { ordering: 'relaxed' },
        source: { type: 'trace', referenceId: 'trace-1' },
      });
    });
  });

  describe('when given the trace details', () => {
    it('prefills from them without loading the root span', async () => {
      const { spanRequested } = setupHandlers();
      renderDialog({ rootSpanId: 'span-1', traceDetails: createTraceDetails('given input', 'given output') });

      expect((await editor('Input')).value).toBe('given input');
      expect((await editor('Ground truth')).value).toBe('given output');
      expect(spanRequested).not.toHaveBeenCalled();
    });
  });
});
