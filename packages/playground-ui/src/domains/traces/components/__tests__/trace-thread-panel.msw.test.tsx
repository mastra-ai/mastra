// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
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

const renderPanel = (props: Partial<TraceThreadPanelProps> = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <TraceThreadPanel
        threadId={THREAD_ID}
        withQueryTrace
        withFeedback
        anchorTraceId="trace-a"
        onOpenScore={() => {}}
        onBack={() => {}}
        onClose={() => {}}
        {...props}
      />
    </TestLinkProvider>,
  );

describe('TraceThreadPanel', () => {
  describe('given a thread with two traces and the current trace in the URL', () => {
    it('shows every turn as conversation only, scrolled to the current trace, in a wide drawer', async () => {
      installHandlers();
      const { queryClient } = renderPanel();
      const dialog = () => screen.getByRole('dialog', { name: `Thread ${THREAD_ID}` });

      expect(await screen.findByRole('button', { name: 'Show trace for turn 1' })).not.toBeNull();
      expect(await screen.findByRole('button', { name: 'Show trace for turn 2' })).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(screen.getByRole('heading', { name: /Thread/ }).textContent).toContain(THREAD_ID);
      expect(screen.queryByText('Chef agent run')).toBeNull();
      const row = screen.getByTestId('thread-view-by-trace').querySelector('[data-trace-id="trace-a"]');
      await waitFor(() => expect(scrollIntoView.mock.instances).toContain(row));
      expect(dialog().className).toContain('w-4/5');
    });

    it('when a trace is shown then hidden, then the drawer goes full-width and back to wide', async () => {
      installHandlers();
      const { queryClient } = renderPanel();
      const dialog = () => screen.getByRole('dialog', { name: `Thread ${THREAD_ID}` });

      fireEvent.click(await screen.findByRole('button', { name: 'Show trace for turn 1' }));
      expect(await within(screen.getByTestId('thread-trace-trace-panel')).findByText('Chef agent run')).not.toBeNull();
      await waitFor(() => expect(dialog().className).toContain('w-full'));

      fireEvent.click(screen.getByRole('button', { name: 'Hide trace for turn 1' }));
      await waitFor(() => expect(dialog().className).toContain('w-4/5'));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
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
