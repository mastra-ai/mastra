/**
 * BDD coverage for writing to a session that is still coming online. Opening a
 * fresh user session provisions a sandbox and clones the repository behind the
 * agent-controller session create, which used to leave the composer dead for
 * the whole wait.
 */
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import { useThreadPageKickoffs } from '../../hooks/useThreadPageKickoffs';
import { Composer } from '../Composer';
import { Transcript } from '../Transcript';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const FACTORY_ID = 'fp-preparing';
const PROJECT_REPOSITORY_ID = 'repo-preparing';
// A user session addresses the controller by its own id, thread included.
const SESSION_ID = 'sess-preparing';

interface PreparingSession {
  /** Lets the agent-controller session create finish, as a sandbox would. */
  finishWorkspace: () => void;
  sentMessages: string[];
}

/** The controller sends `{ message }`; anything else means the wire shape moved. */
function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  if ('message' in body && typeof body.message === 'string') return body.message;
  return '';
}

/**
 * Network boundary for a user session whose workspace was never materialized:
 * everything answers except the session create, which hangs until released.
 */
function stubPreparingSession(): PreparingSession {
  let release = () => {};
  const workspaceReady = new Promise<void>(resolve => {
    release = resolve;
  });
  const sentMessages: string[] = [];

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { userId: 'user-1', email: 'user@example.com' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Preparing' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: PROJECT_REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/preparing',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
      HttpResponse.json({
        session: {
          id: 'row-1',
          sessionId: SESSION_ID,
          projectRepositoryId: PROJECT_REPOSITORY_ID,
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'user/session-1',
          baseBranch: 'main',
          sandboxId: null,
          sandboxWorkdir: null,
          materializedAt: null,
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/ensure`, () =>
      HttpResponse.json({ resourceId: SESSION_ID, sandboxId: null, sandboxWorkdir: '/workspace/preparing' }),
    ),
    http.post(`${API}/sessions`, async () => {
      await workspaceReady;
      return HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true, useCount: 1 },
        ],
      }),
    ),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: { read: 'ask' }, tools: {} }),
    ),
    http.get(`${API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(
      `${API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
    http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
      sentMessages.push(readSentMessage(await request.json()));
      return HttpResponse.json({ ok: true });
    }),
  );

  return { finishWorkspace: release, sentMessages };
}

/** A create left hanging outlives the test, so tests that never wait for the session end here. */
async function releaseSession(finishWorkspace: () => void) {
  finishWorkspace();
  await waitFor(() => expect(screen.queryByText('Preparing workspace…')).not.toBeInTheDocument());
}

/** The thread page mounts the kickoff dispatcher; mirror that wiring here. */
function ThreadSurface() {
  useThreadPageKickoffs();
  return (
    <>
      <Transcript />
      <Composer />
    </>
  );
}

function renderThread() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <MainSidebarProvider storageKey="preparing-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <ThreadSurface />
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </MainSidebarProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Composer while a session prepares its workspace', () => {
  it('takes the first message, shows it, and sends it once the session is online', async () => {
    const { finishWorkspace, sentMessages } = stubPreparingSession();
    const user = userEvent.setup();

    renderThread();

    // Nodes are re-queried on every check: the transcript subtree remounts as
    // the message window settles, detaching anything held from an earlier read.
    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());
    expect(sentMessages).toEqual([]);

    finishWorkspace();

    await waitFor(() => expect(sentMessages).toEqual(['fix the login bug']));
    // The queued message was shown when it was typed, not echoed again on dispatch.
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
  });

  it('refuses an image dropped while preparing, since a queued message carries text only', async () => {
    const { finishWorkspace, sentMessages } = stubPreparingSession();

    const { container } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    const form = container.querySelector('form');
    assert(form);
    fireEvent.drop(form, { dataTransfer: { files: [new File(['png'], 'shot.png', { type: 'image/png' })] } });

    await waitFor(() =>
      expect(screen.getByText('Images can be attached once the session is ready.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
    expect(sentMessages).toEqual([]);

    await releaseSession(finishWorkspace);
  });

  it('keeps a slash command in the composer, since commands act on a live session', async () => {
    const { finishWorkspace, sentMessages } = stubPreparingSession();
    const user = userEvent.setup();

    renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/goal ship it');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('Commands run once the session is ready.')).toBeInTheDocument());
    expect(message()).toHaveValue('/goal ship it');
    expect(sentMessages).toEqual([]);

    await releaseSession(finishWorkspace);
  });
});
