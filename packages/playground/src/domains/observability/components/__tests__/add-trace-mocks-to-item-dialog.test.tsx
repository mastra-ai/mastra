// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Children, isValidElement } from 'react';
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
  const actual = await importOriginal<typeof PlaygroundUi>();

  type SelectStubProps = PropsWithChildren<{
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }>;

  const SelectItem = ({ value, children }: PropsWithChildren<{ value: string }>) => (
    <option value={value}>{children}</option>
  );
  const SelectContent = ({ children }: PropsWithChildren) => (
    <>{Children.toArray(children).filter(child => isValidElement(child) && child.type === SelectItem)}</>
  );

  return {
    ...actual,
    CodeEditor: ({ value, onChange }: { value?: string; onChange?: (v: string) => void }) => (
      <textarea data-testid="code-editor" value={value ?? ''} onChange={e => onChange?.(e.target.value)} />
    ),
    // Render a native <select> seeded from SelectItem options so tests can choose by value.
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
    SelectContent,
    SelectItem,
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

function editorValue() {
  return (screen.getByTestId('code-editor') as HTMLTextAreaElement).value;
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
      expect(editorValue()).toContain('getWeather');
    });
    expect(editorValue()).toContain('"city": "Seattle"');
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
    await waitFor(() => expect(editorValue()).toContain('getWeather'));

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

  it('disables submit when the trace has no tool calls (empty editor)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(datasetsList)),
      http.get(`${BASE_URL}/api/observability/traces/${TRACE_ID}/trajectory`, () =>
        HttpResponse.json(trajectoryWithoutToolCalls),
      ),
    );

    renderDialog();

    // Editor is rendered but empty (nothing derived), so submit stays disabled.
    await waitFor(() => {
      expect(editorValue()).toBe('');
    });
    expect(screen.getByRole('button', { name: /append tool mocks/i }).hasAttribute('disabled')).toBe(true);
  });

  it('appends the edited mocks JSON (user edits override the derived seed)', async () => {
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

    await waitFor(() => expect(editorValue()).toContain('getWeather'));

    // Edit the mocks JSON in the editor.
    const editor = screen.getByTestId('code-editor');
    fireEvent.change(editor, {
      target: { value: JSON.stringify([{ toolName: 'getWeather', args: { city: 'Paris' }, output: { temp: 70 } }]) },
    });

    const [datasetSelect] = getSelects();
    fireEvent.change(datasetSelect, { target: { value: 'dataset-1' } });
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
        { toolName: 'getWeather', args: { city: 'Paris' }, output: { temp: 70 } },
      ],
    });
  });
});
