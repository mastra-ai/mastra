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
import { ChatSessionProvider } from '../../context/ChatSessionProvider';
import { useChatTranscript } from '../../context/useChatTranscript';
import { SLASH_COMMANDS } from '../../services/commands';
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
    http.get(`${SESSION}/stream`, () => sse()),
    http.post(`${SESSION}/messages`, async ({ request }) => {
      onSend(await request.json());
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
          categories: {
            ...permissions.categories,
            [String(body.category)]: body.policy,
          },
        };
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  return { onSend, onPermissions };
}

function NoticeProbe() {
  const { transcript } = useChatTranscript();
  return (
    <output aria-label="Notices">
      {transcript.entries.map(entry => (entry.kind === 'notice' ? <div key={entry.id}>{entry.text}</div> : null))}
    </output>
  );
}

function PaletteCommandProbe() {
  const { composerCommandName, run } = useChatCommands();
  const modelCommand = SLASH_COMMANDS.find(command => command.name === 'model');
  return (
    <>
      <output aria-label="Composer command state">{composerCommandName ?? 'none'}</output>
      <button type="button" onClick={() => modelCommand && run(modelCommand)}>
        Run model command
      </button>
    </>
  );
}

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveProjectProvider>
              <ChatSessionProvider threadId={THREAD_ID}>
                <ChatCommandsProvider>
                  <Composer {...props} />
                  <PaletteCommandProbe />
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

  describe('when a palette command is applied', () => {
    it('prefills the composer once and clears the command state', async () => {
      seedProject();
      useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: 'Run model command' }));

      await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('/model '));
      await waitFor(() => expect(screen.getByLabelText('Composer command state')).toHaveTextContent('none'));

      await userEvent.click(screen.getByRole('button', { name: 'Run model command' }));

      await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('/model '));
      await waitFor(() => expect(screen.getByLabelText('Composer command state')).toHaveTextContent('none'));
    });
  });

  describe('when composing a multi-line draft', () => {
    it('grows with content via CSS instead of inline styles', async () => {
      seedProject();
      useAgentControllerHandlers();
      renderComposer();

      const input = screen.getByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, 'first line{Shift>}{Enter}{/Shift}second line{Shift>}{Enter}{/Shift}third line');

      expect(input).toHaveValue('first line\nsecond line\nthird line');
      expect(input).toHaveClass('field-sizing-content');
      expect((input as HTMLTextAreaElement).style.height).toBe('');
    });

    it('sizes the textarea variant with CSS classes only', async () => {
      seedProject();
      useAgentControllerHandlers();
      renderComposer({ variant: 'textarea' });

      const input = screen.getByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      expect(input).toHaveClass('field-sizing-content', 'min-h-28');
      expect((input as HTMLTextAreaElement).style.height).toBe('');
    });
  });
});
