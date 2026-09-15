// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import AgentPlayground from '..';
import {
  AGENT_ID,
  codeAgent,
  storedAgentDraft,
  versionsList,
  LATEST_DRAFT_VERSION_ID,
  PUBLISHED_VERSION_ID,
} from './fixtures/agent-version-id-regression';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderAgentPlayground = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/agents/${AGENT_ID}/editor`]}>
          <TooltipProvider>
            <TracingSettingsProvider entityId={AGENT_ID} entityType="agent">
              <SchemaRequestContextProvider>
                <Routes>
                  <Route path="/agents/:agentId/editor" element={<AgentPlayground />} />
                </Routes>
              </SchemaRequestContextProvider>
            </TracingSettingsProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

/** Endpoints AgentPlayground and its children hit that aren't the point of this test. */
const registerBaselineHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json({ ...codeAgent, modelList: [] })),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(versionsList)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => HttpResponse.json(storedAgentDraft)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: false })),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [], editorSource: 'code' })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}/browser/session`, () =>
      HttpResponse.json({ hasSession: false, screencastAvailable: false }),
    ),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
    http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json({ tools: {} })),
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets: [], total: 0, page: 1, perPage: 50 })),
    http.get(`${BASE_URL}/api/mcp/servers`, () => HttpResponse.json({ servers: {} })),
  );
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('AgentPlayground — test chat agent version id', () => {
  describe('when viewing the latest version', () => {
    it('sends the latest draft version id to test chat instead of the published one', async () => {
      registerBaselineHandlers();

      const sentRequestContexts: Array<Record<string, unknown> | undefined> = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          const body = (await request.json()) as {
            ifIdle?: { streamOptions?: { requestContext?: Record<string, unknown> } };
          };
          sentRequestContexts.push(body.ifIdle?.streamOptions?.requestContext);
          return HttpResponse.json({ accepted: true, runId: 'run-1' });
        }),
      );

      await act(async () => {
        renderAgentPlayground();
      });

      const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'what version are you?' } });
      });

      const sendButton = await screen.findByRole('button', { name: /send/i });
      await act(async () => {
        fireEvent.click(sendButton);
      });

      await waitFor(() => expect(sentRequestContexts.length).toBeGreaterThan(0));

      // Regression: while viewing the latest version (no explicit selection of a
      // previous version), test chat must resolve against the latest draft, not
      // the published version and not omit the version id entirely. Before the
      // fix, `agentVersionId` was `undefined` here, and the server would fall
      // back to serving the published version instead of this draft.
      expect(sentRequestContexts[0]?.agentVersionId).toBe(LATEST_DRAFT_VERSION_ID);
      expect(sentRequestContexts[0]?.agentVersionId).not.toBe(PUBLISHED_VERSION_ID);
      expect(sentRequestContexts[0]?.agentVersionId).not.toBeUndefined();
    });
  });
});
