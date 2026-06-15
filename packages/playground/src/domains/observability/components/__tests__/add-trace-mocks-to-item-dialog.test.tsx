// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddTraceMocksToItemDialog } from '../add-trace-mocks-to-item-dialog';
import {
  datasetItem,
  datasetItemsList,
  datasetsList,
  trajectoryWithToolCalls,
  trajectoryWithoutToolCalls,
} from './fixtures/add-trace-mocks';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Thin stubs for heavy playground-ui primitives (Radix Select / SideDialog / CodeMirror
// editor) so the test stays deterministic in jsdom. The real client, React Query, data
// hooks and the dialog's own logic all run unmocked against MSW.
vi.mock('@mastra/playground-ui', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/playground-ui')>();

  type SelectStubProps = PropsWithChildren<{
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }>;

  return {
    ...actual,
    CodeEditor: ({ value }: { value?: string }) => <pre data-testid="code-editor">{value ?? ''}</pre>,
    // Render a native <select> seeded from the option SelectItems so tests can choose by value.
    Select: ({ value, onValueChange, disabled, children }: SelectStubProps) => (
      <select
        data-testid="select"
        value={value ?? ''}
        disabled={disabled}
        onChange={e => onValueChange?.(e.target.value)}
      >
        <option value="" />
        {children}
      </select>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: PropsWithChildren) => <>{children}</>,
    SelectItem: ({ value, children }: PropsWithChildren<{ value: string }>) => (
      <option value={value}>{children}</option>
    ),
  };
});

vi.mock('@mastra/playground-ui/components/SideDialog', () => ({
  SideDialog: Object.assign(
    ({ isOpen, children }: PropsWithChildren<{ isOpen: boolean }>) => (isOpen ? <div>{children}</div> : null),
    {
      Top: ({ children }: PropsWithChildren) => <div>{children}</div>,
      Content: ({ children }: PropsWithChildren) => <div>{children}</div>,
      Header: ({ children }: PropsWithChildren) => <div>{children}</div>,
      Heading: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
    },
  ),
}));

const TRACE_ID = 'trace-1';

function renderDialog(traceId: string | undefined = TRACE_ID) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AddTraceMocksToItemDialog traceId={traceId} isOpen onClose={vi.fn()} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function getSelects() {
  return screen.getAllByTestId('select') as HTMLSelectElement[];
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AddTraceMocksToItemDialog', () => {
  it('derives tool mocks from the trace trajectory and previews them', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
      http.get(`${BASE_URL}/api/observability/traces/${TRACE_ID}/trajectory`, () =>
        HttpResponse.json(trajectoryWithToolCalls),
      ),
    );

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId('code-editor').textContent).toContain('getWeather');
    });
    expect(screen.getByTestId('code-editor').textContent).toContain('"city": "Seattle"');
  });

  it('appends derived mocks to the existing item on submit (existing ++ derived)', async () => {
    const capture = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
      http.get(`${BASE_URL}/api/datasets/dataset-1/items`, () => HttpResponse.json(datasetItemsList)),
      http.get(`${BASE_URL}/api/datasets/dataset-1/items/item-1`, () => HttpResponse.json(datasetItem)),
      http.get(`${BASE_URL}/api/observability/traces/${TRACE_ID}/trajectory`, () =>
        HttpResponse.json(trajectoryWithToolCalls),
      ),
      http.patch(`${BASE_URL}/api/datasets/dataset-1/items/item-1`, async ({ request }) => {
        capture(await request.json());
        return HttpResponse.json(datasetItem);
      }),
    );

    renderDialog();

    // Wait for the derived preview so the trajectory query has resolved.
    await waitFor(() => expect(screen.getByTestId('code-editor').textContent).toContain('getWeather'));

    const [datasetSelect] = getSelects();
    fireEvent.change(datasetSelect, { target: { value: 'dataset-1' } });

    // After choosing a dataset the item list loads; wait for the item option, then choose it.
    await waitFor(() => {
      const itemSelect = getSelects()[1];
      expect(Array.from(itemSelect.options).some(o => o.value === 'item-1')).toBe(true);
    });
    fireEvent.change(getSelects()[1], { target: { value: 'item-1' } });

    const submit = screen.getByRole('button', { name: /append tool mocks/i });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(submit);

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0]).toMatchObject({
      toolMocks: [
        { toolName: 'existing', args: { a: 1 }, output: { ok: true } },
        { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
      ],
    });
  });

  it('shows an empty state and disables submit when the trace has no tool calls', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
      http.get(`${BASE_URL}/api/observability/traces/${TRACE_ID}/trajectory`, () =>
        HttpResponse.json(trajectoryWithoutToolCalls),
      ),
    );

    renderDialog();

    await waitFor(() => {
      expect(screen.getByText(/no tool calls to add as mocks/i)).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: /append tool mocks/i }).hasAttribute('disabled')).toBe(true);
  });
});
