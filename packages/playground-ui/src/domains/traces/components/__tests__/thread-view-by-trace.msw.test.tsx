// @vitest-environment jsdom
import type { ListScoresResponse } from '@mastra/client-js';
import '@/test/jsdom-polyfills';
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedbackRecord, listFeedbackResponse } from '../../hooks/__tests__/fixtures/trace-feedback';
import { ThreadViewByTrace } from '../thread-view-by-trace';
import {
  queryPageFromList,
  THREAD_ID,
  emptyThreadTracesList,
  spanADetail,
  threadTracesList,
  traceASpans,
  traceBSpans,
  emptyMcpServers,
  emptyTraceSpanScores,
} from './fixtures/thread-traces';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom does not implement scrollIntoView, which the timeline uses to reveal the selected span.
const scrollIntoView = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
beforeEach(() => scrollIntoView.mockClear());

// The API returns traces newest-first (startedAt DESC): trace-b (12:05) before trace-a (12:00).
const newestFirstList = { ...threadTracesList, spans: [threadTracesList.spans[1], threadTracesList.spans[0]] };

const installHandlers = ({ list = newestFirstList }: { list?: typeof threadTracesList } = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(emptyMcpServers)),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(listFeedbackResponse([]))),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () => HttpResponse.json(queryPageFromList(list))),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(list)),
    http.get(`${TEST_BASE_URL}/api/observability/traces`, () => HttpResponse.json(list)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () => HttpResponse.json(spanADetail)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
      HttpResponse.json(emptyTraceSpanScores),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, ({ params }) =>
      HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans),
    ),
  );
};

const FEEDBACK_URL = `${TEST_BASE_URL}/api/observability/feedback`;

const traceAFeedback = listFeedbackResponse([feedbackRecord({ feedbackId: 'trace-a-fb-1', traceId: 'trace-a' })]);

const installFeedbackHandlers = (feedback = traceAFeedback) => {
  server.use(
    http.get(FEEDBACK_URL, () => HttpResponse.json(feedback)),
    http.post(FEEDBACK_URL, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ success: true, ...body });
    }),
  );
};

// jsdom has no layout: mock heights per `data-testid` (e.g. messages column 300px, timeline 900px).
const mockHeights = (heights: Record<string, number>) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = heights[this.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? ''] ?? 0;
    return { height, width: 100, top: 0, left: 0, right: 100, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
  });
};

// jsdom has no IntersectionObserver. Several observers are created (infinite scroll sentinel, visible
// rows, in-view hooks); `intersect` notifies whichever ones watch the given element.
const stubIntersectionObserver = () => {
  type Callback = (entries: Array<Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>>) => void;
  const observers: Array<{ cb: Callback; targets: Element[] }> = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = [];
      constructor(cb: Callback) {
        observers.push({ cb, targets: this.targets });
      }
      observe = (el: Element) => this.targets.push(el);
      disconnect = vi.fn();
    },
  );
  const intersect = (target: Element) =>
    observers.filter(o => o.targets.includes(target)).forEach(o => o.cb([{ target, isIntersecting: true }]));
  return { intersect };
};

const viewportOf = () => {
  const viewport = screen
    .getByTestId('thread-view-by-trace')
    .querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
  if (!viewport) throw new Error('viewport not found');
  return viewport;
};

const scrollReaderTo = (viewport: HTMLElement, scrollTop: number) => {
  viewport.scrollTop = scrollTop;
  fireEvent.scroll(viewport);
};

// The scroller only asks for older turns once the reader moves back up, never on mount.
const scrollUpToOldest = () => {
  const viewport = viewportOf();
  act(() => scrollReaderTo(viewport, 1));
  act(() => scrollReaderTo(viewport, 0));
};

// jsdom has no layout: give scroll viewports a 400px window over `scrollHeight` of content, make
// `scrollTo` move them, and let the test grow the content as rows load their messages and spans.
const stubScrollLayout = () => {
  let scrollHeight = 1000;
  const isViewport = (el: HTMLElement) => el.dataset.slot === 'message-scroller-viewport';
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return isViewport(this) ? scrollHeight : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return isViewport(this) ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(function (
    this: HTMLElement,
    options?: ScrollToOptions | number,
  ) {
    if (typeof options === 'object' && typeof options.top === 'number') this.scrollTop = options.top;
  });
  const resized: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        resized.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  return {
    setScrollHeight: (height: number) => {
      scrollHeight = height;
    },
    grow: (height: number) => {
      scrollHeight = height;
      resized.forEach(cb => cb([], {} as ResizeObserver));
    },
  };
};

const installScore = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, ({ params }) =>
      HttpResponse.json({
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        scores: [
          {
            id: 'score-1',
            scorerId: 'scorer-1',
            entityId: 'chef',
            runId: 'run-1',
            score: 0.8,
            scorer: { name: 'Helpfulness' },
            source: 'LIVE',
            entity: {},
            traceId: String(params.traceId),
            spanId: String(params.spanId),
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
          } as ListScoresResponse['scores'][number],
        ],
      } satisfies ListScoresResponse),
    ),
  );
};

const renderView = ({
  withFeedback = true,
  withQueryTrace = true,
  onOpenScore = () => {},
  paths,
  pageSize,
}: {
  withFeedback?: boolean;
  withQueryTrace?: boolean;
  onOpenScore?: (traceId: string, scoreId: string) => void;
  paths?: ComponentProps<typeof TestLinkProvider>['paths'];
  pageSize?: number;
} = {}) =>
  renderWithProviders(
    <TestLinkProvider paths={paths}>
      <BrowserToolCallsProvider>
        <ActivatedSkillsProvider>
          <ThreadViewByTrace
            threadId={THREAD_ID}
            withQueryTrace={withQueryTrace}
            withFeedback={withFeedback}
            pageSize={pageSize}
            onOpenScore={onOpenScore}
          />
        </ActivatedSkillsProvider>
      </BrowserToolCallsProvider>
    </TestLinkProvider>,
  );

describe('ThreadViewByTrace', () => {
  describe('when the thread contains historical traces', () => {
    afterEach(() => {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('preserves paginated turns across refresh intervals and window focus', async () => {
      stubScrollLayout();
      installHandlers();
      const requested = vi.fn();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          const body = await request.json();
          requested(body);
          const next = requested.mock.calls.length === 2;
          return HttpResponse.json({
            ...queryPageFromList({
              ...threadTracesList,
              spans: [threadTracesList.spans[next ? 0 : 1]],
            }),
            page: { next: next ? null : 'thread-next' },
          });
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      const { queryClient } = renderView();
      await screen.findByText('Chef agent follow-up');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      scrollUpToOldest();
      await screen.findByText('Chef agent run');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(requested.mock.calls[1]?.[0]).toMatchObject({ page: { after: 'thread-next' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(requested).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Chef agent run')).toBeTruthy();
      expect(screen.getByText('Chef agent follow-up')).toBeTruthy();
    });

    it('refreshes only the selected trace on focus and stops after its detail closes', async () => {
      installHandlers();
      const requested = vi.fn();
      server.use(
        ...['trace-a', 'trace-b'].map(traceId =>
          http.get(`${TEST_BASE_URL}/api/observability/traces/${traceId}`, () => {
            requested(traceId);
            return HttpResponse.json(traceId === 'trace-b' ? traceBSpans : traceASpans);
          }),
        ),
      );
      const { queryClient } = renderView();
      await screen.findByText('Chef agent follow-up');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(requested.mock.calls.map(([id]) => id).sort()).toEqual(['trace-a', 'trace-b']);
      requested.mockClear();
      const refocus = () =>
        act(async () => {
          focusManager.setFocused(false);
          focusManager.setFocused(true);
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      await refocus();
      expect(requested).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Chef agent run'));
      await screen.findByRole('heading', { name: /^Span/ });
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(requested.mock.calls).toEqual([['trace-a']]);
      requested.mockClear();
      await refocus();
      expect(requested.mock.calls).toEqual([['trace-a']]);
      fireEvent.click(screen.getByText('Chef agent run'));
      requested.mockClear();
      await refocus();
      expect(requested).not.toHaveBeenCalled();
    });
  });
  it('renders one row per trace, oldest first', async () => {
    installHandlers();
    const { queryClient } = renderView();

    expect(await screen.findByText('Chef agent run')).not.toBeNull();
    expect(await screen.findByText('Chef agent follow-up')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const rows = Array.from(screen.getByTestId('thread-view-by-trace').querySelectorAll('[data-trace-id]')).map(el =>
      el.getAttribute('data-trace-id'),
    );
    expect(rows).toEqual(['trace-a', 'trace-b']);
  });

  it('announces each turn with a divider holding its tabs and shows the trace in a card', async () => {
    installHandlers();
    const { queryClient } = renderView();

    expect(await screen.findByText('Chef agent follow-up')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const rows = screen
      .getAllByTestId('trace-row-timeline')
      .map(el => el.closest<HTMLElement>('[data-trace-id]') as HTMLElement);
    expect(rows).toHaveLength(2);
    for (const [index, row] of rows.entries()) {
      const divider = within(row).getByRole('group', { name: `Turn ${index + 1}` });
      expect(within(divider).getByRole('tab', { name: /Scores/ })).not.toBeNull();
      expect(row.className).not.toContain('border-b');
      expect(row.querySelector('[data-slot=thread-trace-details]')?.className).toContain('rounded-xl');
    }
  });

  it('shows an empty state when the thread has no traces', async () => {
    installHandlers({ list: emptyThreadTracesList });
    renderView();

    expect(await screen.findByText('No traces found for this thread.')).not.toBeNull();
  });

  describe('loading the first page', () => {
    it('shows only the loading status until every turn has its spans, then renders them complete', async () => {
      installHandlers();
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, async ({ params }) => {
          await gate;
          return HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans);
        }),
      );
      const { queryClient } = renderView();

      await waitFor(() => expect(queryClient.isFetching()).toBeGreaterThan(0));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.getByRole('status', { name: 'Loading thread' })).not.toBeNull();
      expect(document.querySelector('[data-trace-id]')).toBeNull();
      // Same boxes as the resolved rows: a `px-4` messages column and one tab pill per tab.
      const skeleton = screen.getByRole('status', { name: 'Loading thread' });
      const messagesColumns = skeleton.querySelectorAll('[data-slot="thread-messages-skeleton"]');
      expect(messagesColumns.length).toBeGreaterThan(0);
      messagesColumns.forEach(column => expect(column.classList.contains('px-4')).toBe(true));
      const firstDivider = skeleton.querySelector('[data-slot="thread-trace-divider-skeleton"]');
      expect(firstDivider?.querySelectorAll('[data-slot="thread-tab-skeleton"]')).toHaveLength(3);
      expect(screen.queryByText('No traces found for this thread.')).toBeNull();

      release();
      await screen.findByText('Chef agent run');
      expect(screen.getByText('Chef agent follow-up')).not.toBeNull();
      expect(screen.queryByRole('status', { name: 'Loading thread' })).toBeNull();
    });

    it('shows one tab pill per tab in the skeleton when feedback is off', async () => {
      installHandlers();
      server.use(http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () => new Promise<never>(() => {})));
      renderView({ withFeedback: false });

      const skeleton = await screen.findByRole('status', { name: 'Loading thread' });
      const firstDivider = skeleton.querySelector('[data-slot="thread-trace-divider-skeleton"]');
      expect(firstDivider?.querySelectorAll('[data-slot="thread-tab-skeleton"]')).toHaveLength(2);
    });

    it('never shows the empty state before the list resolves', async () => {
      installHandlers({ list: emptyThreadTracesList });
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async () => {
          await gate;
          return HttpResponse.json(queryPageFromList(emptyThreadTracesList));
        }),
      );
      renderView();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.queryByText('No traces found for this thread.')).toBeNull();
      release();
      expect(await screen.findByText('No traces found for this thread.')).not.toBeNull();
    });

    it("never shows the previous thread's turns after switching threads", async () => {
      installHandlers();
      const view = (threadId: string) => (
        <TestLinkProvider>
          <BrowserToolCallsProvider>
            <ActivatedSkillsProvider>
              <ThreadViewByTrace threadId={threadId} withQueryTrace />
            </ActivatedSkillsProvider>
          </BrowserToolCallsProvider>
        </TestLinkProvider>
      );
      const { rerender } = renderWithProviders(view(THREAD_ID));
      await screen.findByText('Chef agent follow-up');

      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async () => {
          await gate;
          return HttpResponse.json(queryPageFromList(emptyThreadTracesList));
        }),
      );
      rerender(view('other-thread'));
      expect(screen.queryByText('Chef agent follow-up')).toBeNull();
      expect(screen.getByRole('status', { name: 'Loading thread' })).not.toBeNull();
      release();
      expect(await screen.findByText('No traces found for this thread.')).not.toBeNull();
    });
  });

  it('opens the span details beside the conversation when a span is clicked, and closes it', async () => {
    installHandlers();
    const { queryClient } = renderView();

    fireEvent.click(await screen.findByText('Chef agent run'));

    await screen.findByRole('heading', { name: /^Span/ });
    // The conversation column stays mounted while the span panel is open.
    expect(screen.getByTestId('thread-view-by-trace')).not.toBeNull();
    expect(screen.getByText('Chef agent follow-up')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Re-clicking the selected span toggles the span panel off.
    fireEvent.click(screen.getByText('Chef agent run'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Span/ })).toBeNull());
  });

  it('keeps the row of the selected span highlighted while its details are open', async () => {
    installHandlers();
    const { queryClient } = renderView();

    const rowOf = (traceId: string) =>
      screen.getByTestId('thread-view-by-trace').querySelector(`[data-trace-id="${traceId}"]`);

    fireEvent.click(await screen.findByText('Chef agent run'));
    await screen.findByRole('heading', { name: /^Span/ });

    expect(rowOf('trace-a')?.getAttribute('data-active')).toBe('true');
    expect(rowOf('trace-b')?.getAttribute('data-active')).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByText('Chef agent run'));
    await waitFor(() => expect(rowOf('trace-a')?.getAttribute('data-active')).toBeNull());
  });

  describe('highlighting the spans behind a message', () => {
    const spanLabel = (name: string) => screen.getByLabelText(`View details for span ${name}`);

    it('expanding a tool call does not touch the timeline', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [toolBadge] = await screen.findAllByTestId('tool-badge');
      if (!toolBadge) throw new Error('expected a tool badge for the tool part');
      await screen.findByLabelText('View details for span Recipe lookup');

      fireEvent.click(within(toolBadge).getAllByRole('button')[0] as HTMLElement);

      expect(spanLabel('Recipe lookup').getAttribute('aria-selected')).toBe('false');
      expect(screen.queryByRole('heading', { name: /^Span/ })).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it("the tool call's highlight action fades the other spans of that trace without opening a span", async () => {
      installHandlers();
      const { queryClient } = renderView();

      // trace-a renders user, tool, assistant; the tool part is backed by the root span and its tool call.
      const [, toolAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!toolAction) throw new Error('expected a highlight action on the tool call');
      await screen.findByLabelText('View details for span Recipe lookup');

      expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30');
      fireEvent.click(toolAction);

      // Nothing to fade in trace-a for the tool part (all its spans are featured)...
      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30');
      // ...and the other trace's tree is untouched.
      expect(spanLabel('Chef agent follow-up').className).not.toContain('opacity-30');
      // Highlighting is a timeline-only affordance: no span is selected and the panel stays closed,
      // so opening a span remains the user's own click.
      expect(screen.queryByRole('heading', { name: /^Span/ })).toBeNull();
      expect(spanLabel('Recipe lookup').getAttribute('aria-selected')).toBe('false');
      expect(spanLabel('Chef agent run').getAttribute('aria-selected')).toBe('false');
      // The most specific span behind the message (last id, deepest in the tree) is brought into
      // view, since it is the one most likely to sit below the fold — not the root.
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(screen.getByLabelText('View details for span Recipe lookup'));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('the text reply highlights only the root span, not the tool call', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [, , assistantAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!assistantAction) throw new Error('expected a highlight action on the text reply');
      await screen.findByLabelText('View details for span Recipe lookup');

      fireEvent.click(assistantAction);

      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).toContain('opacity-30');
      // The root is the only span behind the reply, so it is the one revealed.
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(screen.getByLabelText('View details for span Chef agent run'));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('only keeps the spans behind the user message visible', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [userAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!userAction) throw new Error('expected a highlight action per message');
      await screen.findByLabelText('View details for span Recipe lookup');

      fireEvent.click(userAction);

      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).toContain('opacity-30');
      expect(spanLabel('Chef agent follow-up').className).not.toContain('opacity-30');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('clears the highlight when the span panel is closed', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [userAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!userAction) throw new Error('expected a highlight action per message');
      await screen.findByLabelText('View details for span Recipe lookup');

      fireEvent.click(userAction);
      expect(spanLabel('Recipe lookup').className).toContain('opacity-30');

      // Highlighting does not open the panel, so open a span by hand and then close it.
      fireEvent.click(spanLabel('Recipe lookup'));
      await screen.findByRole('heading', { name: /^Span/ });
      fireEvent.click(spanLabel('Recipe lookup'));
      await waitFor(() => expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30'));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  it('keeps every row at full opacity, whichever is in view', async () => {
    const { intersect } = stubIntersectionObserver();
    installHandlers();
    const { queryClient } = renderView();

    await screen.findByText('Chef agent follow-up');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    const rowOf = (traceId: string) =>
      screen
        .getByTestId('thread-view-by-trace')
        .querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`) as HTMLElement;

    act(() => intersect(rowOf('trace-a')));

    expect(rowOf('trace-a').className).not.toMatch(/opacity/);
    expect(rowOf('trace-b').className).not.toMatch(/opacity/);
    vi.unstubAllGlobals();
  });

  describe('truncating a long trace to the height of its messages', () => {
    afterEach(() => vi.restoreAllMocks());

    const timelineOf = (traceId: string) =>
      screen
        .getByTestId('thread-view-by-trace')
        .querySelector<HTMLElement>(`[data-trace-id="${traceId}"] [data-testid="trace-row-timeline"]`);

    it('clamps the timeline to the messages height and reveals it with Expand / Collapse', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderView();

      const [showMore] = await screen.findAllByRole('button', { name: 'Expand' });
      if (!showMore) throw new Error('expected an Expand button');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(
        timelineOf('trace-a')?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight,
      ).toBe('300px');

      fireEvent.click(showMore);
      expect(
        timelineOf('trace-a')?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight,
      ).toBe('');
      const showLess = screen.getByRole('button', { name: 'Collapse' });

      fireEvent.click(showLess);
      expect(
        timelineOf('trace-a')?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight,
      ).toBe('300px');
    });

    it('does not offer Expand when the timeline already fits', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 200 });
      installHandlers();
      const { queryClient } = renderView();

      await screen.findByText('Chef agent run');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
      // The clamp stays on so the cell never grows past the messages column while the
      // timeline remeasures after a tab switch; a shorter timeline is unaffected by it.
      expect(
        timelineOf('trace-a')?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight,
      ).toBe('300px');
    });

    it('expands the row when one of its spans is selected and keeps it expanded afterwards', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderView();

      await screen.findAllByRole('button', { name: 'Expand' });
      fireEvent.click(await screen.findByText('Chef agent run'));
      await screen.findByRole('heading', { name: /^Span/ });

      expect(
        timelineOf('trace-a')?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight,
      ).toBe('');
      // Collapsing would hide the selection, so the control is withheld while a span is open.
      expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      fireEvent.click(screen.getByText('Chef agent run'));
      await waitFor(() => expect(screen.queryByRole('heading', { name: /^Span/ })).toBeNull());
      expect(
        timelineOf('trace-a')?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight,
      ).toBe('');
      expect(screen.getByRole('button', { name: 'Collapse' })).not.toBeNull();
    });
  });

  describe('the trace panel tabs', () => {
    it('links each row to its trace on the traces page', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView();

      const firstRow = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);

      expect(firstRow.getByRole('link', { name: 'Go to trace' }).getAttribute('href')).toBe('/traces?traceId=trace-a');
    });

    it('hides "Go to trace" when the app has no trace route', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView({ paths: { traceLink: () => '' } });

      const firstRow = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);

      expect(firstRow.queryByRole('link', { name: 'Go to trace' })).toBeNull();
    });

    describe('given a scored trace', () => {
      it('when scorerLink resolves, then "Open scorer run" links to the scorer run built by the link provider', async () => {
        installHandlers();
        installFeedbackHandlers();
        installScore();
        renderView();

        const row = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);
        fireEvent.click(row.getByRole('tab', { name: /Scores/ }));

        const link = await row.findByRole('link', { name: /Open scorer run/ });
        expect(link.getAttribute('href')).toBe('/scorers/scorer-1?scoreId=score-1');
      });

      it('when the app has no scorer route, then "Open scorer run" is hidden', async () => {
        installHandlers();
        installFeedbackHandlers();
        installScore();
        renderView({ paths: { scorerLink: () => '' } });

        const row = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);
        fireEvent.click(row.getByRole('tab', { name: /Scores/ }));

        expect(await row.findByRole('button', { name: /^Score / })).not.toBeNull();
        expect(row.queryByRole('link', { name: /Open scorer run/ })).toBeNull();
      });
    });

    it('shows the messages by default and swaps them for the feedback thread on the Feedback tab, keeping the span tree', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView();

      const firstRow = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);

      // The messages column carries the Messages / Feedback / Scores tabs; the details column only has the tree.
      expect(screen.queryByRole('button', { name: 'Toggle feedback' })).toBeNull();
      expect(firstRow.queryByRole('tab', { name: /Spans/ })).toBeNull();
      expect(firstRow.getByRole('tab', { name: /Messages/ }).getAttribute('aria-selected')).toBe('true');
      expect(firstRow.queryByPlaceholderText('Leave feedback...')).toBeNull();

      fireEvent.click(await firstRow.findByRole('tab', { name: /Feedback/ }));

      expect(await firstRow.findByPlaceholderText('Leave feedback...')).not.toBeNull();
      expect(firstRow.getByRole('tab', { name: /Messages/ }).getAttribute('aria-selected')).toBe('false');
      expect(firstRow.getByText('Chef agent run')).not.toBeNull();
    });

    it('shows the scores of the root span on the Scores tab', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView();

      const firstRow = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);

      fireEvent.click(firstRow.getByRole('tab', { name: /Scores/ }));

      expect(await firstRow.findByText('No scores yet')).not.toBeNull();
    });

    it('fetches scores only once a Scores tab is opened', async () => {
      installHandlers();
      installFeedbackHandlers();
      const scoreRequests: string[] = [];
      server.events.on('request:start', ({ request }) => {
        if (new URL(request.url).pathname.endsWith('/scores')) scoreRequests.push(request.url);
      });
      renderView();

      const row = (await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement;
      // Give the per-row span queries time to resolve (the old badge query fired right after).
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(scoreRequests).toHaveLength(0);

      fireEvent.click(within(row).getByRole('tab', { name: /Scores/ }));
      expect(await within(row).findByText('No scores yet')).not.toBeNull();
      expect(scoreRequests.every(url => url.includes(`/traces/${row.getAttribute('data-trace-id')}/`))).toBe(true);
      expect(scoreRequests.length).toBeGreaterThan(0);
      expect(within(row).getByRole('tab', { name: /Scores/ }).textContent).toBe('Scores');

      server.events.removeAllListeners('request:start');
    });

    it('hands the trace and score ids to onOpenScore when a score is selected', async () => {
      installHandlers();
      installFeedbackHandlers();
      installScore();
      const onOpenScore = vi.fn<(traceId: string, scoreId: string) => void>();
      renderView({ onOpenScore });

      const row = (await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement;
      const traceId = row.getAttribute('data-trace-id');
      fireEvent.click(within(row).getByRole('tab', { name: /Scores/ }));
      fireEvent.click(await within(row).findByRole('button', { name: /^Score / }));

      expect(onOpenScore).toHaveBeenCalledWith(traceId, 'score-1');
    });

    it('does not fetch feedback until the Feedback tab is opened', async () => {
      installHandlers();
      const onFeedbackRequest = vi.fn();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onFeedbackRequest();
          return HttpResponse.json(traceAFeedback);
        }),
      );
      renderView();

      const firstRow = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);
      // Both rows are rendered with their tabs, yet no row fetched feedback for a badge.
      expect(screen.getAllByRole('tab', { name: 'Feedback' }).length).toBeGreaterThan(1);
      expect(onFeedbackRequest).not.toHaveBeenCalled();

      fireEvent.click(firstRow.getByRole('tab', { name: 'Feedback' }));

      expect(await firstRow.findByPlaceholderText('Leave feedback...')).not.toBeNull();
      await waitFor(() => expect(onFeedbackRequest).toHaveBeenCalled());
    });

    it('submits trace-level feedback from the Feedback tab', async () => {
      installHandlers();
      const onPost = vi.fn();
      installFeedbackHandlers();
      server.use(
        http.post(FEEDBACK_URL, async ({ request }) => {
          onPost((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ success: true });
        }),
      );

      renderView();

      await screen.findByText('Chef agent run');
      fireEvent.click((await screen.findAllByRole('tab', { name: /Feedback/ }))[0]);

      const input = await screen.findByPlaceholderText('Leave feedback...');
      fireEvent.change(input, { target: { value: 'great turn' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

      await waitFor(() => expect(onPost).toHaveBeenCalled());
      expect(onPost.mock.calls[0][0]).toMatchObject({
        feedback: { traceId: 'trace-a', value: 'great turn' },
      });
    });
  });

  describe('when feedback is disabled', () => {
    it('shows no Feedback tab and never requests feedback', async () => {
      installHandlers();
      const onFeedback = vi.fn();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onFeedback();
          return HttpResponse.json(listFeedbackResponse([]));
        }),
      );
      renderView({ withFeedback: false });

      const firstRow = within((await screen.findByText('Chef agent run')).closest('[data-trace-id]') as HTMLElement);

      expect(firstRow.getByRole('tab', { name: /Scores/ })).not.toBeNull();
      expect(screen.queryByRole('tab', { name: /Feedback/ })).toBeNull();
      expect(onFeedback).not.toHaveBeenCalled();
    });
  });

  describe.each([true, false])('as a chat (withQueryTrace=%s)', withQueryTrace => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    // trace-b is the newest turn, trace-a the oldest; each page holds one of them.
    const pages = [threadTracesList.spans[1], threadTracesList.spans[0]];

    type Request = { order: string | undefined; size: number; next: boolean; params: Record<string, unknown> };

    const installPagedHandlers = ({ lastPage = 1, overlap = false } = {}) => {
      installHandlers();
      const requests: Request[] = [];
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          const body = (await request.json()) as {
            orderBy: Array<{ direction: string }>;
            page: { limit: number; after?: string };
          };
          const index = body.page.after ? 1 : 0;
          requests.push({ order: body.orderBy[0]?.direction, size: body.page.limit, next: index > 0, params: body });
          return HttpResponse.json({
            ...queryPageFromList({ ...threadTracesList, spans: [pages[index]] }),
            page: { next: index < lastPage ? 'older' : null },
          });
        }),
        http.get(`${TEST_BASE_URL}/api/observability/traces/light`, ({ request }) => {
          const params = Object.fromEntries(new URL(request.url).searchParams);
          const index = Number(params.page ?? 0);
          requests.push({ order: params.direction, size: Number(params.perPage), next: index > 0, params });
          // An offset page can repeat the last row of the previous one when a turn lands mid-paging.
          const spans = overlap && index > 0 ? [pages[0], pages[index]] : [pages[index]];
          return HttpResponse.json({
            spans,
            pagination: { total: 2, page: index, perPage: 1, hasMore: index < lastPage },
          } satisfies typeof threadTracesList);
        }),
      );
      return requests;
    };

    const rowIds = () =>
      [...screen.getByTestId('thread-view-by-trace').querySelectorAll<HTMLElement>('[data-trace-id]')].map(
        row => row.dataset.traceId,
      );

    it('requests the newest turns first and reads them oldest to newest', async () => {
      const requests = installPagedHandlers();
      stubScrollLayout();
      renderView({ withQueryTrace });
      await screen.findByText('Chef agent follow-up');

      expect(requests[0]?.order).toBe(withQueryTrace ? 'desc' : 'DESC');
      scrollUpToOldest();
      await screen.findByText('Chef agent run');
      expect(rowIds()).toEqual(['trace-a', 'trace-b']);
    });

    it('loads 10 turns per page by default, or the given pageSize', async () => {
      const requests = installPagedHandlers();
      const { unmount } = renderView({ withQueryTrace });
      await screen.findByText('Chef agent follow-up');
      expect(requests[0]?.size).toBe(10);
      unmount();

      renderView({ withQueryTrace, pageSize: 4 });
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]?.size).toBe(4);
    });

    it('searches the last 31 days (the trace query maximum) and the whole thread with the legacy list', async () => {
      const requests = installPagedHandlers();
      renderView({ withQueryTrace });
      await screen.findByText('Chef agent follow-up');

      if (withQueryTrace) {
        const { from, to } = (requests[0]?.params as { timeRange: { from: string; to: string } }).timeRange;
        const days = (Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000);
        expect(days).toBe(31);
      } else {
        expect(requests[0]?.params.threadId).toBe(THREAD_ID);
        expect(requests[0]?.params).not.toHaveProperty('startedAt');
      }
    });

    it('opens at the latest turn and stays there while rows grow, until the reader scrolls up', async () => {
      installPagedHandlers();
      const { grow } = stubScrollLayout();
      renderView({ withQueryTrace });
      await screen.findByText('Chef agent follow-up');
      const viewport = viewportOf();

      await waitFor(() => expect(viewport.scrollTop).toBe(600));

      act(() => grow(1200));
      expect(viewport.scrollTop).toBe(800);

      // The reader scrolls up: growth no longer pulls them back down.
      act(() => scrollReaderTo(viewport, 300));
      act(() => grow(1500));
      expect(viewport.scrollTop).toBe(300);
    });

    it('loads older turns above when the reader reaches the top, keeping their place, and stops at the end', async () => {
      const requests = installPagedHandlers();
      const { setScrollHeight } = stubScrollLayout();
      const { queryClient } = renderView({ withQueryTrace });
      await screen.findByText('Chef agent follow-up');
      const viewport = viewportOf();
      await waitFor(() => expect(viewport.scrollTop).toBe(600));

      act(() => scrollReaderTo(viewport, 0));
      // The older row adds 500px above the reader.
      setScrollHeight(1500);
      await screen.findByText('Chef agent run');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(requests.map(request => request.next)).toEqual([false, true]);
      expect(rowIds()).toEqual(['trace-a', 'trace-b']);
      expect(viewport.scrollTop).toBe(500);

      // No older page: reaching the top again requests nothing.
      act(() => scrollReaderTo(viewport, 200));
      act(() => scrollReaderTo(viewport, 0));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(requests).toHaveLength(2);
    });

    if (!withQueryTrace) {
      it('renders a turn repeated across offset pages once', async () => {
        installPagedHandlers({ overlap: true });
        stubScrollLayout();
        const { queryClient } = renderView({ withQueryTrace });
        await screen.findByText('Chef agent follow-up');

        scrollUpToOldest();
        await screen.findByText('Chef agent run');
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));
        expect(rowIds()).toEqual(['trace-a', 'trace-b']);
      });
    }
  });
});
