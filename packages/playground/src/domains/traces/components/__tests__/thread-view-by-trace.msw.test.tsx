import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedbackRecord, listFeedbackResponse } from '../../hooks/__tests__/fixtures/trace-feedback';
import { ThreadViewByTrace } from '../thread-view-by-trace';
import {
  THREAD_ID,
  emptyThreadTracesList,
  spanADetail,
  threadTracesList,
  traceASpans,
  traceBSpans,
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
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(list)),
    http.get(`${TEST_BASE_URL}/api/observability/traces`, () => HttpResponse.json(list)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () => HttpResponse.json(spanADetail)),
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

const renderView = ({ search = '' }: { search?: string } = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <BrowserToolCallsProvider>
        <ActivatedSkillsProvider>
          <ThreadViewByTrace threadId={THREAD_ID} />
        </ActivatedSkillsProvider>
      </BrowserToolCallsProvider>
    </TestLinkProvider>,
    { router: { initialEntries: [`/agents/chef/threads/${THREAD_ID}${search}`] } },
  );

describe('ThreadViewByTrace', () => {
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

  it('shows an empty state when the thread has no traces', async () => {
    installHandlers({ list: emptyThreadTracesList });
    renderView();

    expect(await screen.findByText('No traces found for this thread.')).not.toBeNull();
  });

  it('opens the span details beside the conversation when a span is clicked, and closes it', async () => {
    installHandlers();
    const { queryClient } = renderView();

    fireEvent.click(await screen.findByText('Chef agent run'));

    // The span panel is the only place with a close button; its detail body shows the span input.
    const closeButton = await screen.findByRole('button', { name: /close/i });
    // The conversation column stays mounted while the span panel is open.
    expect(screen.getByTestId('thread-view-by-trace')).not.toBeNull();
    expect(screen.getByText('Chef agent follow-up')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(closeButton);
    await waitFor(() => expect(screen.queryByRole('button', { name: /close/i })).toBeNull());
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
    const row = screen.getByTestId('thread-view-by-trace').querySelector('[data-trace-id="trace-a"]');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(row);
  });

  describe('arriving from a trace with ?traceId', () => {
    it('scrolls to that row and shows its trace in full', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderView({ search: '?traceId=trace-b' });

      await screen.findByText('Chef agent follow-up');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const row = screen.getByTestId('thread-view-by-trace').querySelector('[data-trace-id="trace-b"]');
      await waitFor(() => expect(scrollIntoView.mock.instances).toContain(row));
      // The row is expanded so the whole trace is readable; nothing else was scrolled to.
      expect(scrollIntoView.mock.instances.filter(el => el === row)).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Show less' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Show more' })).toHaveLength(1);
      vi.restoreAllMocks();
    });

    it('does nothing when the trace is not in the loaded page', async () => {
      installHandlers();
      const { queryClient } = renderView({ search: '?traceId=trace-missing' });

      await screen.findByText('Chef agent follow-up');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('links each turn to its trace on the traces page', async () => {
    installHandlers();
    const { queryClient } = renderView();

    const [link] = await screen.findAllByRole('link', { name: 'Go to trace' });
    expect(link.getAttribute('href')).toBe('/traces?traceId=trace-a');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('keeps the row of the selected span highlighted while its details are open', async () => {
    installHandlers();
    const { queryClient } = renderView();

    const rowOf = (traceId: string) =>
      screen.getByTestId('thread-view-by-trace').querySelector(`[data-trace-id="${traceId}"]`);

    fireEvent.click(await screen.findByText('Chef agent run'));
    await screen.findByRole('button', { name: /close/i });

    expect(rowOf('trace-a')?.getAttribute('data-active')).toBe('true');
    expect(rowOf('trace-b')?.getAttribute('data-active')).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(rowOf('trace-a')?.getAttribute('data-active')).toBeNull());
  });

  describe('highlighting the spans behind a message', () => {
    const spanLabel = (name: string) => screen.getByLabelText(`View details for span ${name}`);

    it('opening a tool call fades the other spans of that trace and opens the tool span', async () => {
      installHandlers();
      const { queryClient } = renderView();

      // The tool part of trace-a is backed by the root span and its tool call.
      const [toolBadge] = await screen.findAllByTestId('tool-badge');
      if (!toolBadge) throw new Error('expected a tool badge for the tool part');
      const toolTrigger = within(toolBadge).getAllByRole('button')[0]!;
      await screen.findByLabelText('View details for span Recipe lookup');

      expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30');
      fireEvent.click(toolTrigger);

      // Nothing to fade in trace-a for the tool part (all its spans are featured)...
      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30');
      // ...and the other trace's tree is untouched.
      expect(spanLabel('Chef agent follow-up').className).not.toContain('opacity-30');
      // The detail panel opens on the last highlighted span (the deepest step, not the root),
      // and the timeline scrolls that row into view.
      expect(await screen.findByRole('button', { name: /close/i })).not.toBeNull();
      expect(spanLabel('Recipe lookup').className).toContain('bg-surface4');
      expect(spanLabel('Chef agent run').className).not.toContain('bg-surface4');
      expect(scrollIntoView).toHaveBeenCalled();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('the text reply highlights only the root span, not the tool call', async () => {
      installHandlers();
      const { queryClient } = renderView();

      const [, assistantAction] = await screen.findAllByRole('button', { name: 'Highlight spans' });
      if (!assistantAction) throw new Error('expected a highlight action on the text reply');
      await screen.findByLabelText('View details for span Recipe lookup');

      fireEvent.click(assistantAction);

      expect(spanLabel('Chef agent run').className).not.toContain('opacity-30');
      expect(spanLabel('Recipe lookup').className).toContain('opacity-30');
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

      fireEvent.click(await screen.findByRole('button', { name: /close/i }));
      await waitFor(() => expect(spanLabel('Recipe lookup').className).not.toContain('opacity-30'));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  it('emphasises the first row in view while the others stay dimmed', async () => {
    type Callback = (entries: Array<Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>>) => void;
    // Other observers (infinite scroll, in-view hooks) are created too; keep the one watching the rows.
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
    installHandlers();
    const { queryClient } = renderView();

    await screen.findByText('Chef agent follow-up');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    const rowOf = (traceId: string) =>
      screen.getByTestId('thread-view-by-trace').querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`)!;

    expect(rowOf('trace-a').className).toContain('opacity-50');
    act(() => intersect(rowOf('trace-a')));

    expect(rowOf('trace-a').className).not.toContain('opacity-50');
    expect(rowOf('trace-b').className).toContain('opacity-50');
    vi.unstubAllGlobals();
  });

  describe('truncating a long trace to the height of its messages', () => {
    afterEach(() => vi.restoreAllMocks());

    const timelineOf = (traceId: string) =>
      screen
        .getByTestId('thread-view-by-trace')
        .querySelector<HTMLElement>(`[data-trace-id="${traceId}"] [data-testid="trace-row-timeline"]`);

    it('clamps the timeline to the messages height and reveals it with Show more / Show less', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderView();

      const [showMore] = await screen.findAllByRole('button', { name: 'Show more' });
      if (!showMore) throw new Error('expected a Show more button');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(timelineOf('trace-a')?.style.maxHeight).toBe('300px');

      fireEvent.click(showMore);
      expect(timelineOf('trace-a')?.style.maxHeight).toBe('');
      const showLess = screen.getByRole('button', { name: 'Show less' });

      fireEvent.click(showLess);
      expect(timelineOf('trace-a')?.style.maxHeight).toBe('300px');
    });

    it('does not offer Show more when the timeline already fits', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 200 });
      installHandlers();
      const { queryClient } = renderView();

      await screen.findByText('Chef agent run');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
      expect(timelineOf('trace-a')?.style.maxHeight).toBe('');
    });

    it('expands the row when one of its spans is selected and keeps it expanded afterwards', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      installHandlers();
      const { queryClient } = renderView();

      await screen.findAllByRole('button', { name: 'Show more' });
      fireEvent.click(await screen.findByText('Chef agent run'));
      await screen.findByRole('button', { name: /close/i });

      expect(timelineOf('trace-a')?.style.maxHeight).toBe('');
      // Collapsing would hide the selection, so the control is withheld while a span is open.
      expect(screen.queryByRole('button', { name: 'Show less' })).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.queryByRole('button', { name: /close/i })).toBeNull());
      expect(timelineOf('trace-a')?.style.maxHeight).toBe('');
      expect(screen.getByRole('button', { name: 'Show less' })).not.toBeNull();
    });
  });

  it('toggles an embed feedback panel from the icon button', async () => {
    installHandlers();
    installFeedbackHandlers();
    renderView();

    // Wait for traces to render.
    await screen.findByText('Chef agent run');

    // No feedback panel before clicking.
    expect(screen.queryByPlaceholderText('Leave feedback...')).toBeNull();

    // Click the feedback toggle icon button on the first trace row.
    const feedbackButtons = screen.getAllByRole('button', { name: 'Toggle feedback' });
    fireEvent.click(feedbackButtons[0]);

    // The embed feedback panel appears with the composer.
    expect(await screen.findByPlaceholderText('Leave feedback...')).not.toBeNull();
  });

  it('submits feedback from the embed panel', async () => {
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
    const feedbackButtons = screen.getAllByRole('button', { name: 'Toggle feedback' });
    fireEvent.click(feedbackButtons[0]);

    const input = await screen.findByPlaceholderText('Leave feedback...');
    fireEvent.change(input, { target: { value: 'great turn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => expect(onPost).toHaveBeenCalled());
    expect(onPost.mock.calls[0][0]).toMatchObject({
      feedback: { traceId: 'trace-a', value: 'great turn' },
    });
  });
});
