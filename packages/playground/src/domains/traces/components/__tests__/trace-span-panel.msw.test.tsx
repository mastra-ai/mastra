import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { TraceSpanPanel, type TraceSpanPanelProps } from '../trace-span-panel';
import { TRACE_ID, panelTraceSpans, spanDetailById } from './fixtures/trace-span-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom reports zero-sized elements; give them a real size so the virtualized
// timeline materializes its rows.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

const onSpanDetailRequest = vi.fn<(spanId: string) => void>();

const installHandlers = () => {
  onSpanDetailRequest.mockClear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
      const spanId = String(params.spanId);
      onSpanDetailRequest(spanId);
      const detail = spanDetailById[spanId];
      return detail ? HttpResponse.json(detail) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(panelTraceSpans)),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
      HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
    ),
  );
};

/**
 * Controlled-selection harness: the panel is controlled by its parent in both real
 * call sites (URL state on the traces page, local state in the chat aside).
 */
function Harness({
  initialSpanId = null,
  onSpanSelect,
  ...props
}: Partial<TraceSpanPanelProps> & { initialSpanId?: string | null }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(initialSpanId);
  return (
    <TraceSpanPanel
      traceId={TRACE_ID}
      spans={panelTraceSpans.spans}
      isLoadingSpans={false}
      selectedSpanId={selectedSpanId}
      onSpanSelect={spanId => {
        setSelectedSpanId(spanId ?? null);
        onSpanSelect?.(spanId);
      }}
      onClose={() => {}}
      {...props}
    />
  );
}

const renderPanel = (props: Partial<TraceSpanPanelProps> & { initialSpanId?: string | null } = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <Harness {...props} />
    </TestLinkProvider>,
    { router: true },
  );

describe('TraceSpanPanel', () => {
  describe('when partial thread is enabled for an agent trace with a thread id', () => {
    it('renders the selected trace as a chat turn in the Messages tab', async () => {
      installHandlers();
      const { queryClient } = renderPanel({ showPartialThread: true });

      fireEvent.click(await screen.findByRole('tab', { name: 'Messages' }));

      expect(await screen.findByText('Will it rain?')).not.toBeNull();
      expect(screen.getByText('No rain is expected.')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when partial thread is enabled without a complete agent thread context', () => {
    it('hides the tab for a trace without a thread id', () => {
      installHandlers();
      renderPanel({
        showPartialThread: true,
        spans: panelTraceSpans.spans.map(span => (span.parentSpanId == null ? { ...span, threadId: null } : span)),
      });

      expect(screen.queryByRole('tab', { name: 'Messages' })).toBeNull();
    });

    it('hides the tab for a branch view', () => {
      installHandlers();
      renderPanel({ showPartialThread: true, anchorSpanId: 'span-root' });

      expect(screen.queryByRole('tab', { name: 'Messages' })).toBeNull();
    });
  });

  it('given a trace with spans, when it renders, then the trace header and span tree are shown', async () => {
    installHandlers();
    const { queryClient } = renderPanel();

    expect(await screen.findByText(`# ${TRACE_ID}`)).not.toBeNull();
    expect(screen.getByText('Root agent run')).not.toBeNull();
    expect(screen.getByText('First tool call')).not.toBeNull();
    expect(screen.getByText('Second tool call')).not.toBeNull();
    // No span selected → no span detail panel.
    expect(screen.queryByText(/# span-/)).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('when a span is clicked, then the span detail panel opens with data fetched from the API', async () => {
    installHandlers();
    const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
    const { queryClient } = renderPanel({ onSpanSelect });

    fireEvent.click(await screen.findByText('First tool call'));

    expect(onSpanSelect).toHaveBeenCalledWith('span-child-1');
    expect(await screen.findByText(/# span-child-1/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(onSpanDetailRequest).toHaveBeenCalledWith('span-child-1');
  });

  it('when next/previous is clicked, then the adjacent span in the tree is selected', async () => {
    installHandlers();
    const { queryClient } = renderPanel({ initialSpanId: 'span-child-1' });

    expect(await screen.findByText(/# span-child-1/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByLabelText('Next span'));
    expect(await screen.findByText(/# span-child-2/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByLabelText('Previous span'));
    expect(await screen.findByText(/# span-child-1/)).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Previous span'));
    expect(await screen.findByText(/# span-root/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('when the span panel is closed, then onSpanSelect(undefined) clears the selection', async () => {
    installHandlers();
    const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
    const { queryClient } = renderPanel({ initialSpanId: 'span-child-1', onSpanSelect });

    expect(await screen.findByText(/# span-child-1/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Two close buttons are visible (trace panel + span panel); the span panel's is the last.
    const closeButtons = screen.getAllByLabelText('Close Panel');
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(onSpanSelect).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(screen.queryByText(/# span-child-1/)).toBeNull());
  });

  it('when the trace panel is closed, then onClose is called', async () => {
    installHandlers();
    const onClose = vi.fn();
    const { queryClient } = renderPanel({ onClose });

    expect(await screen.findByText(`# ${TRACE_ID}`)).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Close Panel'));
    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('given an agent root span, then the trace summary shows the entity linked to its agent page, start time, duration, and a Spans tab', async () => {
    installHandlers();
    const { queryClient } = renderPanel();

    expect(await screen.findByText(`# ${TRACE_ID}`)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Entity block: type label + name linking to the agent page. ("Agent" also
    // appears as the span-type badge in the tree, so allow multiple matches.)
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0);
    const entityLink = screen.getByRole('link', { name: /Weather Agent/ });
    expect(entityLink.getAttribute('href')).toBe('/agents/weather-agent/chat/new');

    // Start time + duration are shown; the old key-value rows are gone.
    expect(screen.getByLabelText(/^Started at /)).not.toBeNull();
    expect(screen.getByText('1.0s')).not.toBeNull();
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Ended at')).toBeNull();
    // Tab labels ("Spans") only render when score/feedback slots are provided;
    // that rendering is covered by the playground-ui unit tests.
  });

  it('given a workflow root span, then the entity links to its workflow graph', async () => {
    installHandlers();
    renderPanel({
      spans: panelTraceSpans.spans.map(span =>
        span.parentSpanId == null
          ? { ...span, entityType: 'workflow_run', entityId: 'daily-report', entityName: 'Daily report' }
          : span,
      ),
    });

    const entityLink = await screen.findByRole('link', { name: /Daily report/ });
    expect(entityLink.getAttribute('href')).toBe('/workflows/daily-report/graph');
  });

  it('given anchorSpanId (branches mode), then the selected anchor span shows trace-level metadata', async () => {
    installHandlers();
    const { queryClient } = renderPanel({ anchorSpanId: 'span-child-1', initialSpanId: 'span-child-1' });

    expect(await screen.findByText(/# span-child-1/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // Anchor spans render the trace-context fields even though they have a parent.
    expect(screen.getByText('Trace Id')).not.toBeNull();
  });
});
