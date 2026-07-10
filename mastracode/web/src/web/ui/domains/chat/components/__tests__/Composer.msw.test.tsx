import type { AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { ChatCommandsProvider, useChatCommands } from '../../context/ChatCommandsProvider';
import { ChatSessionProvider, useChatSession } from '../../context/ChatSessionProvider';
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
  const onSteer = vi.fn();
  const onAbort = vi.fn();
  const onModel = vi.fn();
  const onGoal = vi.fn();
  const onFollowUp = vi.fn();
  const onPermissions = vi.fn();
  let permissions: PermissionRules = { categories: { execute: 'ask' }, tools: { 'shell.run': 'deny' } };
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse()),
    http.post(`${SESSION}/messages`, async ({ request }) => {
      onSend(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/steer`, async ({ request }) => {
      onSteer(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/abort`, () => {
      onAbort();
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/model`, async ({ request }) => {
      onModel(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/goal`, async ({ request }) => {
      onGoal(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/follow-up`, async ({ request }) => {
      onFollowUp(await request.json());
      return HttpResponse.json({ ok: true });
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
          categories: { ...permissions.categories, [String(body.category)]: body.policy },
        };
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  return { onAbort, onFollowUp, onGoal, onModel, onPermissions, onSend, onSteer };
}

function NoticeProbe() {
  const { transcript } = useChatSession();
  return (
    <output aria-label="Notices">
      {transcript.entries.map(entry => (entry.kind === 'notice' ? <div key={entry.id}>{entry.text}</div> : null))}
    </output>
  );
}

function PaletteCommandLauncher() {
  const { runPaletteCommand } = useChatCommands();
  return <button onClick={() => runPaletteCommand({ name: 'model', args: '<id>', description: 'Switch model' })}>Model</button>;
}

function renderComposer({ variant }: { variant?: 'inline' | 'textarea' } = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveProjectProvider>
              <ChatSessionProvider>
                <ChatCommandsProvider>
                  <PaletteCommandLauncher />
                  <Composer variant={variant} />
                  <NoticeProbe />
                </ChatCommandsProvider>
              </ChatSessionProvider>
            </ActiveProjectProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => localStorage.clear());

describe('Composer', () => {
  describe('when entering slash commands', () => {
    it('runs no-argument commands through the command context without sending a message', async () => {
      seedProject();
      const { onSend } = useAgentControllerHandlers();
      const user = userEvent.setup();
      renderComposer();

      const input = await screen.findByRole('textbox', { name: 'Message' });
      await waitFor(() => expect(input).toBeEnabled());
      await user.type(input, '/help {Enter}');

      await waitFor(() => expect(screen.getByLabelText('Notices')).toHaveTextContent('Available commands:'));
      expect(screen.getByLabelText('Notices')).toHaveTextContent('/permissions');
      expect(onSend).not.toHaveBeenCalled();
    });

    it.each([
      ['/model openai/gpt-4o', 'onModel', { modelId: 'openai/gpt-4o' }],
      ['/goal Ship the composer refactor', 'onGoal', { objective: 'Ship the composer refactor' }],
      ['/follow-up Test the release', 'onFollowUp', { message: 'Test the release' }],
    ] as const)('sends %s to its controller endpoint', async (command, handlerName, expectedBody) => {
      seedProject();
      const handlers = useAgentControllerHandlers();
      const user = userEvent.setup();
      renderComposer();

      const input = await screen.findByRole('textbox', { name: 'Message' });
      await waitFor(() => expect(input).toBeEnabled());
      await user.type(input, `${command}{Enter}`);

      await waitFor(() => expect(handlers[handlerName]).toHaveBeenCalledWith(expectedBody));
      expect(handlers.onSend).not.toHaveBeenCalled();
    });
  });

  describe('when a palette argument command is chosen', () => {
    it('prefills and focuses the composer through the command context', async () => {
      seedProject();
      useAgentControllerHandlers();
      const user = userEvent.setup();
      renderComposer();

      await user.click(screen.getByRole('button', { name: 'Model' }));

      const input = screen.getByRole('textbox', { name: 'Message' });
      await waitFor(() => {
        expect(input).toHaveValue('/model ');
        expect(input).toHaveFocus();
      });
    });
  });

  describe('when composing a multi-line draft', () => {
    it('grows with content via CSS instead of inline styles', async () => {
      seedProject();
      useAgentControllerHandlers();
      const user = userEvent.setup();
      renderComposer();

      const input = await screen.findByRole('textbox', { name: 'Message' });
      await waitFor(() => expect(input).toBeEnabled());
      await user.type(input, 'first line{Shift>}{Enter}{/Shift}second line{Shift>}{Enter}{/Shift}third line');

      expect(input).toHaveValue('first line\nsecond line\nthird line');
      expect(input).toHaveClass('field-sizing-content');
      expect((input as HTMLTextAreaElement).style.height).toBe('');
    });
  });

  describe('when sending messages', () => {
    it('sends normal input and renders the textarea variant', async () => {
      seedProject();
      const { onSend } = useAgentControllerHandlers();
      const user = userEvent.setup();
      renderComposer({ variant: 'textarea' });

      const input = await screen.findByRole('textbox', { name: 'Message' });
      await waitFor(() => expect(input).toBeEnabled());
      expect(input).toHaveClass('field-sizing-content', 'min-h-28');
      await user.type(input, 'Hello{Enter}');

      await waitFor(() => expect(onSend).toHaveBeenCalledWith({ message: 'Hello' }));
    });
  });
});
