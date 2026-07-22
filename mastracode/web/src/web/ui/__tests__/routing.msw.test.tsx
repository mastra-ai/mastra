/**
 * BDD coverage for the SPA route table (`src/web/ui/router.tsx`).
 *
 * Drives the real route components (auth-guard layout + redirects, powered by
 * the `useWebAuth` React Query hook) through a memory router with MSW stubbing
 * `/auth/me` and the agent-controller API, mirroring how the browser entry
 * wires `createBrowserRouter`.
 *
 * The active factory is resolved from the `/factories/:factoryId` URL param;
 * legacy pre-param paths (`/new`, `/threads/:id`, `/factory/*`) redirect to the
 * first factory.
 */
import type { AgentControllerSessionState } from '@mastra/client-js';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { loginUrl, redirectToLogin } from '../domains/auth';
import type * as AuthService from '../domains/auth/services/auth';
import type { Factory } from '../domains/workspaces';
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
const LOCAL_FACTORY_ID = 'project-test';

afterEach(() => {
  localStorage.clear();
  vi.mocked(redirectToLogin).mockClear();
});

function seedFactories(projects?: Factory[]) {
  const selectedProjects: Factory[] = projects ?? [
    {
      id: LOCAL_FACTORY_ID,
      name: 'MastraCode Test',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: {
        kind: 'local',
        path: '/tmp/mastracode-test',
      },
    },
  ];
  localStorage.setItem('mastracode-factories', JSON.stringify(selectedProjects));
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

const GITHUB_PROJECT: Factory = {
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

function renderRoutes(
  initialEntry: string,
  authMe: () => Response | Promise<Response>,
  options?: {
    project?: Factory;
    projects?: Factory[];
    withFactory?: boolean;
    workItemCount?: number;
  },
) {
  if (options?.withFactory !== false) {
    const projects = options?.projects ?? (options?.project ? [options.project] : undefined);
    seedFactories(projects);
  }
  useAgentControllerHandlers();
  server.use(http.get(`${TEST_BASE_URL}/auth/me`, authMe));
  if (options?.project?.binding.kind === 'factory') {
    const workItems = Array.from({ length: options.workItemCount ?? 0 }, (_, index) => ({ id: `work-${index}` }));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${options.project.binding.factoryProjectId}/work-items`, () =>
        HttpResponse.json({ workItems }),
      ),
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
  it('given the auth check is pending, when visiting /new, then a skeleton renders instead of a blank screen', async () => {
    renderRoutes('/new', async () => {
      await delay(150);
      return new Response(null, { status: 404 });
    });

    expect(await screen.findByRole('status', { name: 'Checking sign-in' })).toBeInTheDocument();

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument();
  });

  it('given auth is disabled, when visiting legacy /new, then it redirects to the first factory and chat renders', async () => {
    const { router } = renderRoutes('/new', AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given no factory, when visiting /new, then the first-run onboarding screen is shown', async () => {
    const { router } = renderRoutes('/new', AUTH_DISABLED, { withFactory: false });

    await expectPathname(router, '/onboarding');
    expect(
      await screen.findByRole('heading', { name: 'Build software with a Factory that knows your work.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my first factory' })).toBeInTheDocument();
  });

  it('given no factory, when continuing from the onboarding intro, then the repository step replaces it', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [] }),
      ),
    );
    renderRoutes('/new', AUTH_DISABLED, { withFactory: false });

    await user.click(await screen.findByRole('button', { name: 'Create my first factory' }));

    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
    const repoSection = await screen.findByRole('region', { name: 'GitHub repository' });
    expect(within(repoSection).getByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
    expect(screen.queryByText('Build software with a Factory that knows your work.')).not.toBeInTheDocument();
  });

  it('given auth is disabled, when visiting /, then the user is redirected to the factory draft composer', async () => {
    const { router } = renderRoutes('/', AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
  });

  it('given a GitHub-backed factory, when visiting /, then the user lands on its work board', async () => {
    const { router } = renderRoutes('/', AUTHENTICATED, { project: GITHUB_PROJECT, workItemCount: 1 });

    await expectPathname(router, '/factories/github-project/work');
    expect(await screen.findByText(/Connect a repository to start intake/)).toBeInTheDocument();
  });

  it('given Factory hydration is still loading, when refreshing /, then the app waits before choosing a destination', async () => {
    let resolveProjects!: () => void;
    const projectsReady = new Promise<void>(resolve => {
      resolveProjects = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, async () => {
        await projectsReady;
        return HttpResponse.json({ projects: [{ id: 'github-project-id', name: 'mastra-ai/mastra' }] });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/github-project-id/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
    );
    const { router } = renderRoutes('/', AUTHENTICATED, { project: GITHUB_PROJECT, workItemCount: 1 });

    expect(router.state.location.pathname).toBe('/');
    resolveProjects();
    await expectPathname(router, '/factories/github-project/work');
  });

  it('given legacy /factory/board, then the user is redirected to the first factory work board', async () => {
    const { router } = renderRoutes('/factory/board', AUTHENTICATED, { project: GITHUB_PROJECT });

    await expectPathname(router, '/factories/github-project/work');
  });

  it('given legacy /factory/metrics, then the sub-page is preserved on the first factory', async () => {
    const { router } = renderRoutes('/factory/metrics', AUTHENTICATED, { project: GITHUB_PROJECT });

    await expectPathname(router, '/factories/github-project/metrics');
  });

  it('given a legacy thread URL, then it redirects to the factory-scoped thread', async () => {
    const { router } = renderRoutes(`/threads/${THREAD_ID}`, AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/threads/${THREAD_ID}`);
  });

  it('given a legacy user thread URL, then it redirects to the factory-scoped user thread', async () => {
    const { router } = renderRoutes(`/user/threads/${THREAD_ID}`, AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/user/threads/${THREAD_ID}`);
  });

  it('given an unknown :factoryId, then the user is bounced through / to a valid factory', async () => {
    const { router } = renderRoutes('/factories/does-not-exist/work', AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
  });

  it('given auth is disabled, when visiting an unknown path, then the user is redirected to the factory draft composer', async () => {
    const { router } = renderRoutes('/does-not-exist', AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
  });

  it('given auth is enabled and the session is unauthenticated, when visiting /new, then the user lands on /signin with a sign-in action', async () => {
    const { router } = renderRoutes('/new', UNAUTHENTICATED);

    await expectPathname(router, '/signin');
    expect(router.state.location.search).toBe('?returnTo=%2Fnew');
    expect(await screen.findByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.queryByText('What do you want to work on?')).not.toBeInTheDocument();
  });

  it('given an unauthenticated user on /signin with a returnTo, when they click Sign in, then they are sent to the hosted login with that returnTo', async () => {
    renderRoutes('/signin?returnTo=%2Fchat', UNAUTHENTICATED);

    await userEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));

    expect(redirectToLogin).toHaveBeenCalledWith(TEST_BASE_URL, '/chat');
    expect(loginUrl(TEST_BASE_URL, '/chat')).toBe(`${TEST_BASE_URL}/auth/login?returnTo=%2Fchat`);
  });

  it('given an unauthenticated user on /signin with an unsafe returnTo, when they click Sign in, then it falls back to the app root', async () => {
    renderRoutes('/signin?returnTo=https%3A%2F%2Fevil.example', UNAUTHENTICATED);

    await userEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));

    expect(redirectToLogin).toHaveBeenCalledWith(TEST_BASE_URL, '/');
  });

  it('given auth is enabled and the session is authenticated, when visiting /new, then chat renders with identity and sign-out only', async () => {
    const { router } = renderRoutes('/new', AUTHENTICATED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('given an authenticated session, when visiting /signin, then the user is redirected through the root landing', async () => {
    const { router } = renderRoutes('/signin', AUTHENTICATED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
  });

  it('given an authenticated session and a safe returnTo, when visiting /signin, then the explicit destination wins', async () => {
    const { router } = renderRoutes('/signin?returnTo=%2Ffactory%2Fmetrics', AUTHENTICATED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/metrics`);
  });

  it('given an authenticated session and an unsafe returnTo, when visiting /signin, then it falls back through root landing', async () => {
    const { router } = renderRoutes('/signin?returnTo=https%3A%2F%2Fevil.example', AUTHENTICATED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
  });

  it('given auth is disabled, when visiting /signin, then the user is redirected to the factory draft composer', async () => {
    const { router } = renderRoutes('/signin', AUTH_DISABLED);

    await expectPathname(router, `/factories/${LOCAL_FACTORY_ID}/new`);
  });
});
