// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent, HTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceAsItemDialog } from '../trace-as-item-dialog';
import { createTraceDetails } from './fixtures/trace-as-item';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type CodeEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
};

// @mastra/playground-ui is a heavy presentational dependency (SideDialog,
// CodeEditor, Select primitives) with its own dedicated tests; stub it as a
// thin seam so this suite can focus on trace-to-dataset payload preparation.
// The dataset hooks are driven through the real @mastra/client-js + React
// Query stack via MSW.
vi.mock('@mastra/playground-ui/components/Select', () => ({
  Select: ({ children }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) => <div>{children}</div>,
  SelectTrigger: ({ children }: PropsWithChildren<HTMLAttributes<HTMLButtonElement>>) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: PropsWithChildren<{ value: string }>) => <div>{children}</div>,
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: CodeEditorProps) => (
    <textarea
      value={value ?? ''}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('@mastra/playground-ui/components/Text', () => ({
  TextAndIcon: ({ children }: PropsWithChildren) => <span>{children}</span>,
  getShortId: (id?: string) => id ?? '',
}));

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
  return screen.getAllByRole('textbox') as HTMLTextAreaElement[];
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
        expect(inputEditor.value).toContain('"self": "[Circular]"');
        expect(groundTruthEditor.value).toContain('"self": "[Circular]"');
      });
    });
  });
});
