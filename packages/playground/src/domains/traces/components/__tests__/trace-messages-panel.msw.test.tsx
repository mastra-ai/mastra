import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { TraceMessagesPanel, type TraceMessagesPanelProps } from '../trace-messages-panel';
import { TRACE_ID, panelTraceSpans } from './fixtures/trace-span-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const THREAD_ID = 'weather-thread';

const threadTraceList = (count: number) => ({
  spans: Array.from({ length: count }, (_, i) => ({ ...panelTraceSpans.spans[0], traceId: `thread-trace-${i}` })),
  pagination: { page: 0, perPage: 25, total: count, hasMore: false },
});

const installHandlers = ({ threadTraceCount = 2 }: { threadTraceCount?: number } = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () =>
      HttpResponse.json(threadTraceList(threadTraceCount)),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(panelTraceSpans)),
  );
};

const renderPanel = (props: Partial<TraceMessagesPanelProps> = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      {/* DataPanel.Content requires a Drawer root; the panel normally renders inside TraceSpanPanel's DataPanel. */}
      <DataPanel open title="Trace">
        <TraceMessagesPanel traceId={TRACE_ID} threadId={THREAD_ID} {...props} />
      </DataPanel>
    </TestLinkProvider>,
    { router: true },
  );

describe('TraceMessagesPanel', () => {
  describe('given the thread has other traces', () => {
    it('when onViewFullThread is provided, then "Open full thread" is a button that calls it', async () => {
      installHandlers({ threadTraceCount: 2 });
      const onViewFullThread = vi.fn();
      const { queryClient } = renderPanel({ onViewFullThread });

      const button = await screen.findByRole('button', { name: 'Open full thread' });
      expect(screen.queryByRole('link', { name: 'Open full thread' })).toBeNull();

      fireEvent.click(button);
      expect(onViewFullThread).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('when rendered, then a "Messages" heading sits at the top of the column', async () => {
      installHandlers({ threadTraceCount: 2 });
      const { queryClient } = renderPanel({ onViewFullThread: vi.fn() });

      await screen.findByText('No rain is expected.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const heading = screen.getByRole('heading', { name: 'Messages' });
      expect(screen.getByTestId('messages-panel').contains(heading)).toBe(true);
    });

    it('when onViewFullThread is absent, then no "Open full thread" action is shown', async () => {
      installHandlers({ threadTraceCount: 2 });
      const { queryClient } = renderPanel();

      await screen.findByText('No rain is expected.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(screen.queryByRole('button', { name: 'Open full thread' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Open full thread' })).toBeNull();
    });
  });

  describe('given the trace is the only one in its thread', () => {
    it('then neither a button nor a link to the full thread is shown', async () => {
      installHandlers({ threadTraceCount: 1 });
      const { queryClient } = renderPanel({ onViewFullThread: vi.fn() });

      await screen.findByText('No rain is expected.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(screen.queryByRole('button', { name: 'Open full thread' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Open full thread' })).toBeNull();
    });
  });
});
