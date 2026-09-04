// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import AgentPage from '../thread';
import { StudioConfigContext } from '@/domains/configuration';
import { memoryEnabled, v2Agent } from '@/lib/ai-ui/__tests__/fixtures/agent';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const THREAD_ID = 'thread-1';
const SUGGESTED_PROMPT = 'Check the weather';

const createGate = () => {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });

  return { promise, release };
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <StudioConfigContext.Provider
      value={{ baseUrl: BASE_URL, headers: {}, apiPrefix: undefined, isLoading: false, setConfig: () => {} }}
    >
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/agents/${AGENT_ID}/threads/${THREAD_ID}`]}>
            <Routes>
              <Route path="/agents/:agentId/threads/:threadId" element={<AgentPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>
    </StudioConfigContext.Provider>,
  );
};

afterEach(() => cleanup());

describe('agent suggested prompts', () => {
  describe('when an existing thread is still loading its messages', () => {
    it('withholds the prompts until the message query resolves', async () => {
      const messagesGate = createGate();

      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
          HttpResponse.json({
            ...v2Agent,
            metadata: { suggestedPrompts: [SUGGESTED_PROMPT] },
          }),
        ),
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
        http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
        http.get(`${BASE_URL}/api/memory/threads`, () => HttpResponse.json({ threads: [] })),
        http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/working-memory`, () =>
          HttpResponse.json({
            workingMemory: null,
            source: 'thread',
            workingMemoryTemplate: null,
            threadExists: true,
          }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, async () => {
          await messagesGate.promise;
          return HttpResponse.json({ messages: [] });
        }),
        http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json({ record: null })),
        http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
        http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
          HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
        ),
        http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
      );

      renderPage();

      expect(await screen.findByText('How can I help you today?')).not.toBeNull();
      expect(screen.queryByRole('button', { name: SUGGESTED_PROMPT })).toBeNull();

      messagesGate.release();

      expect(await screen.findByRole('button', { name: SUGGESTED_PROMPT })).not.toBeNull();
    });
  });
});
