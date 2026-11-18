// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { ThreadTraceSelectedSpan } from '../thread-trace';
import { ThreadViewByTraceView } from '../thread-view-by-trace-view';
import type { ThreadViewByTraceViewProps, ThreadViewTrace } from '../thread-view-by-trace-view';
import { TraceThreadPanelView } from '../trace-thread-panel-view';
import { THREAD_ID, spanADetail, traceASpans, traceBSpans } from './fixtures/thread-traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeAll(() => {
  // jsdom has no layout: the scroller pins the latest turn with scrollIntoView.
  Element.prototype.scrollIntoView ??= () => {};
});

/** The chat message renderer resolves MCP app tools; it belongs to the chat domain, not to this view. */
const MCP_APP_TOOLS_LOOKUP = '/api/mcp/v0/servers';
const serveMcpAppToolsLookup = () =>
  server.use(http.get(`${TEST_BASE_URL}${MCP_APP_TOOLS_LOOKUP}`, () => HttpResponse.json({ servers: [] })));

/** Two turns of the thread, oldest first, each with the spans its `getTrace` returned. */
const loadedTraces: ThreadViewTrace[] = [
  { traceId: 'trace-a', spans: traceASpans.spans, isLoading: false },
  { traceId: 'trace-b', spans: traceBSpans.spans, isLoading: false },
];

/** The view as a host composes it: span selection is the host's state, the selected record is handed down. */
function Host({ onSelectedSpanChange, ...props }: Partial<ThreadViewByTraceViewProps>) {
  const [selectedSpan, setSelectedSpan] = useState<ThreadTraceSelectedSpan | null>(null);
  return (
    <ThreadViewByTraceView
      traces={loadedTraces}
      selectedSpan={selectedSpan}
      onSelectedSpanChange={selected => {
        setSelectedSpan(selected);
        onSelectedSpanChange?.(selected);
      }}
      selectedSpanDetail={selectedSpan?.spanId === 'span-a' ? spanADetail.span : undefined}
      {...props}
    />
  );
}

const renderView = (props: Partial<ThreadViewByTraceViewProps> = {}) => {
  serveMcpAppToolsLookup();
  return renderWithProviders(
    <TestLinkProvider>
      <div style={{ height: 800 }}>
        <Host {...props} />
      </div>
    </TestLinkProvider>,
  );
};

const turn = (traceId: string) => {
  const row = document.querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`);
  if (!row) throw new Error(`no turn for ${traceId}`);
  return row;
};

describe('ThreadViewByTraceView', () => {
  describe('when the turns come from the props', () => {
    it('draws one turn per trace, oldest first', async () => {
      renderView();

      await screen.findByText('Chef agent follow-up');
      const turns = [...document.querySelectorAll<HTMLElement>('[data-trace-id]')].map(row => row.dataset.traceId);

      expect(turns).toEqual(['trace-a', 'trace-b']);
    });

    it('draws each turn’s span tree from its spans', async () => {
      renderView();

      const spanRow = (traceId: string, name: string) =>
        within(turn(traceId)).findByLabelText(`View details for span ${name}`);

      expect(await spanRow('trace-a', 'Recipe lookup')).toBeTruthy();
      expect(await spanRow('trace-b', 'Chef agent follow-up')).toBeTruthy();
    });

    it('reconstructs each turn’s messages from its spans', async () => {
      renderView();

      expect(await within(turn('trace-a')).findByText('cook pasta')).toBeTruthy();
    });

    it('asks the network for nothing but the chat renderer’s MCP app tools', async () => {
      const requests = recordRequests();
      const { queryClient } = renderView();

      await within(turn('trace-a')).findByText('cook pasta');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(requests.filter(path => path !== MCP_APP_TOOLS_LOOKUP)).toEqual([]);
    });
  });

  describe('when a turn’s spans are still loading', () => {
    it('keeps the other turns drawn', async () => {
      renderView({ traces: [{ traceId: 'trace-a', isLoading: true }, loadedTraces[1]] });

      expect(await within(turn('trace-b')).findByText('Chef agent follow-up')).toBeTruthy();
      expect(within(turn('trace-a')).getByRole('status', { name: 'Loading messages' })).toBeTruthy();
    });
  });

  describe('when the thread is still loading', () => {
    it('shows the thread skeleton', () => {
      renderView({ traces: [], isLoading: true });

      expect(screen.getByRole('status', { name: 'Loading thread' })).toBeTruthy();
    });
  });

  describe('when the thread failed to load', () => {
    it('shows the error instead of the turns', async () => {
      renderView({ traces: [], error: new Error('store unavailable') });

      expect(await screen.findByText('Failed to load traces')).toBeTruthy();
    });
  });

  describe('when the thread has no traces', () => {
    it('says so', () => {
      renderView({ traces: [] });

      expect(screen.getByText('No traces found for this thread.')).toBeTruthy();
    });
  });

  describe('when the reader opens a span', () => {
    it('reports the selection to the host', async () => {
      const onSelectedSpanChange = vi.fn<(selected: ThreadTraceSelectedSpan | null) => void>();
      renderView({ onSelectedSpanChange });

      fireEvent.click(await within(turn('trace-a')).findByText('Chef agent run'));

      expect(onSelectedSpanChange).toHaveBeenCalledWith({ traceId: 'trace-a', spanId: 'span-a' });
    });

    it('shows the record the host hands down beside the conversation', async () => {
      renderView();

      fireEvent.click(await within(turn('trace-a')).findByText('Chef agent run'));
      const detail = await screen.findByRole('region', { name: 'Chef agent run' });

      expect(within(detail).getByRole('tab', { name: /Details/ })).toBeTruthy();
    });

    it('closes the detail through the host', async () => {
      const onSelectedSpanChange = vi.fn<(selected: ThreadTraceSelectedSpan | null) => void>();
      renderView({ onSelectedSpanChange });
      fireEvent.click(await within(turn('trace-a')).findByText('Chef agent run'));
      await screen.findByRole('region', { name: 'Chef agent run' });

      fireEvent.click(screen.getByRole('button', { name: 'Close span' }));

      expect(onSelectedSpanChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe('when the host renders the feedback of a turn', () => {
    it('shows it on that turn’s Feedback tab', async () => {
      renderView({ feedbackSlot: ({ traceId }) => <p>Feedback of {traceId}</p> });

      fireEvent.click(await within(turn('trace-b')).findByRole('tab', { name: 'Feedback' }));

      expect(await within(turn('trace-b')).findByText('Feedback of trace-b')).toBeTruthy();
    });
  });

  describe('when the host renders no feedback', () => {
    it('offers no Feedback tab', async () => {
      renderView();

      await within(turn('trace-a')).findByText('cook pasta');

      expect(within(turn('trace-a')).queryByRole('tab', { name: 'Feedback' })).toBeNull();
    });
  });

  describe('when the host renders the scores of a turn', () => {
    it('hands it the turn’s root span on the Scores tab', async () => {
      renderView({ scoresSlot: ({ traceId, rootSpanId }) => <p>Scores of {`${traceId}/${rootSpanId}`}</p> });

      fireEvent.click(await within(turn('trace-a')).findByRole('tab', { name: 'Scores' }));

      expect(await within(turn('trace-a')).findByText('Scores of trace-a/span-a')).toBeTruthy();
    });
  });
});

describe('TraceThreadPanelView', () => {
  describe('when the host opens it on a thread', () => {
    it('frames the host’s thread view in a drawer named after the thread', async () => {
      renderWithProviders(
        <TraceThreadPanelView open threadId={THREAD_ID} onClose={() => {}}>
          <p>Thread content</p>
        </TraceThreadPanelView>,
      );

      const drawer = await screen.findByRole('dialog', { name: `Thread ${THREAD_ID}` });

      expect(within(drawer).getByText('Thread content')).toBeTruthy();
    });

    it('closes through onClose', async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <TraceThreadPanelView open threadId={THREAD_ID} onClose={onClose}>
          <p>Thread content</p>
        </TraceThreadPanelView>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Back to trace' }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('when a span detail is open in the thread', () => {
    it('takes the full frame', async () => {
      renderWithProviders(
        <TraceThreadPanelView open threadId={THREAD_ID} onClose={() => {}} hasSelectedSpan>
          <p>Thread content</p>
        </TraceThreadPanelView>,
      );

      const drawer = await screen.findByRole('dialog', { name: `Thread ${THREAD_ID}` });

      expect(drawer.getAttribute('data-size')).toBe('full');
    });
  });
});
