import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-ward';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const wardSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-ward',
  owner: { id: 'user-ward', name: 'Ward Peeters' },
  visibility: 'org',
  title: 'Checkout e2e test flakes on CI',
  branch: `user/session-${SESSION_ID}`,
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/local/acme/app',
  materializedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  capabilities: { recreateSandbox: false, takeOwnership: true },
};

const wardSessionWithoutProfile = { ...wardSession, owner: undefined };
const USER_THREAD_PATH = `/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`;
const BOARD_THREAD_PATH = `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/thread-review-1`;

function openWardSessionAs(
  viewerUserId: string,
  {
    session = wardSession,
    path = USER_THREAD_PATH,
  }: { session?: typeof wardSession | typeof wardSessionWithoutProfile; path?: string } = {},
) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: viewerUserId } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/local/acme/app',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [session] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () => HttpResponse.json({ session })),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
  );
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  return renderWithProviders(<RouterProvider router={router} />).client;
}

describe("a teammate's Factory session", () => {
  describe('when a teammate opens it', () => {
    it('names the owner inside the composer region', async () => {
      openWardSessionAs('user-damien');

      const composer = await screen.findByRole('region', { name: 'Thread composer' });
      expect(await within(composer).findByText('You’re steering Ward Peeters’s session')).toBeInTheDocument();
    });

    it('names the owner on a Work or Review board thread too', async () => {
      openWardSessionAs('user-damien', { path: BOARD_THREAD_PATH });

      expect(await screen.findByText('You’re steering Ward Peeters’s session')).toBeInTheDocument();
    });

    it('says "a teammate" when the owner has no profile, never the raw user id', async () => {
      openWardSessionAs('user-damien', { session: wardSessionWithoutProfile });

      expect(await screen.findByText('You’re steering a teammate’s session')).toBeInTheDocument();
      expect(screen.queryByText(/user-ward/)).not.toBeInTheDocument();
    });

    it('offers no takeover of a Slack thread, which the server keeps with its owner', async () => {
      openWardSessionAs('user-damien', {
        session: {
          ...wardSession,
          branch: 'slack/C123-1700000000.000100',
          capabilities: { recreateSandbox: false, takeOwnership: false },
        },
      });

      expect(await screen.findByText('You’re steering Ward Peeters’s session')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Take ownership' })).not.toBeInTheDocument();
    });
  });

  describe('when a teammate takes ownership', () => {
    it('moves the session to the viewer and drops the steering line', async () => {
      const session = { ...wardSession };
      const transfers: unknown[] = [];
      server.use(
        http.post(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}/owner`, async ({ request }) => {
          transfers.push(await request.json());
          Object.assign(session, { userId: 'user-damien', owner: { id: 'user-damien', name: 'Damien' } });
          return HttpResponse.json({ session });
        }),
      );
      const client = openWardSessionAs('user-damien', { session });

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Take ownership' }));
      await waitForMutationsIdle(client);

      expect(transfers).toEqual([{ expectedOwnerId: 'user-ward' }]);
      await waitFor(() => expect(screen.queryByText(/You’re steering/)).not.toBeInTheDocument());
    });

    it('names the new owner when someone else took it first', async () => {
      const session = { ...wardSession };
      server.use(
        http.post(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}/owner`, () => {
          Object.assign(session, { userId: 'user-caleb', owner: { id: 'user-caleb', name: 'Caleb' } });
          return HttpResponse.json(
            { error: 'Someone else owns this session now', reason: 'stale_owner', currentOwnerId: 'user-caleb' },
            { status: 409 },
          );
        }),
      );
      const client = openWardSessionAs('user-damien', { session });

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Take ownership' }));
      await waitForMutationsIdle(client);

      expect(await screen.findByText('You’re steering Caleb’s session')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Take ownership' })).toBeEnabled();
    });
  });

  describe('when the owner opens it', () => {
    it('shows no steering line', async () => {
      const client = openWardSessionAs('user-ward');

      await screen.findByRole('region', { name: 'Thread composer' });
      await waitForMutationsIdle(client);
      expect(screen.queryByText(/You’re steering/)).not.toBeInTheDocument();
    });
  });
});
