// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Children, isValidElement } from 'react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceAsItemDialog } from '../trace-as-item-dialog';
import { createTraceDetails, llmSpanResponse } from './fixtures/trace-as-item';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// The Base UI Select has no jsdom-friendly way to pick an option; a native <select> seeded from
// the SelectItems lets the test choose a dataset. Everything else runs unmocked against MSW.
vi.mock('@/ds/components/Select', () => {
  type SelectStubProps = PropsWithChildren<{ value?: string; onValueChange?: (v: string) => void }>;
  const SelectItem = ({ value, children }: PropsWithChildren<{ value: string }>) => (
    <option value={value}>{children}</option>
  );
  const SelectContent = ({ children }: PropsWithChildren) => (
    <>{Children.toArray(children).filter(child => isValidElement(child) && child.type === SelectItem)}</>
  );
  return {
    Select: ({ value, onValueChange, children }: SelectStubProps) => (
      <select aria-label="Dataset" value={value ?? ''} onChange={e => onValueChange?.(e.target.value)}>
        <option value="" />
        {children}
      </select>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent,
    SelectItem,
  };
});

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse())));
});

afterEach(() => cleanup());

function renderDialog(input: unknown, output: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TraceAsItemDialog
          rootSpanId="span-1"
          traceDetails={createTraceDetails(input, output)}
          isOpen
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function getEditors() {
  return screen.getAllByRole('textbox');
}

describe('TraceAsItemDialog', () => {
  describe('when trace input and output contain circular references', () => {
    it('prepares JSON-safe dataset fields instead of crashing', async () => {
      const input: Record<string, unknown> = { prompt: 'hello' };
      const output: Record<string, unknown> = { answer: 'world' };
      input.self = input;
      output.self = output;

      renderDialog(input, output);

      await waitFor(() => {
        const [inputEditor, groundTruthEditor] = getEditors();
        expect(inputEditor.textContent).toContain('"self": "[Circular]"');
        expect(groundTruthEditor.textContent).toContain('"self": "[Circular]"');
      });
    });
  });
});

describe('TraceAsItemDialog — saving a single span', () => {
  function renderSpanDialog() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <TraceAsItemDialog traceId="trace-1" rootSpanId="span-1" spanId="span-llm" isOpen onClose={vi.fn()} />
        </QueryClientProvider>
      </MastraReactProvider>,
    );
  }

  it('saves the span input and output, without the trace-wide trajectory or tool mocks', async () => {
    const onTrajectory = vi.fn();
    const onAddItem = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/observability/traces/trace-1/spans/span-llm`, () => HttpResponse.json(llmSpanResponse)),
      http.get(`${BASE_URL}/api/observability/traces/trace-1/trajectory`, () => {
        onTrajectory();
        return HttpResponse.json({ steps: [] });
      }),
      http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
        onAddItem(await request.json());
        return HttpResponse.json({});
      }),
    );

    renderSpanDialog();

    await waitFor(() => {
      const [inputEditor, groundTruthEditor] = getEditors();
      expect(inputEditor.textContent).toContain('What is the weather in Paris?');
      expect(groundTruthEditor.textContent).toContain('Sunny, 24°C');
    });
    const datasetSelect = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Dataset' });
    await waitFor(() => expect(Array.from(datasetSelect.options).some(o => o.value === 'dataset-1')).toBe(true));
    fireEvent.change(datasetSelect, { target: { value: 'dataset-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }));

    await waitFor(() => expect(onAddItem).toHaveBeenCalledTimes(1));
    expect(onAddItem.mock.calls[0][0]).toEqual({
      input: [{ role: 'user', content: 'What is the weather in Paris?' }],
      groundTruth: { text: 'Sunny, 24°C' },
      source: { type: 'trace', referenceId: 'trace-1' },
    });
    expect(onTrajectory).not.toHaveBeenCalled();
  });
});
