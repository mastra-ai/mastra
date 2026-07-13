import type { AgentControllerEvent, AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
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
import { useChatTranscript } from '../../context/useChatTranscript';
import './overlay-test-utils';

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

function sse(events: AgentControllerEvent[] = []): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
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

function useAgentControllerHandlers(events: AgentControllerEvent[] = []) {
  const onSend = vi.fn();
  const onPermissions = vi.fn();
  const onGoal = vi.fn();
  let permissions: PermissionRules = { categories: { execute: 'ask' }, tools: { 'shell.run': 'deny' } };
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse(events)),
    http.post(`${SESSION}/messages`, async ({ request }) => {
      onSend(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/goal`, () => {
      onGoal();
      return HttpResponse.json({});
    }),
    http.get(`${SESSION}/permissions`, () => {
      onPermissions();
      return HttpResponse.json(permissions);
    }),
    http.put(`${SESSION}/permissions/category`, async ({ request }) => {
      const body = await request.json();
      if (body && typeof body === 'object' && 'category' in body && 'policy' in body) {
        permissions = {
          ...permissions,
          categories: {
            ...permissions.categories,
            [String(body.category)]: body.policy,
          },
        };
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  return { onSend, onPermissions, onGoal };
}

function NoticeProbe() {
  const { transcript } = useChatTranscript();
  return (
    <output aria-label="Notices">
      {transcript.entries.map(entry => (entry.kind === 'notice' ? <div key={entry.id}>{entry.text}</div> : null))}
    </output>
  );
}

function renderComposer() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveProjectProvider>
              <ChatSessionProvider threadId={THREAD_ID}>
                <Composer />
                <NoticeProbe />
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
    it('shows permissions from the client cache instead of sending a message', async () => {
      seedProject();
      const { onSend, onPermissions } = useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await waitFor(() => expect(onPermissions).toHaveBeenCalled());
      const permissionsRequestsBeforeCommand = onPermissions.mock.calls.length;
      await userEvent.type(screen.getByRole('textbox'), '/permissions{Enter}');

      await waitFor(() => expect(onPermissions).toHaveBeenCalledTimes(permissionsRequestsBeforeCommand));
      expect(screen.getByLabelText('Notices')).toHaveTextContent('execute: ask');
      expect(screen.getByLabelText('Notices')).toHaveTextContent('shell.run: deny');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('shows permissions refreshed by permission mutations', async () => {
      seedProject();
      const { onSend, onPermissions } = useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await waitFor(() => expect(onPermissions).toHaveBeenCalled());
      const permissionsRequestsBeforeYolo = onPermissions.mock.calls.length;

      await userEvent.type(screen.getByRole('textbox'), '/yolo{Enter}');

      await waitFor(() => expect(screen.getByLabelText('Notices')).toHaveTextContent('YOLO mode'));
      await waitFor(() => expect(onPermissions.mock.calls.length).toBeGreaterThan(permissionsRequestsBeforeYolo));
      const permissionsRequestsBeforeCommand = onPermissions.mock.calls.length;
      await userEvent.type(screen.getByRole('textbox'), '/permissions{Enter}');

      await waitFor(() => expect(onPermissions).toHaveBeenCalledTimes(permissionsRequestsBeforeCommand));
      expect(screen.getByLabelText('Notices')).toHaveTextContent('execute: allow');
      expect(screen.getByLabelText('Notices')).toHaveTextContent('edit: allow');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('reports cumulative usage, observational-memory phase, and canonical session settings without sending messages', async () => {
      seedProject();
      const { onSend } = useAgentControllerHandlers([
        { type: 'usage_update', usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 } },
        { type: 'om_observation_start' },
      ]);
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, '/cost{Enter}');
      await waitFor(() => expect(screen.getByLabelText('Notices')).toHaveTextContent('total: 60'));

      await userEvent.type(input, '/om{Enter}');
      await waitFor(() =>
        expect(screen.getByLabelText('Notices')).toHaveTextContent('Observational memory phase: observing'),
      );

      await userEvent.type(input, '/settings{Enter}');
      await waitFor(() => expect(screen.getByLabelText('Notices')).toHaveTextContent(`Thread: ${THREAD_ID}`));
      expect(screen.getByLabelText('Notices')).toHaveTextContent('Mode: build');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('submits an argument command without sending it as a chat message', async () => {
      seedProject();
      const { onGoal, onSend } = useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, '/goal Finish the command refactor{Enter}');

      await waitFor(() => expect(onGoal).toHaveBeenCalledTimes(1));
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('when entering a partial slash command', () => {
    it('completes the highlighted suggestion on Enter', async () => {
      seedProject();
      const { onSend, onPermissions } = useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await waitFor(() => expect(onPermissions).toHaveBeenCalled());
      const permissionsRequestsBeforeCompletion = onPermissions.mock.calls.length;
      await userEvent.type(screen.getByRole('textbox'), '/he{Enter}');

      expect(screen.getByRole('textbox')).toHaveValue('/help ');
      expect(onPermissions).toHaveBeenCalledTimes(permissionsRequestsBeforeCompletion);
      expect(onSend).not.toHaveBeenCalled();
    });
  });
});
