// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceAsItemDialog } from '../trace-as-item-dialog';
import { createTraceDetails } from './fixtures/trace-as-item';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

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
