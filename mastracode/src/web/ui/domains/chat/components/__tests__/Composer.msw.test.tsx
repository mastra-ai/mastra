import type { AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { ChatSessionProvider } from '../../context/ChatSessionProvider';
import { Composer } from '../Composer';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function sse(): Response {
  return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function seedProject() {
  const project: Project = {
    id: 'project-test',
    name: 'MastraCode Test',
    path: '/tmp/mastracode-test',
    resourceId: RESOURCE_ID,
    gitBranch: 'main',
    createdAt: 1,
  };
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
}

function useAgentControllerHandlers() {
  const onSend = vi.fn();
  const onPermissions = vi.fn();
  server.use(
    http.post(`${API}/sessions`, () => HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID })),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse()),
    http.post(`${SESSION}/messages`, async ({ request }) => {
      onSend(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/permissions`, () => {
      onPermissions();
      return HttpResponse.json({ categories: {}, tools: {} });
    }),
  );
  return { onSend, onPermissions };
}

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveProjectProvider>
              <ChatSessionProvider>
                <Composer commandNameToApply={null} onCommandApplied={() => undefined} {...props} />
              </ChatSessionProvider>
            </ActiveProjectProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe('Composer', () => {
  describe('when entering exact no-arg slash commands', () => {
    it('runs the command instead of sending a message', async () => {
      seedProject();
      const { onSend, onPermissions } = useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await userEvent.type(screen.getByRole('textbox'), '/permissions{Enter}');

      await waitFor(() => expect(onPermissions).toHaveBeenCalled());
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('when entering a partial slash command', () => {
    it('completes the highlighted suggestion on Enter', async () => {
      seedProject();
      const { onSend, onPermissions } = useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, '/he{Enter}');

      expect(input).toHaveValue('/help ');
      expect(onPermissions).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('when a palette command is applied', () => {
    it('prefills the composer and acknowledges the handoff', async () => {
      seedProject();
      useAgentControllerHandlers();
      const onCommandApplied = vi.fn();
      renderComposer({ commandNameToApply: 'model', onCommandApplied });

      await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('/model '));
      expect(onCommandApplied).toHaveBeenCalled();
    });
  });
});
