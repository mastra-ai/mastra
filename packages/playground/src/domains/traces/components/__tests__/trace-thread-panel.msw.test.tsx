import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceThreadPanel, type TraceThreadPanelProps } from '../trace-thread-panel';
import {
  queryPageFromList,
  THREAD_ID,
  spanADetail,
  threadTracesList,
  traceASpans,
  traceBSpans,
} from './fixtures/thread-traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom does not implement scrollIntoView, which the thread view uses to reveal the anchored trace.
const scrollIntoView = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
beforeEach(() => scrollIntoView.mockClear());
afterEach(() => vi.restoreAllMocks());

// The API returns traces newest-first (startedAt DESC).
const newestFirstList = { ...threadTracesList, spans: [threadTracesList.spans[1], threadTracesList.spans[0]] };

const installHandlers = () => {
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () =>
      HttpResponse.json(queryPageFromList(newestFirstList)),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(newestFirstList)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () => HttpResponse.json(spanADetail)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, ({ params }) =>
      HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
      HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
  );
};

// jsdom has no layout: mock heights per `data-testid` so the anchored row can decide to expand.
const mockHeights = (heights: Record<string, number>) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = heights[this.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? ''] ?? 0;
    return { height, width: 100, top: 0, left: 0, right: 100, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
  });
};

const renderPanel = (props: Partial<TraceThreadPanelProps> = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <TraceThreadPanel threadId={THREAD_ID} onBack={() => {}} onClose={() => {}} {...props} />
    </TestLinkProvider>,
    { router: { initialEntries: ['/traces?traceId=trace-a'] } },
  );

describe('TraceThreadPanel', () => {
  describe('given a thread with two traces and the current trace in the URL', () => {
    it('shows every turn of the thread with the current trace expanded', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderPanel();

      expect(await screen.findByText('Chef agent run')).not.toBeNull();
      expect(await screen.findByText('Chef agent follow-up')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(screen.getByRole('heading', { name: /Thread/ }).textContent).toContain(THREAD_ID);
      const row = screen.getByTestId('thread-view-by-trace').querySelector('[data-trace-id="trace-a"]');
      await waitFor(() => expect(scrollIntoView.mock.instances).toContain(row));
      expect(screen.getAllByRole('button', { name: 'Show less' })).toHaveLength(1);
    });

    it('strips the top rounding and horizontal borders of the details columns, only in this panel', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderPanel();

      expect(await screen.findByText('Chef agent follow-up')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const details = screen.getByTestId('thread-view-by-trace').querySelector('[data-slot="thread-trace-details"]');
      expect(details).not.toBeNull();
      const wrapper = details!.closest<HTMLElement>('[class*="thread-trace-details"]');
      expect(wrapper?.className).toContain('[&_[data-slot=thread-trace-details]]:rounded-t-none');
      expect(wrapper?.className).toContain('[&_[data-slot=thread-trace-details]]:border-y-0');
    });

    it('when no span is selected, then the panel is wide, and selecting a span makes it full width', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderPanel();
      const dialog = () => screen.getByRole('dialog', { name: `Thread ${THREAD_ID}` });

      expect(await screen.findByText('Chef agent follow-up')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(dialog().className).toContain('w-4/5');

      fireEvent.click(screen.getByText('Chef agent run'));
      await waitFor(() => expect(dialog().className).toContain('w-full'));

      const spanPanel = dialog().querySelector<HTMLElement>('[data-slot="thread-trace-span-panel"]');
      expect(spanPanel).not.toBeNull();
      fireEvent.click(within(spanPanel!).getByRole('button', { name: 'Close Panel' }));
      await waitFor(() => expect(dialog().className).toContain('w-4/5'));
    });

    it('when "Back to trace" is clicked, then onBack is called', async () => {
      installHandlers();
      const onBack = vi.fn();
      const { queryClient } = renderPanel({ onBack });

      fireEvent.click(await screen.findByRole('button', { name: 'Back to trace' }));
      expect(onBack).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('when Escape is pressed, then onClose is called', async () => {
      installHandlers();
      const onClose = vi.fn();
      const { queryClient } = renderPanel({ onClose });

      const dialog = await screen.findByRole('dialog', { name: `Thread ${THREAD_ID}` });
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });
});
