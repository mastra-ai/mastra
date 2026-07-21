/**
 * BDD coverage for the SPA route table (`src/web/ui/router.tsx`).
 *
 * Drives the real route components (auth-guard layout + redirects, powered by
 * the `useWebAuth` React Query hook) through a memory router with MSW stubbing
 * `/auth/me` and the agent-controller API, mirroring how the browser entry
 * wires `createBrowserRouter`.
 */
import type { AgentControllerSessionState } from '@mastra/client-js';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { loginUrl, redirectToLogin } from '../domains/auth';
import type * as AuthService from '../domains/auth/services/auth';
import { isServerFactory, type Factory } from '../domains/workspaces';
import { createAppRoutes } from '../router';

// jsdom's `window.location.assign` is unforgeable (cannot be spied on), so the
// service-level navigation helper is stubbed instead; `loginUrl` (asserted
// separately) stays real, as does `fetchAuthState` for the auth-guard hook.
vi.mock('../domains/auth/services/auth', async importOriginal => {
  const actual = await importOriginal<typeof AuthService>();
  return { ...actual, redirectToLogin: vi.fn() };
});

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
  vi.mocked(redirectToLogin).mockClear();
});

function seedFactory(project?: Factory | null) {
  if (project === null) {
    localStorage.setItem('mastracode-factories', JSON.stringify([]));
    localStorage.removeItem('mastracode-active-factory');
    return;
  }

  const selectedProject: Factory = project ?? {
    id: 'project-test',
    name: 'MastraCode Test',
    resourceId: RESOURCE_ID,
    createdAt: 1,
    binding: {
      kind: 'local',
      path: '/tmp/mastracode-test',
    },
  };
  localStorage.setItem('mastracode-factories', JSON.stringify([selectedProject]));
  localStorage.setItem('mastracode-active-factory', selectedProject.id);
}

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

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        void controller;
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function useAgentControllerHandlers() {
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => emptySse()),
  );
}

const AUTH_DISABLED = () => new Response(null, { status: 404 });
const UNAUTHENTICATED = () => HttpResponse.json({ authenticated: false, user: null });
const AUTHENTICATED = () =>
  HttpResponse.json({ authenticated: true, user: { name: 'Ada Lovelace', email: 'ada@example.com' } });

function renderRoutes(
  initialEntry: string,
  authMe: () => Response | Promise<Response>,
  options?: {
    project?: Factory | null;
    projectsReady?: Promise<void>;
    workItemCount?: number;
    workItemsReady?: Promise<void>;
    workItemsError?: boolean;
    onWorkItemsRequest?: () => void;
  },
) {
  seedFactory(options?.project);
  useAgentControllerHandlers();
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, authMe),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
    ),
  );
  if (options?.project && isServerFactory(options.project)) {
    const project = options.project;
    const factoryProjectId = project.binding.factoryProjectId;
    const workItems = Array.from({ length: options.workItemCount ?? 0 }, (_, index) => ({ id: `work-${index}` }));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, async () => {
        await options.projectsReady;
        return HttpResponse.json({ projects: [{ id: factoryProjectId, name: project.name }] });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, async () => {
        options.onWorkItemsRequest?.();
        await options.workItemsReady;
        if (options.workItemsError) return HttpResponse.json({ error: 'Factory unavailable' }, { status: 500 });
        return HttpResponse.json({ workItems });
      }),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [] }),
      ),
    );
  }

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

async function expectPathname(router: ReturnType<typeof createMemoryRouter>, pathname: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(pathname));
}

describe('MastraCode web routing', () => {
  it('given the auth check is pending, when visiting a scoped new-project route, then a skeleton renders instead of a blank screen', async () => {
    renderRoutes('/local/project-test/new', async () => {
      await delay(150);
      return new Response(null, { status: 404 });
    });

    expect(await screen.findByRole('status', { name: 'Checking sign-in' })).toBeInTheDocument();

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument();
  });

  it('given auth is disabled, when visiting a scoped new-project route, then the chat UI renders without auth affordances', async () => {
    const { router } = renderRoutes('/local/project-test/new', AUTH_DISABLED);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    await expectPathname(router, '/local/project-test/new');
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given GitHub configuration is unavailable and a local Factory exists, when visiting /, then the first local Factory opens', async () => {
    const { router } = renderRoutes('/', AUTH_DISABLED);

    await expectPathname(router, '/local/project-test/new');
    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
  });

  it('given no usable Factory exists, when visiting /, then onboarding opens', async () => {
    const { router } = renderRoutes('/', AUTH_DISABLED, { project: null });

    await expectPathname(router, '/onboarding');
    expect(await screen.findByRole('button', { name: 'Skip and setup local project' })).toBeInTheDocument();
  });

  it.each(['/local', '/dashboard'])(
    'given a project namespace has no Factory ID, when visiting %s, then the route is not found',
    async initialEntry => {
      const { router } = renderRoutes(initialEntry, AUTH_DISABLED);

      await expectPathname(router, initialEntry);
      expect(await screen.findByText('Page not found')).toBeInTheDocument();
      expect(screen.queryByText('What do you want to work on?')).not.toBeInTheDocument();
    },
  );

  it('given the Factory ID is unknown, when visiting its scoped route, then the route is not found without project data', async () => {
    const { router } = renderRoutes('/local/unknown-project/new', AUTH_DISABLED);

    await expectPathname(router, '/local/unknown-project/new');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByText('What do you want to work on?')).not.toBeInTheDocument();
  });

  it('given a local Factory ID is used in the dashboard namespace, when visiting it, then the route is not found without project data', async () => {
    const { router } = renderRoutes('/dashboard/project-test/new', AUTH_DISABLED);

    await expectPathname(router, '/dashboard/project-test/new');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByText('What do you want to work on?')).not.toBeInTheDocument();
  });

  it('given a GitHub Factory ID is used in the local namespace, when visiting it, then the route is not found without project data', async () => {
    const project: Factory = {
      id: 'github-project',
      name: 'mastra-ai/mastra',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: { kind: 'factory', factoryProjectId: 'github-project-id', repositories: [] },
    };
    const { router } = renderRoutes('/local/github-project/new', AUTH_DISABLED, { project });

    await expectPathname(router, '/local/github-project/new');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByText('What do you want to work on?')).not.toBeInTheDocument();
  });

  it('given a GitHub project has persisted Factory work, when visiting /, then the user lands on the board', async () => {
    const project: Factory = {
      id: 'github-project',
      name: 'mastra-ai/mastra',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: {
        kind: 'factory',
        factoryProjectId: 'github-project-id',
        repositories: [],
      },
    };
    const { router } = renderRoutes('/', AUTHENTICATED, { project, workItemCount: 1 });

    await expectPathname(router, '/dashboard/github-project/factory/board');
    expect(await screen.findByText(/requires a Factory connected to GitHub/)).toBeInTheDocument();
  });

  it('given Factory work is still loading, when visiting /, then the app waits before choosing a destination', async () => {
    const project: Factory = {
      id: 'github-project',
      name: 'mastra-ai/mastra',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: {
        kind: 'factory',
        factoryProjectId: 'github-project-id',
        repositories: [],
      },
    };
    let resolveWorkItems!: () => void;
    const workItemsReady = new Promise<void>(resolve => {
      resolveWorkItems = resolve;
    });
    const { router } = renderRoutes('/', AUTHENTICATED, { project, workItemCount: 1, workItemsReady });

    await screen.findByRole('status', { name: 'Loading Factory board' });
    expect(router.state.location.pathname).toBe('/');
    resolveWorkItems();
    await expectPathname(router, '/dashboard/github-project/factory/board');
  });

  it('given persisted Factory work cannot be loaded, when visiting /, then the app does not redirect', async () => {
    const project: Factory = {
      id: 'github-project',
      name: 'mastra-ai/mastra',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: {
        kind: 'factory',
        factoryProjectId: 'github-project-id',
        repositories: [],
      },
    };
    const { router } = renderRoutes('/', AUTHENTICATED, { project, workItemsError: true });

    expect(await screen.findByText('Factory unavailable')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('given a GitHub project has no persisted Factory work, when visiting /, then the scoped new-project route opens', async () => {
    const project: Factory = {
      id: 'github-project',
      name: 'mastra-ai/mastra',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: {
        kind: 'factory',
        factoryProjectId: 'github-project-id',
        repositories: [],
      },
    };
    const { router } = renderRoutes('/', AUTHENTICATED, { project });

    await expectPathname(router, '/dashboard/github-project/new');
    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
  });

  it('given auth is disabled, when visiting an unknown path, then the route is not found', async () => {
    const { router } = renderRoutes('/does-not-exist', AUTH_DISABLED);

    await expectPathname(router, '/does-not-exist');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('given auth is enabled and the session is unauthenticated, when visiting a scoped new-project route, then the user lands on /signin with a sign-in action', async () => {
    const { router } = renderRoutes('/local/project-test/new', UNAUTHENTICATED);

    await expectPathname(router, '/signin');
    expect(router.state.location.search).toBe('?returnTo=%2Flocal%2Fproject-test%2Fnew');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('What do you want to work on?')).not.toBeInTheDocument();
  });

  it('given an unauthenticated user on /signin with a returnTo, when they click Sign in, then they are sent to the hosted login with that returnTo', async () => {
    renderRoutes('/signin?returnTo=%2Fchat', UNAUTHENTICATED);

    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));

    expect(redirectToLogin).toHaveBeenCalledWith(TEST_BASE_URL, '/chat');
    expect(loginUrl(TEST_BASE_URL, '/chat')).toBe(`${TEST_BASE_URL}/auth/login?returnTo=%2Fchat`);
  });

  it('given an unauthenticated user on /signin with an unsafe returnTo, when they click Sign in, then it falls back to the app root', async () => {
    renderRoutes('/signin?returnTo=https%3A%2F%2Fevil.example', UNAUTHENTICATED);

    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));

    expect(redirectToLogin).toHaveBeenCalledWith(TEST_BASE_URL, '/');
  });

  it('given auth is enabled and the session is authenticated, when visiting a scoped new-project route, then chat renders with identity and sign-out only', async () => {
    const { router } = renderRoutes('/local/project-test/new', AUTHENTICATED);

    await expectPathname(router, '/local/project-test/new');
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('given an authenticated session, when visiting /signin, then the user is redirected through the root landing', async () => {
    const { router } = renderRoutes('/signin', AUTHENTICATED);

    await expectPathname(router, '/local/project-test/new');
  });

  it('given an authenticated session and a safe returnTo, when visiting /signin, then the explicit destination wins', async () => {
    const { router } = renderRoutes('/signin?returnTo=%2Ffactory%2Fmetrics', AUTHENTICATED);

    await expectPathname(router, '/factory/metrics');
  });

  it('given an authenticated session and an unsafe returnTo, when visiting /signin, then it falls back through root landing', async () => {
    const { router } = renderRoutes('/signin?returnTo=https%3A%2F%2Fevil.example', AUTHENTICATED);

    await expectPathname(router, '/local/project-test/new');
  });

  it('given auth is disabled, when visiting /signin, then the user is redirected to the scoped new-project route', async () => {
    const { router } = renderRoutes('/signin', AUTH_DISABLED);

    await expectPathname(router, '/local/project-test/new');
  });
});
