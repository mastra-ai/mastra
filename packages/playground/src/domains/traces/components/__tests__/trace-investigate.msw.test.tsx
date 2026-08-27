// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceInvestigate } from '../trace-investigate';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>{children}</TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const feedbackHandler = (feedback: unknown[] = []) =>
  http.get(FEEDBACK_URL, () =>
    HttpResponse.json({ feedback, pagination: { page: 0, perPage: 10, total: feedback.length, hasMore: false } }),
  );

describe('TraceInvestigate', () => {
  it('renders the turn as a readable thread with every span', async () => {
    const onRequest = vi.fn();
    server.use(
      feedbackHandler(),
      http.get(`${BASE_URL}/api/observability/traces/trace-a`, () => {
        onRequest();
        return HttpResponse.json({
          traceId: 'trace-a',
          spans: [
            {
              traceId: 'trace-a',
              spanId: 'root',
              spanType: 'agent_run',
              name: "agent run: 'chef-agent'",
              entityId: 'chef-agent',
              input: [{ role: 'user', content: 'What can I cook?' }],
              output: { text: 'A ratatouille' },
              startedAt: '2026-01-01T10:00:00.000Z',
              endedAt: '2026-01-01T10:00:07.700Z',
            },
            {
              traceId: 'trace-a',
              spanId: 'proc',
              parentSpanId: 'root',
              spanType: 'processor_run',
              name: 'input processor: moderation',
              entityId: 'moderation',
              startedAt: '2026-01-01T10:00:00.100Z',
            },
            {
              traceId: 'trace-a',
              spanId: 'gen',
              parentSpanId: 'root',
              spanType: 'model_generation',
              name: "llm: 'gpt-4o'",
              attributes: { model: 'gpt-4o' },
              output: { text: 'A ratatouille' },
              startedAt: '2026-01-01T10:00:00.200Z',
            },
            {
              traceId: 'trace-a',
              spanId: 'tool',
              parentSpanId: 'gen',
              spanType: 'tool_call',
              name: "tool: 'pantry'",
              entityId: 'pantry',
              startedAt: '2026-01-01T10:00:00.300Z',
            },
            {
              traceId: 'trace-a',
              spanId: 'chunk',
              parentSpanId: 'gen',
              spanType: 'model_chunk',
              name: 'chunk',
              startedAt: '2026-01-01T10:00:00.250Z',
            },
            {
              traceId: 'trace-a',
              spanId: 'step',
              parentSpanId: 'gen',
              spanType: 'model_step',
              name: 'step',
              startedAt: '2026-01-01T10:00:00.260Z',
            },
          ],
        });
      }),
    );

    render(<TraceInvestigate traceId="trace-a" />, { wrapper });

    // The rail is continuous: the user message is the first row, at 0.0s.
    const userRow = await screen.findByTestId('trace-investigate-user-turn');
    expect(userRow.textContent).toContain('0.0s');
    expect(userRow.textContent).toContain('USER');
    expect(userRow.textContent).toContain('What can I cook?');

    // Each step reads as: elapsed time, kind, subject.
    const entries = screen.getAllByTestId('timeline-entry');
    // Only the conversation shows: the streaming mechanics (`model_chunk`, `model_step`) and the
    // root `agent_run` — which the USER and ANSWER rows already stand for — stay out.
    expect(entries.map(entry => entry.textContent)).toEqual([
      expect.stringContaining('moderation'),
      expect.stringContaining('gpt-4o'),
      expect.stringContaining('pantry'),
    ]);
    expect(entries.some(entry => entry.textContent?.includes('chef-agent'))).toBe(false);
    expect(entries[0].textContent).toContain('PROCESSOR');
    expect(entries[1].textContent).toContain('MODEL');
    expect(entries[2].textContent).toContain('TOOL');

    // The turn closes on the answer, placed on the same rail, and standing in for the root
    // `agent_run` so it can carry that span's comments.
    const answer = screen.getByTestId('trace-investigate-answer');
    expect(answer.textContent).toContain('ANSWER');
    expect(answer.textContent).toContain('7.7s');
    expect(answer.textContent).toContain('A ratatouille');
    expect(within(answer).getByRole('button', { name: /comment on this step/i })).toBeTruthy();

    expect(screen.getByTestId('trace-investigate-full-link').getAttribute('href')).toBe('/traces?traceId=trace-a');
    expect(onRequest).toHaveBeenCalled();
  });

  describe('when the trace has both trace-level and span-scoped feedback', () => {
    const spans = [
      {
        traceId: 'trace-a',
        spanId: 'root',
        spanType: 'agent_run',
        name: "agent run: 'chef-agent'",
        entityId: 'chef-agent',
        input: [{ role: 'user', content: 'What can I cook?' }],
        startedAt: '2026-01-01T10:00:00.000Z',
      },
      {
        traceId: 'trace-a',
        spanId: 'tool',
        parentSpanId: 'root',
        spanType: 'tool_call',
        name: "tool: 'pantry'",
        entityId: 'pantry',
        startedAt: '2026-01-01T10:00:00.300Z',
      },
    ];

    const withFeedback = () =>
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/trace-a`, () =>
          HttpResponse.json({ traceId: 'trace-a', spans }),
        ),
        feedbackHandler([
          {
            traceId: 'trace-a',
            feedbackId: 'trace-level',
            feedbackType: 'comment',
            feedbackSource: 'user',
            value: 'the whole run drifted',
            timestamp: '2026-01-01T11:00:00.000Z',
          },
          {
            traceId: 'trace-a',
            spanId: 'tool',
            feedbackId: 'span-scoped',
            feedbackType: 'comment',
            feedbackSource: 'user',
            value: 'wrong pantry lookup',
            timestamp: '2026-01-01T11:00:01.000Z',
          },
        ]),
      );

    it('renders only the trace-level comment under the timeline', async () => {
      withFeedback();
      render(<TraceInvestigate traceId="trace-a" />, { wrapper });

      const comments = await screen.findByRole('region', { name: 'Trace comments' });
      expect(comments.textContent).toContain('the whole run drifted');
      expect(comments.textContent).not.toContain('wrong pantry lookup');
    });

    it('advertises the span comment count on the row bubble', async () => {
      withFeedback();
      render(<TraceInvestigate traceId="trace-a" />, { wrapper });

      expect(await screen.findByRole('button', { name: 'Comments on this step (1)' })).toBeTruthy();
    });
  });
});
