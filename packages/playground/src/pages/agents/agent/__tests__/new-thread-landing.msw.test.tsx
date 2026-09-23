// @vitest-environment jsdom
import type { StorageThreadType } from '@mastra/core/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import AgentPage from '../thread';
import { StudioConfigContext } from '@/domains/configuration';
import { memoryEnabled, v2Agent } from '@/lib/ai-ui/__tests__/fixtures/agent';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const SUGGESTED_PROMPT = 'Check the weather';

const existingThread: StorageThreadType = {
  id: 'thread-1',
  resourceId: AGENT_ID,
  title: 'Earlier chat',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const createGate = () => {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });

  return { promise, release };
};

const useHandlers = (threads: StorageThreadType[], agentGate?: Promise<void>) => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, async () => {
      await agentGate;
      return HttpResponse.json({ ...v2Agent, metadata: { suggestedPrompts: [SUGGESTED_PROMPT] } });
    }),
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${BASE_URL}/api/memory/threads`, () => HttpResponse.json({ threads })),
    http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => new HttpResponse(null, { status: 404 })),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
      HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: false }),
    ),
    http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json({ record: null })),
    http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
  );
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
          <MemoryRouter initialEntries={[`/agents/${AGENT_ID}/threads/new`]}>
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

describe('new thread landing', () => {
  describe('when visiting /new while the agent is still loading', () => {
    it('shows the landing skeleton instead of the chat skeleton, then resolves to the greeting', async () => {
      const agentGate = createGate();
      useHandlers([], agentGate.promise);
      renderPage();

      expect(await screen.findByTestId('agent-landing-skeleton')).not.toBeNull();
      expect(screen.queryByTestId('agent-thread-skeleton')).toBeNull();

      agentGate.release();

      expect(await screen.findByTestId('thread-welcome')).not.toBeNull();
      expect(screen.queryByTestId('agent-landing-skeleton')).toBeNull();
    });
  });

  describe('when visiting /new and the agent has no threads', () => {
    it('hides the threads panel', async () => {
      useHandlers([]);
      renderPage();

      expect(await screen.findByRole('button', { name: SUGGESTED_PROMPT })).not.toBeNull();
      expect(screen.queryByTestId('left-slot')).toBeNull();
    });

    it('renders the greeting with the agent name', async () => {
      useHandlers([]);
      renderPage();

      const heading = await screen.findByRole('heading', { name: /what can .* do for you today\?/i });
      expect(heading.textContent).toContain(v2Agent.name);
    });
  });

  describe('when visiting /new and the agent already has threads', () => {
    it('shows the threads panel', async () => {
      useHandlers([existingThread]);
      renderPage();

      expect(await screen.findByRole('button', { name: SUGGESTED_PROMPT })).not.toBeNull();
      await waitFor(() => expect(screen.getByTestId('memory-sidebar-thread-layer')).not.toBeNull());
      expect(screen.getByTestId('left-slot')).not.toBeNull();
    });
  });
});
