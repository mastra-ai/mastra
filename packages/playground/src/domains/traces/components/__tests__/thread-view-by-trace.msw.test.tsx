import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it, vi } from 'vitest';

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
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

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

const renderView = () =>
  renderWithProviders(
    <TestLinkProvider>
      <BrowserToolCallsProvider>
        <ActivatedSkillsProvider>
          <ThreadViewByTrace threadId={THREAD_ID} />
        </ActivatedSkillsProvider>
      </BrowserToolCallsProvider>
    </TestLinkProvider>,
    { router: true },
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

    expect(await screen.findByText(/cook pasta/)).not.toBeNull();
    expect(screen.getByText(/carbonara/)).not.toBeNull();
    // The conversation column stays mounted while the span panel is open.
    expect(screen.getByTestId('thread-view-by-trace')).not.toBeNull();
    expect(screen.getByText('Chef agent follow-up')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByText(/cook pasta/)).toBeNull());
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
