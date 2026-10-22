// @vitest-environment jsdom
import type { TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { tracePreviewsPage, tracesWithoutPreviewsPage } from '../../hooks/__tests__/fixtures/trace-query';
import { useTracesListSource } from '../../hooks/use-traces-list-source';
import { TracesListView } from '../traces-list-view';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const query = () => ({ timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' } });

// jsdom has no layout; without a sized scroll container the virtualizer renders no rows.
beforeAll(() => {
  class ResizeObserverStub {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const size = [{ inlineSize: 1200, blockSize: 800 }];
      this.callback(
        [
          {
            target,
            contentRect: new DOMRect(0, 0, 1200, 800),
            borderBoxSize: size,
            contentBoxSize: size,
            devicePixelContentBoxSize: size,
          },
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1200, 800));
  // Base UI's scroll area waits on animations; jsdom has no Web Animations API.
  Element.prototype.getAnimations ??= () => [];
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function TracesList() {
  const { rows } = useTracesListSource({ query, autoRefetch: false });
  return <TracesListView traces={rows} onTraceClick={() => {}} />;
}

function renderTracesList(page: TraceQueryKeysetTraceResponse) {
  const requests = vi.fn();
  server.use(
    http.post(`${BASE_URL}/api/observability/traces/query`, () => {
      requests();
      return HttpResponse.json(page);
    }),
  );
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TracesList />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return requests;
}

function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest<HTMLElement>('[data-index]');
  if (!row) throw new Error(`No row contains "${text}"`);
  return row;
}

describe('TracesListView Output column', () => {
  describe('when the server returns output and error previews', () => {
    it("shows a finished run's output from the list response alone", async () => {
      const requests = renderTracesList(tracePreviewsPage);

      expect(await screen.findByText('Sunny, 24°C')).toBeTruthy();
      expect(rowOf('What is the weather in Paris?').textContent).toContain('Sunny, 24°C');
      expect(requests).toHaveBeenCalledTimes(1);
    });

    it("shows a failed run's error in the error color instead of its partial output", async () => {
      renderTracesList(tracePreviewsPage);

      const error = await screen.findByText('Rate limit exceeded');
      expect(error.closest('.text-destructive-foreground')).not.toBeNull();
      expect(screen.queryByText('Let me check availability')).toBeNull();
      expect(rowOf('Book a table for two').textContent).toContain('Rate limit exceeded');
    });
  });

  describe('when the server predates output and error previews', () => {
    it('shows a dash in every Output cell, in the error color for the failed run', async () => {
      renderTracesList(tracesWithoutPreviewsPage);

      const finished = await screen.findByText('What is the weather in Paris?');
      const columns = Array.from(document.querySelector('.data-list-top')?.children ?? []).map(
        cell => cell.textContent,
      );
      const output = columns.indexOf('Output');
      expect(output).toBeGreaterThan(-1);

      const succeeded = rowOf('What is the weather in Paris?').children[output];
      const failed = rowOf('Book a table for two').children[output];
      expect(succeeded?.textContent).toBe('-');
      expect(failed?.textContent).toBe('-');
      expect(succeeded?.classList.contains('text-destructive-foreground')).toBe(false);
      expect(failed?.classList.contains('text-destructive-foreground')).toBe(true);
      expect(finished).toBeTruthy();
    });
  });
});
