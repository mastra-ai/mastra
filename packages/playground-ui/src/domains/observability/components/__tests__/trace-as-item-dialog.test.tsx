// @vitest-environment jsdom
import type { Trajectory } from '@mastra/core/evals';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceAsItemDialog } from '../trace-as-item-dialog';
import {
  datasetItem,
  datasetsList,
  trajectoryWithoutToolCalls,
  trajectoryWithToolCalls,
} from './fixtures/add-trace-mocks';
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

function setupHandlers({ trajectory }: { trajectory: Trajectory }) {
  const posted = vi.fn<(body: unknown) => void>();

  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
    http.get(`${BASE_URL}/api/datasets/dataset-1`, () => HttpResponse.json(datasetsList.datasets[0])),
    http.get(`${BASE_URL}/api/observability/traces/trace-1/trajectory`, () => HttpResponse.json(trajectory)),
    http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
      posted(await request.json());
      return HttpResponse.json(datasetItem);
    }),
  );

  return { posted };
}

function renderDialog(input: unknown, output: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TraceAsItemDialog
          rootSpanId="span-1"
          traceId="trace-1"
          traceDetails={createTraceDetails(input, output)}
          isOpen
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const editor = (name: string) => screen.findByRole<HTMLTextAreaElement>('textbox', { name });
const isOn = (name: string) => screen.getByRole('switch', { name }).getAttribute('aria-checked') === 'true';
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

const pickDataset = async (name: string) => {
  // The form opens once the trajectory has loaded; the picker enables once datasets are listed.
  const picker = await screen.findByRole('combobox', { name: 'Dataset' });
  await waitFor(() => expect(picker.getAttribute('data-disabled')).toBeNull());
  fireEvent.click(picker);
  const option = await screen.findByRole('option', { name });
  // Base UI only commits a pick on a real press: pointerdown followed by click.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(picker.textContent).toContain(name));
};

describe('TraceAsItemDialog', () => {
  describe('when trace input and output contain circular references', () => {
    it('prepares JSON-safe dataset fields instead of crashing', async () => {
      setupHandlers({ trajectory: trajectoryWithoutToolCalls });
      const input: Record<string, unknown> = { prompt: 'hello' };
      const output: Record<string, unknown> = { answer: 'world' };
      input.self = input;
      output.self = output;

      renderDialog(input, output);

      expect((await editor('Input JSON')).value).toContain('"self": "[Circular]"');
      expect((await editor('Ground truth JSON')).value).toContain('"self": "[Circular]"');
    });
  });

  describe('when the trace recorded tool calls', () => {
    it('saves the item to the picked dataset with mocks and trajectory taken from the trace', async () => {
      const { posted } = setupHandlers({ trajectory: trajectoryWithToolCalls });
      renderDialog({ city: 'Seattle' }, { answer: 'rainy' });

      await pickDataset('Dataset 1');
      next();
      expect((await editor('Tool mocks JSON')).value).toContain('getWeather');
      next();
      expect(isOn('Expected trajectory')).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({
        input: { city: 'Seattle' },
        groundTruth: { answer: 'rainy' },
        source: { type: 'trace', referenceId: 'trace-1' },
        toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
        expectedTrajectory: {
          ordering: 'relaxed',
          steps: [
            {
              stepType: 'tool_call',
              name: "tool: 'getWeather'",
              toolArgs: { city: 'Seattle' },
              toolResult: { temp: 52 },
            },
          ],
        },
      });
    });
  });

  describe('when the trace recorded no tool calls', () => {
    it('leaves tool mocks empty and still expects the trajectory', async () => {
      setupHandlers({ trajectory: trajectoryWithoutToolCalls });
      renderDialog({ city: 'Seattle' }, { answer: 'rainy' });

      await pickDataset('Dataset 1');
      next();
      expect((await editor('Tool mocks JSON')).value).toBe('');
      next();
      expect(isOn('Expected trajectory')).toBe(true);
    });
  });
});
