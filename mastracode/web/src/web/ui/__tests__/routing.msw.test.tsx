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
import type { Project } from '../domains/workspaces';
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

function seedProject() {
  const project: Project = {
    id: 'project-test',
    name: 'MastraCode Test',
    path: '/tmp/mastracode-test',
    resourceId: RESOURCE_ID,
    createdAt: 1,
  };
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
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

function renderRoutes(initialEntry: string, authMe: () => Response | Promise<Response>) {
  seedProject();
  useAgentControllerHandlers();
  server.use(http.get(`${TEST_BASE_URL}/auth/me`, authMe));

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

async function expectPathname(router: ReturnType<typeof createMemoryRouter>, pathname: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(pathname));
}

describe('MastraCode web routing', () => {
  it('given the auth check is pending, when visiting /new, then the startup HUD renders instead of a blank screen', async () => {
    renderRoutes('/new', async () => {
      await delay(150);
      return new Response(null, { status: 404 });
    });

    expect(await screen.findByRole('status', { name: 'Checking sign-in' })).toBeInTheDocument();
    expect(screen.getByText('Opening your workspace')).toBeInTheDocument();

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument();
  });

  it('given auth is disabled, when visiting /new, then the chat UI renders without auth affordances', async () => {
    const { router } = renderRoutes('/new', AUTH_DISABLED);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    await expectPathname(router, '/new');
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given auth is disabled, when visiting /, then the user is redirected to /new', async () => {
    const { router } = renderRoutes('/', AUTH_DISABLED);

    await expectPathname(router, '/new');
    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
  });

  it('given auth is disabled, when visiting an unknown path, then the user is redirected to /new', async () => {
    const { router } = renderRoutes('/does-not-exist', AUTH_DISABLED);

    await expectPathname(router, '/new');
  });

  it('given auth is enabled and the session is unauthenticated, when visiting /new, then the user lands on /signin with a sign-in action', async () => {
    const { router } = renderRoutes('/new', UNAUTHENTICATED);

    await expectPathname(router, '/signin');
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

  it('given auth is enabled and the session is authenticated, when visiting /new, then chat renders with identity and sign-out only', async () => {
    const { router } = renderRoutes('/new', AUTHENTICATED);

    await expectPathname(router, '/new');
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('given an authenticated session, when visiting /signin, then the user is redirected to /new', async () => {
    const { router } = renderRoutes('/signin', AUTHENTICATED);

    await expectPathname(router, '/new');
  });

  it('given auth is disabled, when visiting /signin, then the user is redirected to /new', async () => {
    const { router } = renderRoutes('/signin', AUTH_DISABLED);

    await expectPathname(router, '/new');
  });
});
