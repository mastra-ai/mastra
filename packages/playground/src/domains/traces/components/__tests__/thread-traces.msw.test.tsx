import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ThreadTraces } from '../thread-traces';
import {
  THREAD_ID,
  emptyThreadTracesList,
  spanADetail,
  threadTracesList,
  traceASpans,
  traceBSpans,
} from './fixtures/thread-traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom reports zero-sized elements, so TanStack Virtual (which reads
// offsetWidth/offsetHeight) would render no rows. Give every element a real
// size so the virtualized trace list materializes.
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

const onTracesRequest = vi.fn<(threadId: string | null) => void>();

const installHandlers = ({ list = threadTracesList }: { list?: typeof threadTracesList } = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, ({ request }) => {
      // `toQueryParams` flattens `filters` to top-level params, so `threadId` is its own param.
      onTracesRequest(new URL(request.url).searchParams.get('threadId'));
      return HttpResponse.json(list);
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () => HttpResponse.json(spanADetail)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, ({ params }) =>
      HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans),
    ),
  );
};

const renderPanel = (threadId = THREAD_ID, onSpanOpenChange?: (open: boolean) => void) =>
  renderWithProviders(
    <TestLinkProvider>
      <ThreadTraces threadId={threadId} onSpanOpenChange={onSpanOpenChange} />
    </TestLinkProvider>,
    { router: true },
  );

describe('ThreadTraces', () => {
  it('requests traces filtered by the given threadId', async () => {
    onTracesRequest.mockClear();
    installHandlers();
    const { queryClient } = renderPanel();

    await waitFor(() => expect(onTracesRequest).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(onTracesRequest.mock.calls[0][0]).toBe(THREAD_ID);
  });

  it('lists the traces returned for the thread', async () => {
    installHandlers();
    const { queryClient } = renderPanel();

    expect(await screen.findByText('Chef agent run')).not.toBeNull();
    expect(screen.getByText('Chef agent follow-up')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('shows a loading skeleton while the traces request is in flight', async () => {
    let releaseTraces!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseTraces = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/light`, async () => {
        await gate;
        return HttpResponse.json(threadTracesList);
      }),
    );
    const { queryClient } = renderPanel();

    // While the response is gated, the list renders its pulsing skeleton rows.
    await waitFor(() => expect(document.querySelector('.animate-pulse')).not.toBeNull());
    expect(screen.queryByText('Chef agent run')).toBeNull();

    releaseTraces();
    expect(await screen.findByText('Chef agent run')).not.toBeNull();
    expect(document.querySelector('.animate-pulse')).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('shows an empty state when the thread has no traces', async () => {
    installHandlers({ list: emptyThreadTracesList });
    const { queryClient } = renderPanel();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByText(/no traces/i)).not.toBeNull();
  });

  it('replaces the list with the trace panel on click, and returns via the panel close button', async () => {
    installHandlers();
    const { queryClient } = renderPanel();

    const row = await screen.findByText('Chef agent run');
    fireEvent.click(row);

    // The trace panel shows the trace id header once spans load…
    expect(await screen.findByText(/# trace-a/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // …and the list is gone (the second trace is no longer visible).
    expect(screen.queryByText('Chef agent follow-up')).toBeNull();

    // The panel close button restores the list view.
    fireEvent.click(screen.getByLabelText('Close Panel'));
    await waitFor(() => expect(screen.queryByText(/# trace-a/)).toBeNull());
    expect(await screen.findByText('Chef agent follow-up')).not.toBeNull();
  });

  it('navigates to the adjacent trace with the previous/next arrows in the panel header', async () => {
    installHandlers();
    const { queryClient } = renderPanel();

    fireEvent.click(await screen.findByText('Chef agent run'));
    expect(await screen.findByText(/# trace-a/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // trace-a is first in the list, so "Previous trace" is disabled.
    expect(screen.getByLabelText<HTMLButtonElement>('Previous trace').disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Next trace'));
    expect(await screen.findByText(/# trace-b/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // trace-b is last, so "Next trace" is disabled; going back restores trace-a.
    expect(screen.getByLabelText<HTMLButtonElement>('Next trace').disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Previous trace'));
    expect(await screen.findByText(/# trace-a/)).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('shows the span detail panel and notifies onSpanOpenChange when a span is selected', async () => {
    const onSpanOpenChange = vi.fn<(open: boolean) => void>();
    installHandlers();
    const { queryClient } = renderPanel(THREAD_ID, onSpanOpenChange);

    fireEvent.click(await screen.findByText('Chef agent run'));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // Opening a trace is not a span transition — no notification (a spurious
    // "close" here would reset a manually resized panel).
    expect(onSpanOpenChange).not.toHaveBeenCalled();

    // The timeline renders the root span; clicking it selects the span.
    const spanNodes = screen.getAllByText('Chef agent run');
    fireEvent.click(spanNodes[spanNodes.length - 1]);

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(await screen.findByText(/# span-a/)).not.toBeNull();
    expect(onSpanOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('renders the error content when the traces request fails', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 403 }),
      ),
      http.get(`${TEST_BASE_URL}/api/observability/traces`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 403 }),
      ),
    );
    const { queryClient } = renderPanel();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // 403 renders TracesErrorContent's permission-denied variant.
    expect(await screen.findByText(/permission to access traces/i)).not.toBeNull();
  });
});
