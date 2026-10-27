import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_ID = 'factory-private-session';
const SESSION_ID = 'eea49479-9999-421d-9243-82a80c5eac09';
const AGENT_CONTROLLER_API = `${TEST_BASE_URL}/api/agent-controller/code`;

type SessionAnswer = 'not-found' | 'server-error';

function stubSessionRoute(answer: SessionAnswer) {
  const route = { reads: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({
        project: { id: FACTORY_ID, name: 'Acme Factory', defaultModelId: 'openai/gpt-4o-mini' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    // The server answers a teammate's private session exactly like a missing one.
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () => {
      route.reads += 1;
      if (answer === 'not-found') return HttpResponse.json({ error: 'Session not found' }, { status: 404 });
      return HttpResponse.json({ error: 'boom' }, { status: 500 });
    }),
    // The chat shell asks for permissions before the session read settles.
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ error: 'Session not found' }, { status: 404 }),
    ),
  );
  return route;
}

function openSession() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('opening a session the viewer cannot see', () => {
  it('shows a not-found page after a single read of the session', async () => {
    const route = stubSessionRoute('not-found');
    openSession();

    expect(await screen.findByRole('heading', { name: 'Session not found' })).toBeInTheDocument();
    expect(screen.getByText(/private to another user/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    // Before the fix the page re-read the session hundreds of times a second.
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(route.reads).toBe(1);
  });

  it('starts a new private session draft, like the sidebar New session button', async () => {
    stubSessionRoute('not-found');
    const router = openSession();

    await userEvent.click(await screen.findByRole('button', { name: 'Start a new session' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(new RegExp(`^/factories/${FACTORY_ID}/user/new/[0-9a-f-]{36}$`)),
    );
  });

  it('explains other failures and offers only a retry', async () => {
    const route = stubSessionRoute('server-error');
    openSession();

    expect(await screen.findByRole('heading', { name: 'Could not load this session' })).toBeInTheDocument();
    expect(screen.getByText(/Failed to load the session/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start a new session' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(route.reads).toBe(2));
  });
});
