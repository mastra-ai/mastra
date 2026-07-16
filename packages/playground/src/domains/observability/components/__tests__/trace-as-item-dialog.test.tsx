// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceAsItemDialog } from '../trace-as-item-dialog';
import { createTraceDetails } from './fixtures/trace-as-item';

vi.mock('@/domains/datasets/components/save-as-dataset-item-dialog', () => ({
  SaveAsDatasetItemDialog: ({
    initialInput,
    initialGroundTruth,
  }: {
    initialInput: string;
    initialGroundTruth: string;
  }) => (
    <>
      <output data-testid="initial-input">{initialInput}</output>
      <output data-testid="initial-ground-truth">{initialGroundTruth}</output>
    </>
  ),
}));

function renderDialog(input: unknown, output: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl="http://localhost:4111">
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

afterEach(() => cleanup());

describe('TraceAsItemDialog', () => {
  describe('when trace input and output contain circular references', () => {
    it('prepares JSON-safe dataset fields instead of crashing', () => {
      const input: Record<string, unknown> = { prompt: 'hello' };
      const output: Record<string, unknown> = { answer: 'world' };
      input.self = input;
      output.self = output;

      renderDialog(input, output);

      expect(screen.getByTestId('initial-input').textContent).toContain('"self": "[Circular]"');
      expect(screen.getByTestId('initial-ground-truth').textContent).toContain('"self": "[Circular]"');
    });
  });
});
