import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TracesInvestigatePage from '../investigate';
import { traceList, traceListWithTwoTraces } from './fixtures/traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const onTracesRequest = vi.fn<(url: URL) => void>();

const setHandlers = () => {
  const handler = ({ request }: { request: Request }) => {
    onTracesRequest(new URL(request.url));
    return HttpResponse.json(traceList);
  };
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces`, handler),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, handler),
    http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () =>
      HttpResponse.json({
        traceId: 'trace-a',
        spans: [
          {
            traceId: 'trace-a',
            spanId: 'root',
            spanType: 'agent_run',
            name: "agent run: 'chef-agent'",
            entityId: 'chef-agent',
            input: [{ role: 'user', content: 'Hello' }],
          },
          {
            traceId: 'trace-a',
            spanId: 'gen',
            parentSpanId: 'root',
            spanType: 'model_generation',
            name: "llm: 'gpt-4o'",
            attributes: { model: 'gpt-4o' },
          },
        ],
      }),
    ),
  );
};

const renderPage = (initialEntry: string) =>
  renderWithProviders(
    <TestLinkProvider>
      <TracesInvestigatePage />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

beforeEach(() => {
  onTracesRequest.mockClear();
  setHandlers();
});

describe('Traces investigation page', () => {
  describe('when a threadId query param is present', () => {
    it('renders the investigation view and fetches traces filtered by that thread', async () => {
      renderPage('/traces/investigate?threadId=thread-1');

      const view = await screen.findByTestId('traces-investigation');
      expect(view.textContent).toContain('Thread ID');
      expect(view.textContent).toContain('thread-1');

      await waitFor(() => expect(onTracesRequest).toHaveBeenCalled());
      expect(onTracesRequest.mock.calls[0]![0].searchParams.get('threadId')).toBe('thread-1');
    });

    it('renders traces oldest-first, reversing the list endpoint order', async () => {
      const handler = ({ request }: { request: Request }) => {
        onTracesRequest(new URL(request.url));
        return HttpResponse.json(traceListWithTwoTraces);
      };
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces`, handler),
        http.get(`${TEST_BASE_URL}/api/observability/traces/light`, handler),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-b`, () =>
          HttpResponse.json({ traceId: 'trace-b', spans: [] }),
        ),
      );

      renderPage('/traces/investigate?threadId=thread-1');

      const items = await screen.findAllByTestId('trace-investigate');
      expect(items.map(item => item.getAttribute('data-trace-id'))).toEqual(['trace-b', 'trace-a']);
    });

    it('renders one full-trace investigation per listed trace', async () => {
      renderPage('/traces/investigate?threadId=thread-1');

      const items = await screen.findAllByTestId('trace-investigate');
      expect(items).toHaveLength(1);
      const entries = await screen.findAllByTestId('timeline-entry');
      const modelEntry = entries.find(entry => entry.textContent?.includes('MODEL'));
      expect(modelEntry?.textContent).toContain('gpt-4o');
      expect(screen.getByTestId('trace-investigate-user-turn').textContent).toContain('Hello');
    });
  });

  describe('when the threadId query param is missing', () => {
    it('renders a not-found state without requesting traces', async () => {
      renderPage('/traces/investigate');

      expect(await screen.findByText(/404/)).toBeTruthy();
      expect(screen.queryByTestId('traces-investigation')).toBeNull();
      expect(onTracesRequest).not.toHaveBeenCalled();
    });
  });
});
