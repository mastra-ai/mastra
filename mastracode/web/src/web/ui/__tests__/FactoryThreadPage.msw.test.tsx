import type { AgentControllerSessionState } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { FactoryThreadTaskContext } from '../../../shared/api/types';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'factory-context';
const PROJECT_REPOSITORY_ID = 'repository-context';
const RESOURCE_ID = 'resource-context';
const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const CONTEXT_URL = `${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/threads/:threadId/context`;

interface ContextRequest {
  factoryProjectId: string;
  threadId: string;
  resourceId: string | null;
  sessionId: string | null;
}

function taskContext(threadId: string): FactoryThreadTaskContext {
  return {
    task: {
      source: 'github-issue',
      identifier: threadId === 'thread-one' ? '42' : '77',
      title: threadId === 'thread-one' ? 'Factory task one' : 'Factory task two',
      description: `Context for ${threadId}`,
      state: 'open',
      labels: ['factory'],
      assignees: ['ada'],
      url: `https://github.com/mastra-ai/mastra/issues/${threadId === 'thread-one' ? '42' : '77'}`,
    },
    resolution: { mode: 'live' },
  };
}

function sessionState(threadId: string): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function installMobileViewport(initialMobile = false) {
  let mobile = initialMobile;
  const listeners = new Map<string, Set<EventListener>>();
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    get matches() {
      return query.includes('max-width') ? mobile : false;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener !== 'function') return;
      const queryListeners = listeners.get(query) ?? new Set();
      queryListeners.add(listener);
      listeners.set(query, queryListeners);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') listeners.get(query)?.delete(listener);
    },
    dispatchEvent: vi.fn(() => true),
  }));

  return {
    setMobile(nextMobile: boolean) {
      mobile = nextMobile;
      for (const [media, queryListeners] of listeners) {
        const event = new Event('change');
        Object.defineProperties(event, {
          matches: { value: media.includes('max-width') ? mobile : false },
          media: { value: media },
        });
        for (const listener of queryListeners) listener(event);
      }
    },
  };
}

function installRouteHandlers(contextRequests: ContextRequest[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authEnabled: true,
        authenticated: true,
        user: { userId: 'user-context', email: 'proof@example.com', name: 'Proof User' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Factory Context' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-context',
            installationId: 'installation-context',
            repositories: [
              {
                id: PROJECT_REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/tmp/mastra-context',
                repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      const sessionId = String(params.sessionId);
      return HttpResponse.json({
        session: {
          id: `row-${sessionId}`,
          sessionId,
          projectRepositoryId: PROJECT_REPOSITORY_ID,
          orgId: 'org-context',
          userId: 'user-context',
          branch: sessionId.startsWith('thread-personal') ? 'user/personal-context' : `feature/${sessionId}`,
          baseBranch: 'main',
          sandboxId: 'sandbox-context',
          sandboxWorkdir: '/tmp/mastra-context',
          materializedAt: '2026-07-22T00:00:00.000Z',
          createdAt: '2026-07-22T00:00:00.000Z',
          updatedAt: '2026-07-22T00:00:00.000Z',
        },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/ensure`, () => {
      const result = {
        resourceId: RESOURCE_ID,
        factoryProjectId: FACTORY_ID,
        projectRepositoryId: PROJECT_REPOSITORY_ID,
        sandboxId: 'sandbox-context',
        sandboxWorkdir: '/tmp/mastra-context',
      };
      return new HttpResponse(`event: done\ndata: ${JSON.stringify(result)}\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(CONTEXT_URL, ({ params, request }) => {
      const url = new URL(request.url);
      const threadId = String(params.threadId);
      contextRequests.push({
        factoryProjectId: String(params.factoryProjectId),
        threadId,
        resourceId: url.searchParams.get('resourceId'),
        sessionId: url.searchParams.get('sessionId'),
      });
      return HttpResponse.json({ context: taskContext(threadId) });
    }),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ rootPath: '/tmp/mastra-context', renderedPath: '.artifacts', entries: [] }),
    ),
    http.post(`${API}/sessions`, ({ request }) => {
      const threadId = request.url.includes('session-two') ? 'thread-two' : 'thread-one';
      return HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${API}/sessions/:resourceId`, ({ request }) => {
      const threadId = request.url.includes('session-two') ? 'thread-two' : 'thread-one';
      return HttpResponse.json(sessionState(threadId));
    }),
    http.put(`${API}/sessions/:resourceId/state`, ({ request }) => {
      const threadId = request.url.includes('session-two') ? 'thread-two' : 'thread-one';
      return HttpResponse.json(sessionState(threadId));
    }),
    http.get(`${API}/sessions/:resourceId/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${API}/sessions/:resourceId/threads`, ({ request }) => {
      const threadId = request.url.includes('session-two') ? 'thread-two' : 'thread-one';
      return HttpResponse.json({
        threads: [
          {
            id: threadId,
            title: threadId === 'thread-two' ? 'Thread two' : 'Thread one',
            createdAt: '2026-07-22T00:00:00.000Z',
            updatedAt: '2026-07-22T00:00:00.000Z',
          },
        ],
      });
    }),
    http.post(`${API}/sessions/:resourceId/thread`, () => HttpResponse.json({ ok: true })),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${API}/sessions/:resourceId/stream`, () => emptySse()),
  );
}

function renderRoute(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Factory thread task context', () => {
  it('shows Task and Files in one desktop panel and requests the exact session binding only while Task is visible', async () => {
    const contextRequests: ContextRequest[] = [];
    installRouteHandlers(contextRequests);
    const user = userEvent.setup();

    renderRoute(`/factories/${FACTORY_ID}/workspaces/session-one/threads/thread-one`);

    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(contextRequests).toEqual([
      {
        factoryProjectId: FACTORY_ID,
        threadId: 'thread-one',
        // Per-session addressing: the chat surface addresses the session's own
        // id as the memory resourceId (see ChatSessionConfigProvider).
        resourceId: 'session-one',
        sessionId: 'session-one',
      },
    ]);

    await user.click(screen.getByRole('tab', { name: 'Files' }));

    expect(await screen.findByTestId('workspace-viewer-panel')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Factory task one' })).not.toBeInTheDocument();
    expect(contextRequests).toHaveLength(1);
  });

  it('resets to Task and uses a new query identity when workspace and thread route params change', async () => {
    const contextRequests: ContextRequest[] = [];
    installRouteHandlers(contextRequests);
    const user = userEvent.setup();
    const router = renderRoute(`/factories/${FACTORY_ID}/workspaces/session-one/threads/thread-one`);

    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    const composer = screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toBeEnabled());
    fireEvent.change(composer, { target: { value: 'Thread one draft' } });
    await user.click(screen.getByRole('tab', { name: 'Files' }));
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');

    await act(async () => {
      await router.navigate(`/factories/${FACTORY_ID}/workspaces/session-two/threads/thread-two`);
    });

    await waitFor(() =>
      expect(contextRequests).toEqual([
        {
          factoryProjectId: FACTORY_ID,
          threadId: 'thread-one',
          resourceId: 'session-one',
          sessionId: 'session-one',
        },
        {
          factoryProjectId: FACTORY_ID,
          threadId: 'thread-two',
          resourceId: 'session-two',
          sessionId: 'session-two',
        },
      ]),
    );
    expect(await screen.findByRole('heading', { name: 'Factory task two' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  });

  it('preserves the composer draft while breakpoint changes reset only panel state', async () => {
    const contextRequests: ContextRequest[] = [];
    const viewport = installMobileViewport();
    installRouteHandlers(contextRequests);

    renderRoute(`/factories/${FACTORY_ID}/workspaces/session-one/threads/thread-one`);

    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'What can I help you build?' })).toBeInTheDocument();
    const composer = screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toBeEnabled());
    fireEvent.change(composer, { target: { value: 'Draft survives the breakpoint' } });
    expect(composer).toHaveValue('Draft survives the breakpoint');
    fireEvent.change(screen.getByLabelText('Attach images'), {
      target: { files: [new File(['proof'], 'proof.png', { type: 'image/png' })] },
    });
    expect(await screen.findByRole('img', { name: 'proof.png' })).toBeInTheDocument();

    act(() => viewport.setMobile(true));
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft survives the breakpoint');
    expect(screen.getByRole('img', { name: 'proof.png' })).toBeInTheDocument();

    act(() => viewport.setMobile(false));
    expect(await screen.findByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft survives the breakpoint');
    expect(screen.getByRole('img', { name: 'proof.png' })).toBeInTheDocument();
  });

  it('keeps personal sessions Files-only and makes no task-context request', async () => {
    const contextRequests: ContextRequest[] = [];
    installRouteHandlers(contextRequests);

    renderRoute(`/factories/${FACTORY_ID}/user/threads/thread-personal`);

    expect(await screen.findByTestId('workspace-viewer-panel')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();
    expect(contextRequests).toEqual([]);
  });
});
