/**
 * BDD coverage for the SPA route table (`src/web/ui/router.tsx`).
 *
 * Drives the real route components (auth-guard layout + redirects, powered by
 * the `useFactoryAuth` React Query hook) through a memory router with MSW stubbing
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

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(redirectToLogin).mockClear();
});

function seedFactories(projects?: Factory[]) {
  const selectedProjects: Factory[] = projects ?? [
    {
      id: 'project-test',
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
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
    ),
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
    project?: Factory;
    projects?: Factory[];
    withFactory?: boolean;
  },
) {
  if (options?.withFactory !== false) {
    const projects = options?.projects ?? (options?.project ? [options.project] : undefined);
    seedFactories(projects);
  }
  useAgentControllerHandlers();
  server.use(http.get(`${TEST_BASE_URL}/auth/me`, authMe));
  if (options?.project?.binding.kind === 'factory') {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${options.project.binding.factoryProjectId}/work-items`, () =>
        HttpResponse.json({ workItems: [] }),
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
  it('given the auth check is pending, when visiting the draft composer, then a skeleton renders instead of a blank screen', async () => {
    renderRoutes('/factories/project-test/new', async () => {
      await delay(150);
      return new Response(null, { status: 404 });
    });

    expect(await screen.findByRole('status', { name: 'Checking sign-in' })).toBeInTheDocument();

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument();
  });

  it('given the auth server is unavailable, when visiting /new, then the app does not redirect to sign in', async () => {
    const { router } = renderRoutes('/new', () => new Response(null, { status: 500 }));

    expect(await screen.findByRole('status', { name: 'Unable to reach MastraCode server' })).toBeInTheDocument();
    await expectPathname(router, '/new');
    expect(screen.queryByRole('button', { name: 'Continue with GitHub' })).not.toBeInTheDocument();
  });

  it('given auth is disabled, when visiting the draft composer, then the chat UI renders without auth affordances', async () => {
    const { router } = renderRoutes('/factories/project-test/new', AUTH_DISABLED);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    await expectPathname(router, '/factories/project-test/new');
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given no factory, when visiting /new, then the Factory onboarding is shown', async () => {
    renderRoutes('/new', AUTH_DISABLED, { withFactory: false });

    expect(
      await screen.findByRole('heading', { name: 'Build software with a Factory that knows your work.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my first factory' })).toBeInTheDocument();
  });

  it('given no factory, when onboarding starts, then repository selection replaces the introduction', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
      ),
    );
    const user = userEvent.setup();
    renderRoutes('/new', AUTH_DISABLED, { withFactory: false });

    await user.click(await screen.findByRole('button', { name: 'Create my first factory' }));

    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
    expect(screen.queryByText('Build software with a Factory that knows your work.')).not.toBeInTheDocument();
  });

  it('given auth is disabled and a factory exists, when visiting /factories/create, then the full-screen wizard renders without the app shell', async () => {
    const { router } = renderRoutes('/factories/create', AUTH_DISABLED);

    expect(await screen.findByRole('heading', { name: 'Name your new Factory.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factories/create');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select factory' })).not.toBeInTheDocument();
  });

  it('given a create flow is mid-way, when an OAuth callback lands on /, then the wizard resumes with the search intact', async () => {
    sessionStorage.setItem('mastracode.factory-create.step', 'vcs');
    sessionStorage.setItem('mastracode.factory-create.factory-id', 'project-test');
    const { router } = renderRoutes('/?github=connected', AUTH_DISABLED);

    await expectPathname(router, '/factories/create');
    await waitFor(() => expect(router.state.location.search).toBe('?github=connected'));
  });

  it('given auth is disabled, when visiting /, then the user lands on the first factory draft composer', async () => {
    const { router } = renderRoutes('/', AUTH_DISABLED);

    await expectPathname(router, '/factories/project-test/new');
    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
  });

  it('given a server-backed Factory, when visiting /, then the user lands on Work', async () => {
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

    await expectPathname(router, '/factories/github-project/work');
    expect(await screen.findByText(/Connect a repository to start intake/)).toBeInTheDocument();
  });

  it('given Factory hydration is still loading, when refreshing /, then the app waits before choosing a destination', async () => {
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
    const { router } = renderRoutes('/', AUTHENTICATED, { project });

    await screen.findByRole('status', { name: 'Loading factories' });
    expect(router.state.location.pathname).toBe('/');
    resolveProjects();
    await expectPathname(router, '/factories/github-project/work');
  });

  it('given a server-backed Factory, when visiting a legacy path, then the user is redirected to Work', async () => {
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
    const { router } = renderRoutes('/new', AUTHENTICATED, { project });

    await expectPathname(router, '/factories/github-project/work');
    expect(await screen.findByText(/Connect a repository to start intake/)).toBeInTheDocument();
  });

  it('given auth is disabled, when visiting an unknown path, then the user lands on the first factory', async () => {
    const { router } = renderRoutes('/does-not-exist', AUTH_DISABLED);

    await expectPathname(router, '/factories/project-test/new');
  });

  it('given a legacy /factory/work URL, when visiting it, then the catch-all lands on the first factory', async () => {
    const { router } = renderRoutes('/factory/work', AUTH_DISABLED);

    await expectPathname(router, '/factories/project-test/new');
  });

  it('given an unknown factoryId, when the factories list resolves, then the user is bounced to / with a notice', async () => {
    const { router } = renderRoutes('/factories/does-not-exist/new', AUTH_DISABLED);

    await expectPathname(router, '/factories/project-test/new');
    expect(router.state.location.state?.routeErrorNotice).toBe('Factory not found');
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

  it('given auth is enabled and the session is authenticated, when visiting the draft composer, then chat renders with identity and sign-out only', async () => {
    const { router } = renderRoutes('/factories/project-test/new', AUTHENTICATED);

    await expectPathname(router, '/factories/project-test/new');
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('given an authenticated session, when visiting /signin, then the user is redirected through the root landing', async () => {
    const { router } = renderRoutes('/signin', AUTHENTICATED);

    await expectPathname(router, '/factories/project-test/new');
  });

  it('given an authenticated session and a safe returnTo, when visiting /signin, then the explicit destination wins', async () => {
    const { router } = renderRoutes('/signin?returnTo=%2Ffactories%2Fproject-test%2Fmetrics', AUTHENTICATED);

    await expectPathname(router, '/factories/project-test/metrics');
  });

  it('given an authenticated session and an unsafe returnTo, when visiting /signin, then it falls back through root landing', async () => {
    const { router } = renderRoutes('/signin?returnTo=https%3A%2F%2Fevil.example', AUTHENTICATED);

    await expectPathname(router, '/factories/project-test/new');
  });

  it('given auth is disabled, when visiting /signin, then the user is redirected through the root landing', async () => {
    const { router } = renderRoutes('/signin', AUTH_DISABLED);

    await expectPathname(router, '/factories/project-test/new');
  });

  describe('settings routes', () => {
    function useSettingsHandlers() {
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/model-packs`, () => HttpResponse.json({ packs: [], activePackId: null })),
        http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
          HttpResponse.json({
            config: { github: { enabled: true, repositoryIds: [] }, linear: { enabled: false, projectIds: [] } },
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
          HttpResponse.json({ enabled: false, connected: false, workspace: null }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: [] })),
      );
    }

    // The page remounts once factory hydration lands (full-bleed → framed
    // layout), so headings are re-queried inside waitFor instead of captured
    // once with findByRole.
    async function expectSectionHeading(name: string) {
      await waitFor(() => expect(screen.getByRole('heading', { name })).toBeInTheDocument());
    }

    it('given the app, when visiting /settings, then the user is redirected to /settings/general', async () => {
      useSettingsHandlers();
      const { router } = renderRoutes('/settings', AUTH_DISABLED);

      await expectPathname(router, '/settings/general');
      await expectSectionHeading('General');
    });

    it('given a deep link to /settings/providers, then the API Keys section renders', async () => {
      useSettingsHandlers();
      const { router } = renderRoutes('/settings/providers', AUTH_DISABLED);

      await expectPathname(router, '/settings/providers');
      await expectSectionHeading('API Keys');
    });

    it('given an unknown settings section, then the user is redirected to /settings/general', async () => {
      useSettingsHandlers();
      const { router } = renderRoutes('/settings/nope', AUTH_DISABLED);

      await expectPathname(router, '/settings/general');
      await expectSectionHeading('General');
    });
  });
});
