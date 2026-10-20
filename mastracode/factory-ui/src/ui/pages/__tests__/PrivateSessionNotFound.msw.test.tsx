import { screen } from '@testing-library/react';
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

function stubTeammatePrivateSession() {
  const sessionReads: string[] = [];
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
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json({ modelId: null })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    // The server answers a teammate's private session exactly like a missing one.
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      sessionReads.push(String(params.sessionId));
      return HttpResponse.json({ error: 'Session not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ error: 'Session not found' }, { status: 404 }),
    ),
  );
  return { sessionReads };
}

describe('opening a session the viewer cannot see', () => {
  it('shows a not-found page and stops asking the server for the session', async () => {
    const { sessionReads } = stubTeammatePrivateSession();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Session not found' })).toBeInTheDocument();
    expect(screen.getByText(/private to another user/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a new session' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/new`,
    );
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument();
    const readsWhenShown = sessionReads.length;
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(sessionReads.length).toBe(readsWhenShown);
    expect(readsWhenShown).toBeLessThanOrEqual(1);
  });
});
