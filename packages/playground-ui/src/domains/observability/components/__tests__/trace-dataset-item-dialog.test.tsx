// @vitest-environment jsdom
import type { Trajectory } from '@mastra/core/evals';
import { SpanType } from '@mastra/core/observability';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceDatasetItemDialog } from '../trace-dataset-item-dialog';
import type { TraceDatasetItemDialogProps } from '../trace-dataset-item-dialog';
import {
  datasetItem,
  datasetsList,
  trajectoryWithoutToolCalls,
  trajectoryWithProviderToolCall,
  trajectoryWithToolCalls,
} from './fixtures/add-trace-mocks';
import { createAgentRunInput, createTraceDetails } from './fixtures/trace-as-item';
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
  const posted = vi.fn<(body: unknown) => void>();

  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
    http.get(`${BASE_URL}/api/datasets/dataset-1`, () => HttpResponse.json(datasetsList.datasets[0])),
    http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
      posted(await request.json());
      return HttpResponse.json(datasetItem);
    }),
  );

  return { posted };
}

type TraceData = Pick<TraceDatasetItemDialogProps, 'rootSpan' | 'trajectory' | 'isLoading'>;

const traceData = (input: unknown, output: unknown, trajectory: Trajectory): TraceData => ({
  rootSpan: createTraceDetails(input, output),
  trajectory,
});

function renderDialog(data: TraceData, options?: Partial<Pick<TraceDatasetItemDialogProps, 'traceId' | 'onClose'>>) {
  const traceId = options && 'traceId' in options ? options.traceId : 'trace-1';
  const onClose = options?.onClose ?? vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const dialog = (props: TraceData) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TraceDatasetItemDialog {...props} traceId={traceId} isOpen onClose={onClose} />
      </QueryClientProvider>
    </MastraReactProvider>
  );

  const view = render(dialog(data));
  return { rerender: (next: TraceData) => view.rerender(dialog(next)) };
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

describe('TraceDatasetItemDialog', () => {
  describe('when trace input and output contain circular references', () => {
    it('prepares JSON-safe dataset fields instead of crashing', async () => {
      setupHandlers();
      const input: Record<string, unknown> = { prompt: 'hello' };
      const output: Record<string, unknown> = { answer: 'world' };
      input.self = input;
      output.self = output;

      renderDialog(traceData(input, output, trajectoryWithoutToolCalls));

      expect((await editor('Input')).value).toContain('"self": "[Circular]"');
      expect((await editor('Ground truth')).value).toContain('"self": "[Circular]"');
    });
  });

  describe('when the trace input and output are plain strings', () => {
    it('prefills the editors with the raw text', async () => {
      setupHandlers();
      renderDialog(traceData('hello', 'hi there', trajectoryWithoutToolCalls));

      expect((await editor('Input')).value).toBe('hello');
      expect((await editor('Ground truth')).value).toBe('hi there');
    });

    it('saves the text as string input and ground truth', async () => {
      const { posted } = setupHandlers();
      renderDialog(traceData('hello', 'hi there', trajectoryWithoutToolCalls));

      await pickDataset('Dataset 1');
      next();
      next();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({ input: 'hello', groundTruth: 'hi there' });
    });
  });

  describe('when the trace output is a string that reads as JSON', () => {
    it('saves it back as a string', async () => {
      const { posted } = setupHandlers();
      renderDialog(traceData('hello', '42', trajectoryWithoutToolCalls));

      await pickDataset('Dataset 1');
      next();
      next();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({ groundTruth: '42' });
    });
  });

  describe('when the trace data is still loading', () => {
    it('opens the dialog only once the data has arrived, prefilled from it', async () => {
      setupHandlers();
      const { rerender } = renderDialog({ isLoading: true });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.queryByRole('dialog')).toBeNull();

      rerender(traceData({ city: 'Seattle' }, { answer: 'rainy' }, trajectoryWithToolCalls));
      await screen.findByRole('dialog', { name: 'Input and ground truth' });
      expect((await editor('Input')).value).toContain('Seattle');
      await pickDataset('Dataset 1');
      next();
      expect((await editor('Tool mocks JSON')).value).toContain('getWeather');
    });
  });

  describe('when the root span is an agent run that wrapped its messages', () => {
    it('saves the messages as the input, without the wrapper', async () => {
      const { posted } = setupHandlers();
      const { input, messages } = createAgentRunInput();
      renderDialog(traceData(input, 'hi there', trajectoryWithoutToolCalls));

      await pickDataset('Dataset 1');
      next();
      next();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({ input: messages });
    });
  });

  describe('when the root span recorded no input or output', () => {
    it('starts from an empty object input and no ground truth', async () => {
      setupHandlers();
      renderDialog(traceData(undefined, undefined, trajectoryWithoutToolCalls));

      expect((await editor('Input')).value).toBe('{}');
      expect((await editor('Ground truth')).value).toBe('');
    });
  });

  describe('when a span that is not an agent run has a messages field', () => {
    it('keeps the input as recorded', async () => {
      const { posted } = setupHandlers();
      const { input } = createAgentRunInput();
      renderDialog({ rootSpan: { ...createTraceDetails(input, 'hi there'), spanType: SpanType.WORKFLOW_RUN } });

      await pickDataset('Dataset 1');
      next();
      next();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({ input });
    });
  });

  describe('when there is no trace id', () => {
    it('saves the item without a source', async () => {
      const { posted } = setupHandlers();
      renderDialog(traceData('hello', 'hi there', trajectoryWithoutToolCalls), { traceId: undefined });

      await pickDataset('Dataset 1');
      next();
      next();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).not.toHaveProperty('source');
    });
  });

  describe('when the trace recorded tool calls', () => {
    it('saves the item to the picked dataset with mocks and trajectory taken from the trace', async () => {
      const { posted } = setupHandlers();
      renderDialog(traceData({ city: 'Seattle' }, { answer: 'rainy' }, trajectoryWithToolCalls));

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

  describe('when the trace ran a provider-executed tool', () => {
    it('expects that step by name only, without mocking it', async () => {
      const { posted } = setupHandlers();
      renderDialog(traceData('hello', 'hi there', trajectoryWithProviderToolCall));

      await pickDataset('Dataset 1');
      next();
      expect((await editor('Tool mocks JSON')).value).toBe('');
      next();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

      await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
      expect(posted.mock.calls[0]?.[0]).toMatchObject({
        expectedTrajectory: { ordering: 'relaxed', steps: [{ name: 'web_search' }] },
      });
      expect(posted.mock.calls[0]?.[0]).not.toHaveProperty('expectedTrajectory.steps.0.stepType');
    });
  });

  describe('when the user cancels', () => {
    it('asks the host to close the dialog', async () => {
      setupHandlers();
      const onClose = vi.fn();
      renderDialog(traceData('hello', 'hi there', trajectoryWithoutToolCalls), { onClose });

      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe('when the trace recorded no tool calls', () => {
    it('leaves tool mocks empty and still expects the trajectory', async () => {
      setupHandlers();
      renderDialog(traceData({ city: 'Seattle' }, { answer: 'rainy' }, trajectoryWithoutToolCalls));

      await pickDataset('Dataset 1');
      next();
      expect((await editor('Tool mocks JSON')).value).toBe('');
      next();
      expect(isOn('Expected trajectory')).toBe(true);
    });
  });
});
