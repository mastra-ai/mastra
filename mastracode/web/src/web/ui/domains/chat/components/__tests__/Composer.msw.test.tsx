import type { AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { ChatCommandsProvider, useChatCommands } from '../../context/ChatCommandsProvider';
import { useChatTranscript } from '../../context/useChatTranscript';
import { SLASH_COMMANDS } from '../../services/commands';
import { Composer } from '../Composer';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

function sessionState(running = false): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    running,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function sse(): Response {
  return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function seedFactory() {
  const project: Factory = {
    id: 'project-test',
    name: 'MastraCode Test',
    resourceId: RESOURCE_ID,
    createdAt: 1,
    binding: {
      kind: 'local',
      path: '/tmp/mastracode-test',
      gitBranch: 'main',
    },
  };
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
}

function useAgentControllerHandlers({ running = false }: { running?: boolean } = {}) {
  const onSend = vi.fn();
  const onSteer = vi.fn();
  const onAbort = vi.fn();
  const onPermissions = vi.fn();
  let permissions: PermissionRules = { categories: { execute: 'ask' }, tools: { 'shell.run': 'deny' } };
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState(running))),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState(running))),
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
  return { onSend, onSteer, onAbort, onPermissions };
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
  const { run } = useChatCommands();
  const modelCommand = SLASH_COMMANDS.find(command => command.name === 'model');
  return (
    <button type="button" onClick={() => modelCommand && run(modelCommand)}>
      Run model command
    </button>
  );
}

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/project-test/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/threads/:threadId"
          element={
            <ActiveFactoryProvider factoryId="project-test">
              <ChatSessionProvider threadId={THREAD_ID}>
                <ChatCommandsProvider>
                  <Composer {...props} />
                  <PaletteCommandProbe />
                  <NoticeProbe />
                </ChatCommandsProvider>
              </ChatSessionProvider>
            </ActiveFactoryProvider>
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
  describe('when submitting a message', () => {
    it('sends the trimmed draft on Enter', async () => {
      seedFactory();
      const { onSend } = useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, '  hello agent  {Enter}');

      await waitFor(() => expect(onSend).toHaveBeenCalledWith({ message: 'hello agent' }));
    });

    it('keeps a newline in the draft on Shift+Enter', async () => {
      seedFactory();
      const { onSend } = useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, 'first line{Shift>}{Enter}{/Shift}second line');

      expect(input).toHaveValue('first line\nsecond line');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('cycles to the next mode on Shift+Tab without changing the draft', async () => {
      seedFactory();
      useAgentControllerHandlers();
      const onMode = vi.fn();
      server.use(
        http.get(`${API}/modes`, () =>
          HttpResponse.json({
            modes: [
              { id: 'build', name: 'Build' },
              { id: 'plan', name: 'Plan' },
              { id: 'fast', name: 'Explore' },
            ],
          }),
        ),
        http.post(`${SESSION}/mode`, async ({ request }) => {
          onMode(await request.json());
          return HttpResponse.json({ ok: true });
        }),
      );
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, 'keep this draft');
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');

      await waitFor(() => expect(onMode).toHaveBeenCalledWith({ modeId: 'plan' }));
      expect(input).toHaveFocus();
      expect(input).toHaveValue('keep this draft');
    });
  });

  describe('when the agent is busy', () => {
    it('steers instead of sending a new message', async () => {
      seedFactory();
      const { onSend, onSteer } = useAgentControllerHandlers({ running: true });
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toHaveAttribute('placeholder', 'Steer the agent…'));
      await userEvent.type(input, 'change direction{Enter}');

      await waitFor(() => expect(onSteer).toHaveBeenCalledWith({ message: 'change direction' }));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('aborts the active run', async () => {
      seedFactory();
      const { onAbort } = useAgentControllerHandlers({ running: true });
      renderComposer();

      const abort = await screen.findByRole('button', { name: 'Abort' });
      await userEvent.click(abort);

      await waitFor(() => expect(onAbort).toHaveBeenCalledOnce());
    });
  });

  describe('when entering exact no-arg slash commands', () => {
    it('shows permissions from the client cache instead of sending a message', async () => {
      seedFactory();
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
      seedFactory();
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
      seedFactory();
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
    it('prefills the composer each time the command is selected', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: 'Run model command' }));

      await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('/model '));
      await userEvent.clear(screen.getByRole('textbox'));
      await userEvent.type(screen.getByRole('textbox'), 'changed draft');

      await userEvent.click(screen.getByRole('button', { name: 'Run model command' }));

      await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('/model '));
    });
  });

  describe('when attaching images', () => {
    const pngFile = () => new File(['png-bytes'], 'shot.png', { type: 'image/png' });
    const pngBase64 = 'cG5nLWJ5dGVz'; // btoa('png-bytes')

    it('previews the image, sends it as a file, and clears the pending list', async () => {
      seedFactory();
      const { onSend } = useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.upload(screen.getByLabelText('Attach images'), pngFile());

      const preview = await screen.findByRole('img', { name: 'shot.png' });
      expect(preview).toHaveAttribute('src', `data:image/png;base64,${pngBase64}`);

      await userEvent.type(input, 'look at this{Enter}');

      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith({
          message: 'look at this',
          files: [{ data: pngBase64, mediaType: 'image/png', filename: 'shot.png' }],
        }),
      );
      expect(screen.queryByRole('img', { name: 'shot.png' })).not.toBeInTheDocument();
    });

    it('sends an image without any text', async () => {
      seedFactory();
      const { onSend } = useAgentControllerHandlers();
      renderComposer();

      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      await userEvent.upload(screen.getByLabelText('Attach images'), pngFile());
      await screen.findByRole('img', { name: 'shot.png' });

      await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith({
          message: '',
          files: [{ data: pngBase64, mediaType: 'image/png', filename: 'shot.png' }],
        }),
      );
    });

    it('removes a pending image before sending', async () => {
      seedFactory();
      const { onSend } = useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.upload(screen.getByLabelText('Attach images'), pngFile());
      await screen.findByRole('img', { name: 'shot.png' });

      await userEvent.click(screen.getByRole('button', { name: 'Remove image' }));
      expect(screen.queryByRole('img', { name: 'shot.png' })).not.toBeInTheDocument();

      await userEvent.type(input, 'text only{Enter}');
      await waitFor(() => expect(onSend).toHaveBeenCalledWith({ message: 'text only' }));
    });
  });

  describe('when rendering the composer controls', () => {
    it('places the session status line in the composer actions area', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderComposer();

      const statusLine = await screen.findByLabelText('Session status line');

      expect(statusLine.closest('[data-slot="composer-actions"]')).toBeInTheDocument();
    });
  });

  describe('when composing a multi-line draft', () => {
    it('grows with content via CSS instead of inline styles', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderComposer();

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, 'first line{Shift>}{Enter}{/Shift}second line{Shift>}{Enter}{/Shift}third line');

      expect(input).toHaveValue('first line\nsecond line\nthird line');
      expect((input as HTMLTextAreaElement).style.height).toBe('');
    });

    it('leaves textarea variant height under stylesheet control', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderComposer({ variant: 'textarea' });

      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      expect((input as HTMLTextAreaElement).style.height).toBe('');
    });
  });
});
