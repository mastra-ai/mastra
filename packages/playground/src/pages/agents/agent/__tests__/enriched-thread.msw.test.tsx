// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentPage from '../index';
import { StudioConfigContext } from '@/domains/configuration';
import { memoryEnabled, v2Agent } from '@/lib/ai-ui/__tests__/fixtures/agent';
import { server } from '@/test/msw-server';

// The turn itself is covered by the traces domain; here we only care which view the page picks.
vi.mock('@/domains/traces/components/trace-investigate', () => ({
  TraceInvestigate: ({ traceId }: { traceId: string }) => <div data-testid="trace-investigate">{traceId}</div>,
}));

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const THREAD_ID = 'thread-1';

const traceListRequests: URL[] = [];

const traceRow = {
  traceId: 'trace-a',
  spanId: 'span-a',
  name: 'agent run',
  spanType: 'agent_run',
  isEvent: false,
  startedAt: new Date('2026-07-31T12:00:00.000Z'),
  endedAt: new Date('2026-07-31T12:00:01.000Z'),
  createdAt: new Date('2026-07-31T12:00:00.000Z'),
  updatedAt: null,
  status: 'success',
};

const useHandlers = ({ traces }: { traces: unknown[] }) => {
  const listTraces = ({ request }: { request: Request }) => {
    traceListRequests.push(new URL(request.url));
    return HttpResponse.json({
      spans: traces,
      pagination: { total: traces.length, page: 0, perPage: 25, hasMore: false },
    });
  };

  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${BASE_URL}/api/memory/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => HttpResponse.json({ id: THREAD_ID, title: 'Thread' })),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
      HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: true }),
    ),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/working-memory`, () =>
      HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: true }),
    ),
    http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json({ record: null })),
    http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
    http.get(`${BASE_URL}/api/observability/traces`, listTraces),
    http.get(`${BASE_URL}/api/observability/traces/light`, listTraces),
  );
};

/** Stands in for the Traces tab so the test can read where the link landed. */
function TracesPageStub() {
  const { agentId } = useParams();
  const [searchParams] = useSearchParams();
  return <div data-testid="traces-page">{`${agentId}?${searchParams.toString()}`}</div>;
}

const renderPage = (path: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <StudioConfigContext.Provider
      value={{ baseUrl: BASE_URL, headers: {}, apiPrefix: undefined, isLoading: false, setConfig: () => {} }}
    >
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/agents/:agentId/chat/:threadId" element={<AgentPage />} />
              <Route path="/agents/:agentId/traces" element={<TracesPageStub />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>
    </StudioConfigContext.Provider>,
  );
};

afterEach(() => {
  cleanup();
  traceListRequests.length = 0;
});

describe('enriched thread mode', () => {
  it('offers the switch, but keeps the plain chat, when the URL says nothing', async () => {
    useHandlers({ traces: [traceRow] });

    renderPage(`/agents/${AGENT_ID}/chat/${THREAD_ID}`);

    expect(await screen.findByRole('switch', { name: /enriched/i })).not.toBeNull();
    expect(screen.queryByTestId('enriched-thread')).toBeNull();
    expect(await screen.findByText('How can I help you today?')).not.toBeNull();
  });

  it('reads the thread from its traces when enriched=true', async () => {
    useHandlers({ traces: [traceRow] });

    renderPage(`/agents/${AGENT_ID}/chat/${THREAD_ID}?enriched=true`);

    expect(await screen.findByTestId('enriched-thread')).not.toBeNull();
    expect(screen.getByTestId('trace-investigate').textContent).toBe('trace-a');
    expect(traceListRequests[0]!.searchParams.get('threadId')).toBe(THREAD_ID);
  });

  it('opens the traces tab filtered on the thread', async () => {
    useHandlers({ traces: [traceRow] });

    renderPage(`/agents/${AGENT_ID}/chat/${THREAD_ID}`);

    fireEvent.click(await screen.findByRole('link', { name: /show thread traces/i }));

    expect((await screen.findByTestId('traces-page')).textContent).toBe(`${AGENT_ID}?filterThreadId=${THREAD_ID}`);
  });

  it('hides the switch and stays on the chat for a thread without traces', async () => {
    useHandlers({ traces: [] });

    renderPage(`/agents/${AGENT_ID}/chat/${THREAD_ID}?enriched=true`);

    expect(await screen.findByText('How can I help you today?')).not.toBeNull();
    await waitFor(() => expect(traceListRequests.length).toBeGreaterThan(0));
    expect(screen.queryByRole('switch', { name: /enriched/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /show thread traces/i })).toBeNull();
    expect(screen.queryByTestId('enriched-thread')).toBeNull();
  });

  it('never queries traces for a brand-new chat', async () => {
    useHandlers({ traces: [traceRow] });

    renderPage(`/agents/${AGENT_ID}/chat/new`);

    expect(await screen.findByText('How can I help you today?')).not.toBeNull();
    expect(traceListRequests).toHaveLength(0);
    expect(screen.queryByRole('switch', { name: /enriched/i })).toBeNull();
  });
});
