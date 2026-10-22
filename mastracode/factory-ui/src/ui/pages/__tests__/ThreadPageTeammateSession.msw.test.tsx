import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { createSignal } from '@mastra/core/signals';
import type { ModelCatalogEntry } from '@mastra/factory/routes/config';
import { SESSION_OWNER_SIGNAL_TAG } from '@mastra/factory/session-owner-signal';
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

function takeoverSignal(name: string): MastraDBMessage {
  return createSignal({
    type: 'reactive',
    tagName: SESSION_OWNER_SIGNAL_TAG,
    contents: `${name} took ownership`,
  }).toDBMessage({ threadId: SESSION_ID, resourceId: SESSION_ID });
}

const openAIKeyModel: ModelCatalogEntry = {
  id: 'openai/gpt-4o-mini',
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  hasApiKey: true,
  credentialLabel: 'OpenAI API key',
  credentialHolder: 'personal',
};

function serveModelCatalogs({
  sessionScope,
  viewerModels,
}: {
  sessionScope: 'factory' | 'user';
  viewerModels: ModelCatalogEntry[];
}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.get('scope') === 'user') return HttpResponse.json({ models: viewerModels });
      return HttpResponse.json({ modelScope: sessionScope, defaultModelId: null, models: [openAIKeyModel] });
    }),
  );
}

async function openTakeoverDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Take ownership' }));
  return screen.findByRole('alertdialog', { name: 'Take Ward Peeters’s session?' });
}

async function confirmTakeover(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await openTakeoverDialog(user);
  await user.click(within(dialog).getByRole('button', { name: 'Take ownership' }));
}

function openWardSessionAs(
  viewerUserId: string,
  {
    session = wardSession,
    path = USER_THREAD_PATH,
    threadMessages = [],
    agentRunning = false,
  }: {
    session?: typeof wardSession | typeof wardSessionWithoutProfile;
    path?: string;
    threadMessages?: MastraDBMessage[];
    agentRunning?: boolean;
  } = {},
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
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              if (agentRunning) controller.enqueue(new TextEncoder().encode('data: {"type":"agent_start"}\n\n'));
            },
            cancel() {},
          }),
          {
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () =>
      HttpResponse.json({ messages: threadMessages }),
    ),
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
    it('asks first, then moves the session to the viewer and marks the takeover in the thread', async () => {
      const session = { ...wardSession };
      const threadMessages: MastraDBMessage[] = [];
      const transfers: unknown[] = [];
      server.use(
        http.post(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}/owner`, async ({ request }) => {
          transfers.push(await request.json());
          Object.assign(session, { userId: 'user-damien', owner: { id: 'user-damien', name: 'Damien' } });
          threadMessages.push(takeoverSignal('Damien'));
          return HttpResponse.json({ session });
        }),
      );
      const client = openWardSessionAs('user-damien', { session, threadMessages });

      await confirmTakeover(userEvent.setup());
      await waitForMutationsIdle(client);

      expect(transfers).toEqual([{ expectedOwnerId: 'user-ward' }]);
      await waitFor(() => expect(screen.queryByText(/You’re steering/)).not.toBeInTheDocument());
      expect(await screen.findByRole('separator', { name: 'Damien took ownership' })).toBeInTheDocument();
    });

    it('sends nothing when the viewer cancels', async () => {
      const transfers: unknown[] = [];
      server.use(
        http.post(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}/owner`, async ({ request }) => {
          transfers.push(await request.json());
          return HttpResponse.json({ session: wardSession });
        }),
      );
      openWardSessionAs('user-damien');
      const user = userEvent.setup();

      const dialog = await openTakeoverDialog(user);
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.getByText('You’re steering Ward Peeters’s session')).toBeInTheDocument();
      expect(transfers).toEqual([]);
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

      await confirmTakeover(userEvent.setup());
      await waitForMutationsIdle(client);

      expect(await screen.findByText('You’re steering Caleb’s session')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Take ownership' })).toBeEnabled();
    });
  });

  describe('before a teammate confirms the takeover', () => {
    it('says the Factory keeps paying when it pays for its sessions', async () => {
      serveModelCatalogs({ sessionScope: 'factory', viewerModels: [] });
      openWardSessionAs('user-damien');

      const dialog = await openTakeoverDialog(userEvent.setup());

      expect(
        await within(dialog).findByText('The Factory keeps paying, and the model stays the same.'),
      ).toBeInTheDocument();
      expect(within(dialog).queryByText(/cached/)).not.toBeInTheDocument();
    });

    it('names the viewer’s own credential and the model the session keeps when each owner pays', async () => {
      serveModelCatalogs({ sessionScope: 'user', viewerModels: [openAIKeyModel] });
      openWardSessionAs('user-damien');

      const dialog = await openTakeoverDialog(userEvent.setup());

      expect(
        await within(dialog).findByText(
          'Your OpenAI API key pays from your next message, on the same GPT-4o Mini. This session is cached on Ward Peeters’s account, so that reply re-reads all of it and costs more.',
        ),
      ).toBeInTheDocument();
    });

    it('asks the viewer to connect the session’s provider first when they have none', async () => {
      serveModelCatalogs({ sessionScope: 'user', viewerModels: [] });
      openWardSessionAs('user-damien');

      const dialog = await openTakeoverDialog(userEvent.setup());

      expect(
        await within(dialog).findByText(/You have no OpenAI connection, so GPT-4o Mini can’t run for you\./),
      ).toBeInTheDocument();
      expect(within(dialog).getByRole('link', { name: 'Your models' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/settings/personal-models`,
      );
      expect(within(dialog).getByRole('button', { name: 'Take ownership' })).toBeEnabled();
    });

    it('says the running agent stops only while one is running', async () => {
      openWardSessionAs('user-damien', { agentRunning: true });

      const dialog = await openTakeoverDialog(userEvent.setup());

      expect(await within(dialog).findByText(/The running agent stops\./)).toBeInTheDocument();
    });

    it('says nothing about stopping an agent when none is running', async () => {
      openWardSessionAs('user-damien');

      const dialog = await openTakeoverDialog(userEvent.setup());

      expect(within(dialog).queryByText(/The running agent stops/)).not.toBeInTheDocument();
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
