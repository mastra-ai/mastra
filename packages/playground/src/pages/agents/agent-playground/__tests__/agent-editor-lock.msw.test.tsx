// @vitest-environment jsdom
import type { AgentEditorConfig } from '@mastra/core/agent';
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
  DRAFT_VERSION_ID,
  makeCodeAgent,
  modelOwnedStoredAgent,
  versionsList,
  versionsWithModelListDraft,
} from './fixtures/agent-editor-lock';
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

/** Endpoints AgentPlayground and its children hit that aren't the point of this test. */
const registerHandlers = (
  editor: AgentEditorConfig | undefined,
  options?: { hasModelListDraft?: boolean; onActivateDraft?: () => void },
) => {
  const hasModelListDraft = options?.hasModelListDraft ?? false;

  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
      HttpResponse.json({ ...makeCodeAgent(editor), modelList: [] }),
    ),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () =>
      HttpResponse.json(hasModelListDraft ? versionsWithModelListDraft : versionsList),
    ),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
      HttpResponse.json(hasModelListDraft ? modelOwnedStoredAgent : null),
    ),
    http.post(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${DRAFT_VERSION_ID}/activate`, () => {
      options?.onActivateDraft?.();
      return HttpResponse.json({ success: true, activeVersionId: DRAFT_VERSION_ID });
    }),
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

const renderWithEditorConfig = async (
  editor: AgentEditorConfig | undefined,
  options?: { hasModelListDraft?: boolean; onActivateDraft?: () => void },
) => {
  registerHandlers(editor, options);
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

  describe('when a code-source agent has an unpublished model-list version', () => {
    it('saves the version to the filesystem', async () => {
      let activationCount = 0;
      await renderWithEditorConfig(
        { model: true },
        {
          hasModelListDraft: true,
          onActivateDraft: () => {
            activationCount += 1;
          },
        },
      );

      const saveButton = await screen.findByRole<HTMLButtonElement>('button', { name: 'Save to filesystem' });
      expect(saveButton.disabled).toBe(false);

      fireEvent.click(saveButton);

      await waitFor(() => expect(activationCount).toBe(1));
    });
  });
});
