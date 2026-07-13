/**
 * BDD coverage for `ChatSessionProvider` (`domains/chat/context`).
 *
 * The provider owns the agent-controller session plus the derived chat-run
 * state (`busy`, `showWorkingIndicator`) so those never travel through layout
 * props again. Driven end-to-end: real fetch/SSE transport, MSW at the
 * network boundary.
 */
import type {
  AgentControllerEvent,
  AgentControllerMessage,
  AgentControllerSessionState,
  PermissionPolicy,
  PermissionRules,
} from '@mastra/client-js';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider, useActiveProjectContext } from '../../../workspaces';
import { ChatMessageList } from '../../components/ChatMessageList';
import { ChatMessageBoundary, ChatSessionProvider } from '../ChatSessionProvider';
import { useChatConnection } from '../useChatConnection';
import { useChatModels } from '../useChatModels';
import { useChatPermissions } from '../useChatPermissions';
import { useChatRuntime } from '../useChatRuntime';
import { useChatTranscript } from '../useChatTranscript';
import { useChatModes } from '../useChatModes';
import { useChatSessionContext } from '../useChatSessionContext';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const NEXT_RESOURCE_ID = 'resource-next';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const NEXT_SESSION = `${API}/sessions/${NEXT_RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const ROUTE_THREAD_ID = 'route-thread-test';
const PERSISTED_MESSAGES: AgentControllerMessage[] = [
  { id: 'persisted-user', role: 'user', content: [{ type: 'text', text: 'Persisted user question' }] },
  { id: 'persisted-assistant', role: 'assistant', content: [{ type: 'text', text: 'Persisted assistant answer' }] },
];

afterEach(() => {
  localStorage.clear();
});

const project: Project = {
  id: 'project-test',
  name: 'MastraCode Test',
  path: '/tmp/mastracode-test',
  resourceId: RESOURCE_ID,
  createdAt: 1,
};

const nextProject: Project = {
  id: 'project-next',
  name: 'MastraCode Next',
  path: '/tmp/mastracode-next',
  resourceId: NEXT_RESOURCE_ID,
  createdAt: 2,
};

function seedProject(projects: Project[] = [project], activeProject: Project = project) {
  localStorage.setItem('mastracode-projects', JSON.stringify(projects));
  localStorage.setItem('mastracode-active-project', activeProject.id);
}

function sessionState(resourceId = RESOURCE_ID): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function requestCount(requests: string[], request: string) {
  return requests.filter(candidate => candidate === request).length;
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

function useAgentControllerHandlers(events: AgentControllerEvent[] = [], requests: string[] = [], stateStatus = 200) {
  server.use(
    http.post(`${API}/sessions`, () => {
      requests.push('create');
      return HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => {
      requests.push('state');
      return HttpResponse.json(sessionState());
    }),
    http.get(NEXT_SESSION, () => {
      requests.push('state:next');
      return HttpResponse.json(sessionState(NEXT_RESOURCE_ID));
    }),
    http.put(`${SESSION}/state`, async ({ request }) => {
      requests.push(`setState:${JSON.stringify(await request.json())}`);
      if (stateStatus >= 400) return HttpResponse.json({ error: 'nope' }, { status: stateStatus });
      return HttpResponse.json(sessionState());
    }),
    http.put(`${NEXT_SESSION}/state`, async ({ request }) => {
      requests.push(`setState:next:${JSON.stringify(await request.json())}`);
      return HttpResponse.json(sessionState(NEXT_RESOURCE_ID));
    }),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${NEXT_SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${NEXT_SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${NEXT_SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse(events)),
    http.get(`${NEXT_SESSION}/stream`, () => sse(events)),
  );
}

function Probe() {
  const { status, threadId } = useChatConnection();
  const { transcript, busy, showWorkingIndicator } = useChatTranscript();
  const { usage, followUpCount, omPhase, goal } = useChatRuntime();
  const { selectProject } = useActiveProjectContext();
  const messageText = transcript.entries
    .filter(entry => entry.kind === 'message')
    .flatMap(entry => entry.message.content.parts)
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="thread-id">{threadId ?? '(none)'}</span>
      <span data-testid="entries-count">{transcript.entries.length}</span>
      <span data-testid="message-text">{messageText}</span>
      <span data-testid="busy">{busy ? 'yes' : 'no'}</span>
      <span data-testid="working">{showWorkingIndicator ? 'yes' : 'no'}</span>
      <span data-testid="usage-total">{usage?.totalTokens ?? 0}</span>
      <span data-testid="follow-up-count">{followUpCount}</span>
      <span data-testid="om-phase">{omPhase}</span>
      <span data-testid="goal-objective">{goal?.objective ?? '(none)'}</span>
      <button onClick={() => void selectProject(nextProject)}>switch project</button>
    </div>
  );
}

function ModesProbe() {
  const { activeMode, activeModeId, modes, setMode } = useChatModes();

  return (
    <div>
      <span data-testid="active-mode-id">{activeModeId ?? ''}</span>
      <span data-testid="active-mode-label">{activeMode?.name ?? ''}</span>
      <span data-testid="modes-count">{modes.length}</span>
      <button onClick={() => void setMode('plan')}>switch to plan</button>
    </div>
  );
}

function ModelsProbe() {
  const { activeModelId, setModel } = useChatModels();

  return (
    <div>
      <span data-testid="active-model-id">{activeModelId ?? ''}</span>
      <button onClick={() => void setModel('openai/gpt-4o')}>switch model</button>
    </div>
  );
}

function PermissionsProbe() {
  const { permissions, permissionsLoading, pendingPermissionCategory, setPermissionForCategory } = useChatPermissions();
  const categories = Object.entries(permissions?.categories ?? {})
    .map(([category, policy]) => `${category}:${policy}`)
    .join(',');
  const tools = Object.entries(permissions?.tools ?? {})
    .map(([tool, policy]) => `${tool}:${policy}`)
    .join(',');

  return (
    <div>
      <span data-testid="permissions-loading">{permissionsLoading ? 'yes' : 'no'}</span>
      <span data-testid="permissions-categories">{categories}</span>
      <span data-testid="permissions-tools">{tools}</span>
      <span data-testid="pending-permission-category">{pendingPermissionCategory ?? ''}</span>
      <button onClick={() => void setPermissionForCategory('execute', 'allow')}>allow execute</button>
    </div>
  );
}

function TranscriptProbe() {
  const { transcript } = useChatTranscript();
  const { threadId } = useChatConnection();
  const messageText = transcript.entries
    .filter(entry => entry.kind === 'message')
    .flatMap(entry => entry.message.content.parts)
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');

  return (
    <div>
      <span data-testid="focused-thread-id">{threadId ?? '(none)'}</span>
      <span data-testid="focused-entries-count">{transcript.entries.length}</span>
      <span data-testid="focused-message-text">{messageText}</span>
    </div>
  );
}

function SessionContextProbe() {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();

  return (
    <div>
      <span data-testid="session-resource-id">{resourceId}</span>
      <span data-testid="session-enabled">{sessionEnabled ? 'yes' : 'no'}</span>
      <span data-testid="session-project-path">{projectPath ?? ''}</span>
      <span data-testid="session-base-url">{baseUrl}</span>
    </div>
  );
}

function ProbeSession({ threadId, children }: { threadId?: string; children?: ReactNode }) {
  return (
    <ActiveProjectProvider>
      <ChatSessionProvider threadId={threadId}>{children ?? <Probe />}</ChatSessionProvider>
    </ActiveProjectProvider>
  );
}

function renderProbe(threadId?: string) {
  return renderWithProviders(<ProbeSession threadId={threadId} />);
}

function renderFocusedProbe(children: ReactNode, threadId?: string) {
  return renderWithProviders(<ProbeSession threadId={threadId}>{children}</ProbeSession>);
}

function renderMessageList(threadId?: string) {
  return renderWithProviders(
    <ActiveProjectProvider>
      <ChatSessionProvider threadId={threadId}>
        <ChatMessageBoundary>
          <ChatMessageList />
        </ChatMessageBoundary>
      </ChatSessionProvider>
    </ActiveProjectProvider>,
  );
}

describe('ChatSessionProvider', () => {
  describe('focused provider consumers', () => {
    it('given a seeded project and synced session, when a mode consumer renders, then it reads modes and switches through the mode mutation path', async () => {
      const requests: string[] = [];
      let activeModeId = 'build';
      seedProject();
      useAgentControllerHandlers([], requests);
      server.use(
        http.get(`${API}/modes`, () => {
          requests.push('modes');
          return HttpResponse.json({
            modes: [
              { id: 'build', name: 'Build' },
              { id: 'plan', name: 'Plan' },
            ],
          });
        }),
        http.get(`${API}/models`, () => {
          requests.push('models');
          return HttpResponse.json({ models: [] });
        }),
        http.get(`${SESSION}/permissions`, () => {
          requests.push('permissions');
          return HttpResponse.json({ categories: {}, tools: {} });
        }),
        http.get(`${SESSION}/threads`, () => {
          requests.push('threads');
          return HttpResponse.json({ threads: [] });
        }),
        http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => {
          requests.push('messages');
          return HttpResponse.json({ messages: [] });
        }),
        http.get(SESSION, () => {
          requests.push('state');
          return HttpResponse.json({ ...sessionState(), modeId: activeModeId });
        }),
        http.post(`${SESSION}/mode`, async ({ request }) => {
          const body = await request.json();
          requests.push(`mode:${JSON.stringify(body)}`);
          if (typeof body === 'object' && body && 'modeId' in body && typeof body.modeId === 'string') {
            activeModeId = body.modeId;
          }
          return HttpResponse.json({ ok: true });
        }),
      );

      renderFocusedProbe(<ModesProbe />);

      await waitFor(() => expect(screen.getByTestId('active-mode-label')).toHaveTextContent('Build'));
      expect(screen.getByTestId('active-mode-id')).toHaveTextContent('build');
      expect(screen.getByTestId('modes-count')).toHaveTextContent('2');
      const readsBeforeSwitch = {
        create: requestCount(requests, 'create'),
        state: requestCount(requests, 'state'),
        modes: requestCount(requests, 'modes'),
        models: requestCount(requests, 'models'),
        permissions: requestCount(requests, 'permissions'),
        threads: requestCount(requests, 'threads'),
        messages: requestCount(requests, 'messages'),
      };

      await userEvent.click(screen.getByRole('button', { name: 'switch to plan' }));

      await waitFor(() => expect(requests).toContain('mode:{"modeId":"plan"}'));
      await waitFor(() => expect(screen.getByTestId('active-mode-label')).toHaveTextContent('Plan'));
      expect(requestCount(requests, 'state')).toBe(readsBeforeSwitch.state + 1);
      for (const request of ['create', 'modes', 'models', 'permissions', 'threads', 'messages'] as const) {
        expect(requestCount(requests, request)).toBe(readsBeforeSwitch[request]);
      }
    });

    it('given a synced model, when a model consumer renders, then it reads and switches model without transcript context', async () => {
      const requests: string[] = [];
      let activeModelId = 'openai/gpt-4o-mini';
      seedProject();
      useAgentControllerHandlers([], requests);
      server.use(
        http.get(`${API}/modes`, () => {
          requests.push('modes');
          return HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] });
        }),
        http.get(`${API}/models`, () => {
          requests.push('models');
          return HttpResponse.json({ models: [] });
        }),
        http.get(SESSION, () => {
          requests.push('state');
          return HttpResponse.json({ ...sessionState(), modelId: activeModelId });
        }),
        http.get(`${SESSION}/permissions`, () => {
          requests.push('permissions');
          return HttpResponse.json({ categories: {}, tools: {} });
        }),
        http.get(`${SESSION}/threads`, () => {
          requests.push('threads');
          return HttpResponse.json({ threads: [] });
        }),
        http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => {
          requests.push('messages');
          return HttpResponse.json({ messages: [] });
        }),
        http.post(`${SESSION}/model`, async ({ request }) => {
          const body = await request.json();
          requests.push(`model:${JSON.stringify(body)}`);
          if (typeof body === 'object' && body && 'modelId' in body && typeof body.modelId === 'string') {
            activeModelId = body.modelId;
          }
          return HttpResponse.json({ ok: true });
        }),
      );

      renderFocusedProbe(<ModelsProbe />);

      await waitFor(() => expect(screen.getByTestId('active-model-id')).toHaveTextContent('openai/gpt-4o-mini'));
      const readsBeforeSwitch = {
        create: requestCount(requests, 'create'),
        state: requestCount(requests, 'state'),
        modes: requestCount(requests, 'modes'),
        models: requestCount(requests, 'models'),
        permissions: requestCount(requests, 'permissions'),
        threads: requestCount(requests, 'threads'),
        messages: requestCount(requests, 'messages'),
      };

      await userEvent.click(screen.getByRole('button', { name: 'switch model' }));

      await waitFor(() => expect(requests).toContain('model:{"modelId":"openai/gpt-4o"}'));
      await waitFor(() => expect(screen.getByTestId('active-model-id')).toHaveTextContent('openai/gpt-4o'));
      expect(requestCount(requests, 'state')).toBe(readsBeforeSwitch.state + 1);
      for (const request of ['create', 'modes', 'models', 'permissions', 'threads', 'messages'] as const) {
        expect(requestCount(requests, request)).toBe(readsBeforeSwitch[request]);
      }
    });

    it('given permission rules, when a permissions consumer updates a category, then it reads fetched rules and exposes pending category state', async () => {
      const requests: string[] = [];
      let permissions: PermissionRules = {
        categories: { execute: 'ask', read: 'allow' },
        tools: { 'shell.run': 'deny' },
      };
      let resolvePermissionUpdate: (() => void) | undefined;
      seedProject();
      useAgentControllerHandlers([], requests);
      server.use(
        http.get(`${SESSION}/permissions`, () => HttpResponse.json(permissions)),
        http.put(`${SESSION}/permissions/category`, async ({ request }) => {
          const body = await request.json();
          requests.push(`permission:${JSON.stringify(body)}`);
          if (typeof body === 'object' && body && 'category' in body && 'policy' in body) {
            const category = body.category;
            const policy = body.policy;
            if (typeof category === 'string' && typeof policy === 'string') {
              permissions = {
                ...permissions,
                categories: { ...permissions.categories, [category]: policy as PermissionPolicy },
              };
            }
          }

          return new Promise<Response>(resolve => {
            resolvePermissionUpdate = () => resolve(HttpResponse.json({ ok: true }));
          });
        }),
      );

      renderFocusedProbe(<PermissionsProbe />);

      await waitFor(() => expect(screen.getByTestId('permissions-loading')).toHaveTextContent('no'));
      expect(screen.getByTestId('permissions-categories')).toHaveTextContent('execute:ask');
      expect(screen.getByTestId('permissions-categories')).toHaveTextContent('read:allow');
      expect(screen.getByTestId('permissions-tools')).toHaveTextContent('shell.run:deny');

      await userEvent.click(screen.getByRole('button', { name: 'allow execute' }));

      await waitFor(() => expect(requests).toContain('permission:{"category":"execute","policy":"allow"}'));
      expect(screen.getByTestId('pending-permission-category')).toHaveTextContent('execute');
      resolvePermissionUpdate?.();
      await waitFor(() => expect(screen.getByTestId('pending-permission-category')).toBeEmptyDOMElement());
      await waitFor(() => expect(screen.getByTestId('permissions-categories')).toHaveTextContent('execute:allow'));
    });

    it('given a route thread prop, when a transcript consumer renders, then it receives persisted route-thread messages', async () => {
      seedProject();
      useAgentControllerHandlers();
      server.use(
        http.get(`${SESSION}/threads/${ROUTE_THREAD_ID}/messages`, () =>
          HttpResponse.json({ messages: PERSISTED_MESSAGES }),
        ),
      );

      renderFocusedProbe(<TranscriptProbe />, ROUTE_THREAD_ID);

      await waitFor(() => expect(screen.getByTestId('focused-entries-count')).toHaveTextContent('2'));
      expect(screen.getByTestId('focused-message-text')).toHaveTextContent('Persisted user question');
      expect(screen.getByTestId('focused-message-text')).toHaveTextContent('Persisted assistant answer');
    });

    it('given /new with no threadId, when a transcript consumer renders, then it remains an empty draft session', async () => {
      seedProject();
      useAgentControllerHandlers();

      renderFocusedProbe(<TranscriptProbe />);

      await waitFor(() => expect(screen.getByTestId('focused-thread-id')).toHaveTextContent('(none)'));
      expect(screen.getByTestId('focused-entries-count')).toHaveTextContent('0');
      expect(screen.getByTestId('focused-message-text')).toBeEmptyDOMElement();
    });
  });

  describe('when a route thread has persisted messages', () => {
    it('renders fetched messages through the provider session', async () => {
      seedProject();
      useAgentControllerHandlers();
      server.use(
        http.get(`${SESSION}/threads/${ROUTE_THREAD_ID}/messages`, () =>
          HttpResponse.json({ messages: PERSISTED_MESSAGES }),
        ),
      );

      renderProbe(ROUTE_THREAD_ID);

      await waitFor(() => expect(screen.getByTestId('entries-count')).toHaveTextContent('2'));
      expect(screen.getByTestId('message-text')).toHaveTextContent('Persisted user question');
      expect(screen.getByTestId('message-text')).toHaveTextContent('Persisted assistant answer');
    });

    it('given session state names another thread, then it still loads only the URL thread history', async () => {
      const requests: string[] = [];
      seedProject();
      useAgentControllerHandlers([], requests);
      server.use(
        http.get(`${SESSION}/threads/${ROUTE_THREAD_ID}/messages`, () => {
          requests.push('messages:route');
          return HttpResponse.json({ messages: PERSISTED_MESSAGES });
        }),
        http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => {
          requests.push('messages:session-state');
          return HttpResponse.json({
            messages: [
              { id: 'wrong-thread-message', role: 'user', content: [{ type: 'text', text: 'Wrong thread text' }] },
            ],
          });
        }),
      );

      renderProbe(ROUTE_THREAD_ID);

      await waitFor(() => expect(screen.getByTestId('entries-count')).toHaveTextContent('2'));
      expect(screen.getByTestId('message-text')).toHaveTextContent('Persisted user question');
      expect(screen.getByTestId('message-text')).not.toHaveTextContent('Wrong thread text');
      expect(requests).toContain('messages:route');
      expect(requests).not.toContain('messages:session-state');
    });
  });

  describe('when the route switches to another thread', () => {
    it('renders only the new thread messages after they load', async () => {
      seedProject();
      useAgentControllerHandlers();
      server.use(
        http.get(`${SESSION}/threads/thread-one/messages`, () =>
          HttpResponse.json({
            messages: [
              { id: 'thread-one-message', role: 'user', content: [{ type: 'text', text: 'Thread one text' }] },
            ],
          }),
        ),
        http.get(`${SESSION}/threads/thread-two/messages`, () =>
          HttpResponse.json({
            messages: [
              { id: 'thread-two-message', role: 'user', content: [{ type: 'text', text: 'Thread two text' }] },
            ],
          }),
        ),
      );

      const { rerender } = renderProbe('thread-one');

      await waitFor(() => expect(screen.getByTestId('message-text')).toHaveTextContent('Thread one text'));
      rerender(<ProbeSession threadId="thread-two" />);

      await waitFor(() => expect(screen.getByTestId('message-text')).toHaveTextContent('Thread two text'));
      expect(screen.getByTestId('message-text')).not.toHaveTextContent('Thread one text');
    });
  });

  describe('when route thread messages are still loading', () => {
    it('renders the loading skeleton in the explicit message boundary while the route-thread provider stays available', async () => {
      seedProject();
      useAgentControllerHandlers();
      server.use(http.get(`${SESSION}/threads/${ROUTE_THREAD_ID}/messages`, () => new Promise(() => undefined)));

      renderFocusedProbe(
        <ChatMessageBoundary>
          <TranscriptProbe />
        </ChatMessageBoundary>,
        ROUTE_THREAD_ID,
      );

      expect(await screen.findByLabelText('Loading messages')).toBeVisible();
      expect(screen.queryByTestId('focused-thread-id')).not.toBeInTheDocument();
    });
  });

  describe('when a chat session metadata consumer renders', () => {
    it('reads session metadata from chat context without taking ownership of active project state', async () => {
      seedProject();
      useAgentControllerHandlers();

      renderFocusedProbe(<SessionContextProbe />);

      await waitFor(() => expect(screen.getByTestId('session-resource-id')).toHaveTextContent(RESOURCE_ID));
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
      expect(screen.getByTestId('session-project-path')).toHaveTextContent('/tmp/mastracode-test');
      expect(screen.getByTestId('session-base-url')).toHaveTextContent(TEST_BASE_URL);
    });
  });

  describe('when route thread messages fail to load', () => {
    it('shows a user-visible message loading error without exposing message query state through transcript context', async () => {
      seedProject();
      useAgentControllerHandlers();
      server.use(
        http.get(`${SESSION}/threads/${ROUTE_THREAD_ID}/messages`, () =>
          HttpResponse.json({ error: 'messages unavailable' }, { status: 500 }),
        ),
      );

      renderFocusedProbe(
        <ChatMessageBoundary>
          <TranscriptProbe />
        </ChatMessageBoundary>,
        ROUTE_THREAD_ID,
      );

      expect(await screen.findByText(/Failed to load messages:/)).toBeVisible();
      expect(screen.queryByTestId('focused-thread-id')).not.toBeInTheDocument();
    });

    it('shows a user-visible message loading error', async () => {
      seedProject();
      useAgentControllerHandlers();
      server.use(
        http.get(`${SESSION}/threads/${ROUTE_THREAD_ID}/messages`, () =>
          HttpResponse.json({ error: 'messages unavailable' }, { status: 500 }),
        ),
      );

      renderMessageList(ROUTE_THREAD_ID);

      expect(await screen.findByText(/Failed to load messages:/)).toBeVisible();
    });
  });

  describe('when no route thread is provided', () => {
    it('starts with an empty draft transcript while the connection becomes ready', async () => {
      seedProject();
      useAgentControllerHandlers();

      renderProbe();

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
      expect(screen.getByTestId('entries-count')).toHaveTextContent('0');
      expect(screen.getByTestId('message-text')).toBeEmptyDOMElement();
    });
  });

  it('given a seeded project, when the session connects, then it binds the session to the workspace path before ready', async () => {
    const requests: string[] = [];
    seedProject();
    useAgentControllerHandlers([], requests);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(requests.slice(0, 3)).toEqual([
      'create',
      'setState:{"state":{"projectPath":"/tmp/mastracode-test"}}',
      'state',
    ]);
  });

  it('given the workspace bind fails, then the connection still becomes ready', async () => {
    const requests: string[] = [];
    seedProject();
    useAgentControllerHandlers([], requests, 500);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(requests).toContain('setState:{"state":{"projectPath":"/tmp/mastracode-test"}}');
  });

  it('given a different project is selected, then the new session is bound to the new workspace path', async () => {
    const requests: string[] = [];
    seedProject([project, nextProject]);
    useAgentControllerHandlers([], requests);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    await userEvent.click(screen.getByRole('button', { name: 'switch project' }));

    await waitFor(() => expect(requests).toContain('setState:next:{"state":{"projectPath":"/tmp/mastracode-next"}}'));
  });

  it('given live state in one project, when selecting another project, then the next project starts with its own empty transcript and runtime', async () => {
    const requests: string[] = [];
    seedProject([project, nextProject]);
    useAgentControllerHandlers(
      [
        { type: 'agent_start' },
        {
          type: 'message_update',
          message: {
            id: 'first-project-message',
            role: 'assistant',
            content: [{ type: 'text', text: 'First project response' }],
          },
        },
        { type: 'usage_update', usage: { completionTokens: 12, totalTokens: 12 } },
        { type: 'om_observation_start' },
        { type: 'follow_up_queued', count: 2 },
        {
          type: 'goal_evaluation',
          payload: { objective: 'First project goal', status: 'active', iteration: 1, maxRuns: 3, passed: false },
        },
      ],
      requests,
    );
    server.use(
      http.get(`${NEXT_SESSION}/stream`, () => {
        requests.push('stream:next');
        return sse();
      }),
    );
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('message-text')).toHaveTextContent('First project response'));
    await waitFor(() => expect(screen.getByTestId('usage-total')).toHaveTextContent('12'));
    expect(screen.getByTestId('busy')).toHaveTextContent('yes');
    expect(screen.getByTestId('follow-up-count')).toHaveTextContent('2');
    expect(screen.getByTestId('om-phase')).toHaveTextContent('observing');
    expect(screen.getByTestId('goal-objective')).toHaveTextContent('First project goal');

    await userEvent.click(screen.getByRole('button', { name: 'switch project' }));

    await waitFor(() => expect(requests).toContain('stream:next'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('message-text')).toBeEmptyDOMElement();
    expect(screen.getByTestId('entries-count')).toHaveTextContent('0');
    expect(screen.getByTestId('busy')).toHaveTextContent('no');
    expect(screen.getByTestId('working')).toHaveTextContent('no');
    expect(screen.getByTestId('usage-total')).toHaveTextContent('0');
    expect(screen.getByTestId('follow-up-count')).toHaveTextContent('0');
    expect(screen.getByTestId('om-phase')).toHaveTextContent('idle');
    expect(screen.getByTestId('goal-objective')).toHaveTextContent('(none)');
  });

  it('given an idle transcript, then busy and the working indicator are off', async () => {
    seedProject();
    useAgentControllerHandlers();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('busy')).toHaveTextContent('no');
    expect(screen.getByTestId('working')).toHaveTextContent('no');
  });

  it('given a reconnect re-sync returns a new state without a route thread, then the draft transcript remains empty', async () => {
    const requests: string[] = [];
    seedProject();

    server.use(
      http.post(`${API}/sessions`, () =>
        HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: 'thread-before-drop' }),
      ),
      http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
      http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
      http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
      http.get(SESSION, () => {
        requests.push('state');
        const threadId =
          requests.filter(request => request === 'state').length === 1 ? 'thread-before-drop' : 'thread-after-drop';
        return HttpResponse.json({ ...sessionState(), threadId });
      }),
      http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
      http.get(`${SESSION}/threads/thread-before-drop/messages`, () => {
        requests.push('messages:before');
        return HttpResponse.json({
          messages: [{ id: 'before-message', role: 'user', content: [{ type: 'text', text: 'before' }] }],
        });
      }),
      http.get(`${SESSION}/threads/thread-after-drop/messages`, () => {
        requests.push('messages:after');
        return HttpResponse.json({
          messages: [{ id: 'after-message', role: 'user', content: [{ type: 'text', text: 'after' }] }],
        });
      }),
      http.get(`${SESSION}/stream`, () => {
        requests.push('stream');
        if (requests.filter(request => request === 'stream').length === 1) {
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                setTimeout(() => controller.error(new Error('stream dropped')), 0);
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }
        return sse();
      }),
    );

    renderProbe();

    await waitFor(() => expect(requests.filter(request => request === 'state')).toHaveLength(2), { timeout: 2500 });
    expect(requests).not.toContain('messages:before');
    expect(requests).not.toContain('messages:after');
    expect(screen.getByTestId('entries-count')).toHaveTextContent('0');
  });

  it('given a run started without streamed assistant text, then busy is on and the working indicator shows', async () => {
    seedProject();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('yes'));
    expect(screen.getByTestId('working')).toHaveTextContent('yes');
  });

  it('given a running turn whose last entry is a streaming assistant message with text, then the working indicator hides while busy stays on', async () => {
    seedProject();
    useAgentControllerHandlers([
      { type: 'agent_start' },
      {
        type: 'message_update',
        message: { id: 'assistant-stream', role: 'assistant', content: [{ type: 'text', text: 'Streaming now' }] },
      },
    ]);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('yes'));
    await waitFor(() => expect(screen.getByTestId('working')).toHaveTextContent('no'));
  });

  it('given no provider, when a focused chat consumer renders, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useChatConnection must be used within a ChatSessionProvider');
  });
});
