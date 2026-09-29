// @vitest-environment jsdom
import type { ListScoresResponse } from '@mastra/client-js';
import '@/test/jsdom-polyfills';
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
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

const renderView = ({
  search = '',
  withFeedback = true,
  onOpenScore = () => {},
}: { search?: string; withFeedback?: boolean; onOpenScore?: (traceId: string, scoreId: string) => void } = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <BrowserToolCallsProvider>
        <ActivatedSkillsProvider>
          <ThreadViewByTrace
            threadId={THREAD_ID}
            withQueryTrace
            withFeedback={withFeedback}
            anchorTraceId={new URLSearchParams(search).get('traceId') ?? undefined}
            onOpenScore={onOpenScore}
          />
        </ActivatedSkillsProvider>
      </BrowserToolCallsProvider>
    </TestLinkProvider>,
  );

const rowOf = (traceId: string) =>
  screen.getByTestId('thread-view-by-trace').querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`) as HTMLElement;
const traceColumn = () => within(screen.getByTestId('thread-trace-trace-panel'));
const spanHeading = () => screen.queryByRole('heading', { name: /^Span/ });

/** Opens a turn's trace column from its divider and waits for its span tree. */
const showTrace = async (turn: number, rootSpan: string) => {
  fireEvent.click(await screen.findByRole('button', { name: `Show trace for turn ${turn}` }));
  return traceColumn().findByText(rootSpan);
};

describe('ThreadViewByTrace', () => {
  describe('when the thread contains historical traces', () => {
    afterEach(() => {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('preserves paginated turns across refresh intervals and window focus', async () => {
      const { intersect } = stubIntersectionObserver();
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
              spans: [threadTracesList.spans[next ? 1 : 0]],
            }),
            page: { next: next ? null : 'thread-next' },
          });
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      const { queryClient } = renderView();
      await screen.findByText('Turn 1');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      const list = screen.getByTestId('thread-view-by-trace');
      act(() => intersect(list.querySelector('[data-trace-id]')?.nextElementSibling as Element));
      await screen.findByText('Turn 2');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(requested.mock.calls[1]?.[0]).toMatchObject({ page: { after: 'thread-next' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(requested).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Turn 1')).toBeTruthy();
      expect(screen.getByText('Turn 2')).toBeTruthy();
    });

    it('refreshes only the open trace on focus and stops after it is hidden', async () => {
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
      await screen.findByText('Turn 2');
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
      fireEvent.click(await showTrace(1, 'Chef agent run'));
      await screen.findByRole('heading', { name: /^Span/ });
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      requested.mockClear();
      await refocus();
      expect(requested.mock.calls).toEqual([['trace-a']]);
      fireEvent.click(traceColumn().getByText('Chef agent run'));
      await waitFor(() => expect(spanHeading()).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'Hide trace for turn 1' }));
      await waitFor(() => expect(screen.queryByTestId('thread-trace-trace-panel')).toBeNull());
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      requested.mockClear();
      await refocus();
      expect(requested).not.toHaveBeenCalled();
    });
  });

  it('renders only the conversation, one row per trace oldest first, each opened by a "Turn N" divider', async () => {
    installHandlers();
    const { queryClient } = renderView();

    expect(await screen.findByText('Turn 2')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const rows = Array.from(screen.getByTestId('thread-view-by-trace').querySelectorAll('[data-trace-id]')).map(el =>
      el.getAttribute('data-trace-id'),
    );
    expect(rows).toEqual(['trace-a', 'trace-b']);
    expect(within(rowOf('trace-a')).getByText('Turn 1')).not.toBeNull();
    expect(within(rowOf('trace-a')).getByText('cook pasta')).not.toBeNull();
    expect(screen.queryByText('Chef agent run')).toBeNull();
    expect(screen.queryByTestId('thread-trace-trace-panel')).toBeNull();
  });

  it('shows an empty state when the thread has no traces', async () => {
    installHandlers({ list: emptyThreadTracesList });
    renderView();

    expect(await screen.findByText('No traces found for this thread.')).not.toBeNull();
  });

  it('opens a turn trace beside the conversation, swaps it for another turn, and hides it', async () => {
    installHandlers();
    const { queryClient } = renderView();

    await showTrace(1, 'Chef agent run');
    expect(rowOf('trace-a').getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: 'Hide trace for turn 1' }).getAttribute('aria-pressed')).toBe('true');

    await showTrace(2, 'Chef agent follow-up');
    expect(traceColumn().queryByText('Chef agent run')).toBeNull();
    expect(rowOf('trace-a').getAttribute('data-active')).toBeNull();
    expect(rowOf('trace-b').getAttribute('data-active')).toBe('true');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByRole('button', { name: 'Hide trace for turn 2' }));
    await waitFor(() => expect(screen.queryByTestId('thread-trace-trace-panel')).toBeNull());
  });

  it('opens the span details in a third column when a span is clicked, and closes it', async () => {
    installHandlers();
    const { queryClient } = renderView();

    fireEvent.click(await showTrace(1, 'Chef agent run'));

    await screen.findByRole('heading', { name: /^Span/ });
    // The conversation and trace columns stay mounted while the span column is open.
    expect(screen.getByText('Turn 2')).not.toBeNull();
    expect(traceColumn().getByText('Chef agent run')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Re-clicking the selected span toggles the span column off; the trace stays open.
    fireEvent.click(traceColumn().getByText('Chef agent run'));
    await waitFor(() => expect(spanHeading()).toBeNull());
    expect(traceColumn().getByText('Chef agent run')).not.toBeNull();
  });

  it('closes the span column when another turn trace is opened', async () => {
    installHandlers();
    const { queryClient } = renderView();

    fireEvent.click(await showTrace(1, 'Chef agent run'));
    await screen.findByRole('heading', { name: /^Span/ });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await showTrace(2, 'Chef agent follow-up');
    await waitFor(() => expect(spanHeading()).toBeNull());
  });

  it('shows a rail with one stop per turn that jumps to the matching row', async () => {
    installHandlers();
    const { queryClient } = renderView();

    // trace-a reconstructs a user turn, so its stop carries the prompt.
    const stop = await screen.findByRole('button', { name: 'Jump to cook pasta' });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByTestId('thread-rail').querySelectorAll('button')).toHaveLength(2);

    scrollIntoView.mockClear();
    fireEvent.click(stop);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(rowOf('trace-a'));
  });

  describe('arriving from a trace with ?traceId', () => {
    it('scrolls to that row without opening its trace', async () => {
      installHandlers();
      const { queryClient } = renderView({ search: '?traceId=trace-b' });

      await screen.findByRole('button', { name: 'Show trace for turn 2' });
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const row = rowOf('trace-b');
      await waitFor(() => expect(scrollIntoView.mock.instances).toContain(row));
      expect(scrollIntoView.mock.instances.filter(el => el === row)).toHaveLength(1);
      expect(row.getAttribute('data-active')).toBeNull();
      expect(screen.queryByText('Chef agent follow-up')).toBeNull();
    });

    it('opens nothing when the trace is not in the loaded page', async () => {
      installHandlers();
      const { queryClient } = renderView({ search: '?traceId=trace-missing' });

      await screen.findByText('Turn 2');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(screen.queryByText('Chef agent run')).toBeNull();
    });

    it('does not scroll to the row when it only arrives on a later page', async () => {
      const { intersect } = stubIntersectionObserver();
      // Query pages append newer turns in ascending order.
      const pages = [
        { spans: [threadTracesList.spans[0]], pagination: { total: 2, page: 0, perPage: 1, hasMore: true } },
        { spans: [threadTracesList.spans[1]], pagination: { total: 2, page: 1, perPage: 1, hasMore: false } },
      ];
      const requested = vi.fn();
      installHandlers();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({ orderBy: [{ field: 'startedAt', direction: 'asc' }] });
          requested(body);
          const next = requested.mock.calls.length === 2;
          expect(body).toMatchObject({ page: next ? { after: 'thread-next' } : { limit: 25 } });
          return HttpResponse.json({
            ...queryPageFromList(pages[next ? 1 : 0]),
            page: { next: next ? null : 'thread-next' },
          });
        }),
      );
      const { queryClient } = renderView({ search: '?traceId=trace-b' });

      await screen.findByText('Turn 1');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByText('Turn 2')).toBeNull();

      const list = screen.getByTestId('thread-view-by-trace');
      const sentinel = list.querySelector('[data-trace-id]')?.nextElementSibling as Element;
      act(() => intersect(sentinel));

      expect(await screen.findByText('Turn 2')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(requested).toHaveBeenCalledTimes(2);
      expect([...list.querySelectorAll('[data-trace-id]')].map(row => row.getAttribute('data-trace-id'))).toEqual([
        'trace-a',
        'trace-b',
      ]);
      expect(scrollIntoView).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('highlighting the spans behind a message', () => {
    const spanLabel = (name: string) => screen.getByLabelText(`View details for span ${name}`);

    it('expanding a tool call does not open the trace', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [toolBadge] = await screen.findAllByTestId('tool-badge');
      if (!toolBadge) throw new Error('expected a tool badge for the tool part');

      fireEvent.click(within(toolBadge).getAllByRole('button')[0] as HTMLElement);

      expect(screen.queryByTestId('thread-trace-trace-panel')).toBeNull();
      expect(spanHeading()).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it("the tool call's highlight action opens that turn's trace with its spans featured, without opening a span", async () => {
      installHandlers();
      const { queryClient } = renderView();

      // trace-a renders user, tool, assistant; the tool part is backed by the root span and its tool call.
      const [, toolAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!toolAction) throw new Error('expected a highlight action on the tool call');
      fireEvent.click(toolAction);

      await traceColumn().findByLabelText('View details for span Recipe lookup');
      expect(rowOf('trace-a').getAttribute('data-active')).toBe('true');
      // All spans behind the tool part are featured, so nothing fades.
      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30');
      // Highlighting never selects a span: opening one remains the user's own click.
      expect(spanHeading()).toBeNull();
      expect(spanLabel('Recipe lookup').getAttribute('aria-selected')).toBe('false');
      // The most specific span behind the message (last id, deepest in the tree) is brought into view.
      await waitFor(() => expect(scrollIntoView.mock.instances).toContain(spanLabel('Recipe lookup')));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('the text reply highlights only the root span, not the tool call', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [, , assistantAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!assistantAction) throw new Error('expected a highlight action on the text reply');
      fireEvent.click(assistantAction);

      await traceColumn().findByLabelText('View details for span Recipe lookup');
      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).toContain('opacity-30');
      await waitFor(() => expect(scrollIntoView.mock.instances).toContain(spanLabel('Chef agent run')));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('clears the highlight when the trace column is hidden', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [userAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!userAction) throw new Error('expected a highlight action per message');
      fireEvent.click(userAction);
      await traceColumn().findByLabelText('View details for span Recipe lookup');
      expect(spanLabel('Recipe lookup').className).toContain('opacity-30');

      fireEvent.click(screen.getByRole('button', { name: 'Hide trace for turn 1' }));
      await showTrace(1, 'Chef agent run');
      expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('the trace column tabs', () => {
    it('links the open trace to the traces page', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView();

      await showTrace(1, 'Chef agent run');
      expect(traceColumn().getByRole('link', { name: 'Go to trace' }).getAttribute('href')).toBe(
        '/traces?traceId=trace-a',
      );
    });

    it('shows the span tree by default and swaps it for the feedback thread on the Feedback tab', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView();

      await showTrace(1, 'Chef agent run');
      expect(traceColumn().getByRole('tab', { name: /Spans/ }).getAttribute('aria-selected')).toBe('true');
      expect(traceColumn().queryByPlaceholderText('Leave feedback...')).toBeNull();

      fireEvent.click(await traceColumn().findByRole('tab', { name: /Feedback/ }));

      expect(await traceColumn().findByPlaceholderText('Leave feedback...')).not.toBeNull();
      expect(traceColumn().getByRole('tab', { name: /Spans/ }).getAttribute('aria-selected')).toBe('false');
    });

    it('shows the scores of the root span on the Scores tab', async () => {
      installHandlers();
      installFeedbackHandlers();
      renderView();

      await showTrace(1, 'Chef agent run');
      fireEvent.click(traceColumn().getByRole('tab', { name: /Scores/ }));

      expect(await traceColumn().findByText('No scores yet')).not.toBeNull();
    });

    it('hands the trace and score ids to onOpenScore when a score is selected', async () => {
      installHandlers();
      installFeedbackHandlers();
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
      const onOpenScore = vi.fn<(traceId: string, scoreId: string) => void>();
      renderView({ onOpenScore });

      await showTrace(1, 'Chef agent run');
      fireEvent.click(traceColumn().getByRole('tab', { name: /Scores/ }));
      fireEvent.click(await traceColumn().findByRole('button', { name: /^Score / }));

      expect(onOpenScore).toHaveBeenCalledWith('trace-a', 'score-1');
    });

    it('shows the feedback count on the Feedback tab', async () => {
      installHandlers();
      installFeedbackHandlers(
        listFeedbackResponse([
          feedbackRecord({ feedbackId: 'trace-a-fb-1', traceId: 'trace-a', reviewStatus: 'needs-review' }),
        ]),
      );
      renderView();

      await showTrace(1, 'Chef agent run');
      expect(await traceColumn().findByRole('tab', { name: /^Feedback \(1\)/ })).not.toBeNull();
    });

    it('shows a zero count on the Feedback tab when there is no feedback', async () => {
      installHandlers();
      installFeedbackHandlers(listFeedbackResponse([]));
      renderView();

      await showTrace(1, 'Chef agent run');
      expect(await traceColumn().findByRole('tab', { name: /^Feedback \(0\)/ })).not.toBeNull();
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

      await showTrace(1, 'Chef agent run');
      fireEvent.click(await traceColumn().findByRole('tab', { name: /Feedback/ }));

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

      await showTrace(1, 'Chef agent run');

      expect(traceColumn().getByRole('tab', { name: /Scores/ })).not.toBeNull();
      expect(screen.queryByRole('tab', { name: /Feedback/ })).toBeNull();
      expect(onFeedback).not.toHaveBeenCalled();
    });
  });
});
