/**
 * Eager-render contract for a factory workspace thread route: the transcript
 * region, thread rail, header, and composer must all appear as soon as the
 * server-side session metadata resolves — without waiting on a sandbox, which
 * boots lazily at the first command. The composer must become fully usable
 * (send enabled, attachments accepted) as soon as the initial messages request
 * resolves. The only blocking window is message loading.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const workspaceSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/issue-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

interface ThreadRouteController {
  completeMessages(): void;
}

/** Stub the thread route's network surface, exposing a controllable messages response. */
function stubThreadRoute(): ThreadRouteController {
  let resolveMessages = () => {};
  const messagesReady = new Promise<void>(resolve => {
    resolveMessages = resolve;
  });

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
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
                sandboxWorkdir: '/repo',
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    // Agent-controller endpoints — these must respond before any sandbox exists.
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
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [{ id: SESSION_ID }] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, async () => {
      await messagesReady;
      return HttpResponse.json({ messages: [] });
    }),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return {
    completeMessages() {
      resolveMessages();
    },
  };
}

function renderThreadRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage eager render', () => {
  it('becomes fully interactive as soon as the initial messages request resolves', async () => {
    const messages = stubThreadRoute();
    const { client } = renderThreadRoute();

    // Header + composer + transcript region should render right away.
    expect(await screen.findByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Factory session' })).toBeInTheDocument();

    // The only blocking window is initial message loading — the loader shows
    // "Loading messages…" and Send stays disabled while it is held.
    await waitFor(() => expect(screen.getByText('Loading messages…')).toBeInTheDocument());
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();

    // Messages resolve: the composer comes fully online and the stepper
    // releases, because message loading was the only thing it was waiting on.
    messages.completeMessages();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'ready to send');
    await waitFor(() => expect(sendButton).toBeEnabled());
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
  });

  it('keeps the textarea typable during message loading and preserves the draft', async () => {
    const messages = stubThreadRoute();
    const { client } = renderThreadRoute();

    // Composer mounts eagerly.
    const composerRegion = await screen.findByRole('region', { name: 'Thread composer' });
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    expect(composerRegion).toContainElement(textarea);

    // Textarea is fully typable: not disabled, not readOnly, focusable.
    expect(textarea).not.toBeDisabled();
    expect(textarea).not.toHaveAttribute('readOnly');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Ring is spinning (data-busy="true") while messages load.
    const ring = composerRegion.querySelector<HTMLElement>('[data-slot="composer-ring"]');
    if (!ring) throw new Error('Composer ring not found');
    expect(ring).toHaveAttribute('data-busy', 'true');

    // Placeholder starts with the initializing prefix while empty.
    expect(textarea.placeholder.startsWith('Initializing work session')).toBe(true);

    // Send and every image-attachment entry point stay disabled while the
    // initial messages request is held, without disabling text entry.
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveAttribute('title', 'Initializing session…');
    const image = new File(['png'], 'diagram.png', { type: 'image/png' });
    fireEvent.drop(composerRegion.querySelector('form') ?? composerRegion, { dataTransfer: { files: [image] } });
    fireEvent.paste(textarea, { clipboardData: { files: [image] } });
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

    // User types a draft while messages load.
    const user = userEvent.setup();
    await user.type(textarea, 'my draft prompt');
    expect(textarea.value).toBe('my draft prompt');

    // Messages resolve: the ring stops spinning, placeholder reverts, Send
    // tooltip clears, and Send becomes enabled.
    messages.completeMessages();
    await waitFor(() => expect(ring.getAttribute('data-busy')).toBe('false'));
    // Draft survives the flag flip without remount.
    expect(textarea.value).toBe('my draft prompt');
    expect(textarea.placeholder).toBe('Ask Mastra Code…');
    expect(sendButton).not.toHaveAttribute('title', 'Initializing session…');
    await waitFor(() => expect(sendButton).not.toBeDisabled());

    // Attachments now work.
    fireEvent.drop(composerRegion.querySelector('form') ?? composerRegion, { dataTransfer: { files: [image] } });
    expect(await screen.findByRole('button', { name: 'Remove image' })).toBeInTheDocument();

    await waitForMutationsIdle(client);
  });
});
