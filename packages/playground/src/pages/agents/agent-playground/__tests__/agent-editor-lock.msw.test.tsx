// @vitest-environment jsdom
import type { AgentEditorConfig } from '@mastra/core/agent';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import AgentPlayground from '..';
import { AGENT_ID, makeCodeAgent, versionsList } from './fixtures/agent-editor-lock';
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
const registerHandlers = (editor: AgentEditorConfig | undefined) => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
      HttpResponse.json({ ...makeCodeAgent(editor), modelList: [] }),
    ),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(versionsList)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => HttpResponse.json(null)),
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

const renderWithEditorConfig = async (editor: AgentEditorConfig | undefined) => {
  registerHandlers(editor);
  await act(async () => {
    renderAgentPlayground();
  });
  // Wait for the agent config to resolve before asserting on the editor chrome.
  await screen.findByRole('tab', { name: 'System Prompt' });
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('AgentPlayground — code agent editor lock', () => {
  describe('when the editor config locks every editable field', () => {
    it('marks the editor read-only for `editor: { instructions: false, tools: false }`', async () => {
      await renderWithEditorConfig({ instructions: false, tools: false });

      await waitFor(() => expect(screen.getByText('Read-only')).not.toBeNull());
    });

    it('marks the editor read-only for `editor: false`', async () => {
      await renderWithEditorConfig(false);

      await waitFor(() => expect(screen.getByText('Read-only')).not.toBeNull());
    });
  });

  describe('when the editor config leaves a field editable', () => {
    it('does not mark the editor read-only for `editor: { instructions: true, tools: false }`', async () => {
      await renderWithEditorConfig({ instructions: true, tools: false });

      expect(screen.queryByText('Read-only')).toBeNull();
    });

    it('does not mark the editor read-only when no editor config is set', async () => {
      await renderWithEditorConfig(undefined);

      expect(screen.queryByText('Read-only')).toBeNull();
    });
  });
});
