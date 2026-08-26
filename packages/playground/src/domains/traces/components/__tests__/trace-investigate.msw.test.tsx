// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('TraceInvestigate', () => {
  it('renders the turn as a readable thread and hides technical spans', async () => {
    const onRequest = vi.fn();
    server.use(
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
    expect(entries.map(entry => entry.textContent)).toEqual([
      expect.stringContaining('0.1s'),
      expect.stringContaining('0.2s'),
      expect.stringContaining('0.3s'),
    ]);
    expect(entries[0].textContent).toContain('PROCESSOR');
    expect(entries[0].textContent).toContain('moderation');
    expect(entries[1].textContent).toContain('MODEL');
    expect(entries[1].textContent).toContain('gpt-4o');
    expect(entries[2].textContent).toContain('TOOL');
    expect(entries[2].textContent).toContain('pantry');

    // The turn closes on the answer, placed on the same rail.
    const answer = screen.getByTestId('trace-investigate-answer');
    expect(answer.textContent).toContain('ANSWER');
    expect(answer.textContent).toContain('7.7s');
    expect(answer.textContent).toContain('A ratatouille');

    // out of the allowlist
    expect(screen.queryByText('chunk')).toBeNull();
    expect(screen.queryByText('step')).toBeNull();
    // ...and dropped silently: their count means nothing to the reader.
    expect(screen.queryByTestId('trace-investigate-hidden-count')).toBeNull();

    expect(screen.getByTestId('trace-investigate-full-link').getAttribute('href')).toBe('/traces?traceId=trace-a');
    expect(onRequest).toHaveBeenCalled();
  });
});
