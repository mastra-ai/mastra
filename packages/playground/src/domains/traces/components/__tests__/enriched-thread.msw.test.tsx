// @vitest-environment jsdom
import type { LightSpanRecord } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EnrichedThread } from '../enriched-thread';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const TEST_BASE_URL = 'http://localhost:4111';

vi.mock('../trace-investigate', () => ({
  TraceInvestigate: ({ traceId }: { traceId: string }) => <div data-testid="trace-investigate">{traceId}</div>,
}));

// Scoring is the dialog's job; the thread only decides where the reader lands next.
vi.mock('../trace-scores-collapsible', () => ({
  TraceScoresCollapsible: ({ traceId, onScoringStarted }: { traceId: string; onScoringStarted?: () => void }) => (
    <button type="button" onClick={onScoringStarted}>
      score {traceId}
    </button>
  ),
}));

const navigate = vi.fn();

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider navigate={navigate}>{children}</TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

const trace = (traceId: string) => ({ traceId }) as LightSpanRecord;

describe('EnrichedThread', () => {
  describe('when the thread has traces', () => {
    it('renders one turn per trace, in the order it was given', () => {
      render(<EnrichedThread traces={[trace('trace-a'), trace('trace-b')]} />, { wrapper });

      expect(screen.getAllByTestId('trace-investigate').map(el => el.textContent)).toEqual(['trace-a', 'trace-b']);
    });

    it('offers each turn its trace, in a new tab', () => {
      render(<EnrichedThread traces={[trace('abcdef0123456789')]} />, { wrapper });

      // The full id is unreadable in a conversation, so the link wears a short one.
      const link = screen.getByRole('link', { name: /Trace #abcdef01/ });
      expect(link.getAttribute('href')).toBe('/traces?traceId=abcdef0123456789');
      expect(link.getAttribute('target')).toBe('_blank');
    });
  });

  describe('when the thread has no traces', () => {
    it('renders nothing but its container', () => {
      render(<EnrichedThread traces={[]} />, { wrapper });

      expect(screen.getByTestId('enriched-thread').childElementCount).toBe(0);
    });
  });

  describe('when a turn cost something', () => {
    it('shows that cost beside the trace link', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () =>
          HttpResponse.json({
            groups: [
              {
                dimensions: { traceId: 'trace-a', name: 'mastra_model_total_input_tokens' },
                value: 100,
                estimatedCost: 0.0125,
                costUnit: 'usd',
              },
            ],
          }),
        ),
      );

      render(<EnrichedThread traces={[trace('trace-a')]} />, { wrapper });

      const cost = await screen.findByTestId('trace-cost');
      expect(cost.textContent).toBe('$0.01');
    });
  });

  describe('when the cost of a turn is unknown', () => {
    it('leaves the trace link on its own', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json({ groups: [] })),
      );

      render(<EnrichedThread traces={[trace('trace-a')]} />, { wrapper });

      await screen.findByRole('link', { name: /Trace #trace-a/ });
      expect(screen.queryByTestId('trace-cost')).toBeNull();
    });
  });

  describe('when scoring is started on a turn', () => {
    it('sends the reader to that trace, on its scorers tab', async () => {
      render(<EnrichedThread traces={[trace('trace-a')]} />, { wrapper });

      // The chat never refetches the scores, so the results live on the trace page.
      fireEvent.click(screen.getByRole('button', { name: 'score trace-a' }));

      expect(navigate).toHaveBeenCalledWith('/traces?traceId=trace-a&traceTab=scores');
    });
  });
});
