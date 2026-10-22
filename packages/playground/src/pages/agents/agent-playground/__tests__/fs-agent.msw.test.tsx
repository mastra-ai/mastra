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
import { AGENT_ID, makeFsAgent, noVersions } from './fixtures/fs-agent';
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
            <Routes>
              <Route path="/agents/:agentId/editor" element={<AgentPlayground />} />
            </Routes>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

/** A file-based agent with no stored override yet, plus the endpoints the editor chrome needs. */
const registerHandlers = ({
  editor,
  editorSource,
}: {
  editor: AgentEditorConfig | undefined;
  editorSource: 'code' | 'db';
}) => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(makeFsAgent(editor))),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(noVersions)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: false })),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [], editorSource })),
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
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  );
};

const renderFsAgent = async (options: Parameters<typeof registerHandlers>[0]) => {
  registerHandlers(options);
  await act(async () => {
    renderAgentPlayground();
  });
  await screen.findByRole('tab', { name: 'System Prompt' });
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// Regression coverage for https://github.com/mastra-ai/mastra/issues/26274 — Studio treated
// file-based (`source: 'fs'`) agents as stored agents, so saving them PATCHed a stored record
// that did not exist yet (404) and ignored the agent's `editor` ownership config.
describe('AgentPlayground — file-based agent', () => {
  describe('when the agent folder locks every editable field', () => {
    it('marks the editor read-only like a code-defined agent', async () => {
      await renderFsAgent({ editor: { instructions: false, tools: false }, editorSource: 'db' });

      await waitFor(() => expect(screen.getByText('Read-only')).not.toBeNull());
    });
  });

  describe('when the editor writes overrides to the filesystem', () => {
    it('offers the code-agent save action', async () => {
      await renderFsAgent({ editor: undefined, editorSource: 'code' });

      expect(await screen.findByRole('button', { name: /Save to filesystem/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /Save New Version/ })).toBeNull();
    });
  });
});
