/**
 * Eager-render contract for a factory workspace thread route: the transcript
 * region, thread rail, header, and composer must all appear as soon as the
 * server-side session metadata resolves — *without* waiting for
 * `/web/github/projects/:id/ensure` to complete. During the ensure window the
 * transcript region shows the `<SessionPrepareSteps>` step loader driven by
 * the SSE progress phases, and the Send button stays disabled.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
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

interface EnsureController {
  emitProgress(phase: string, message: string): Promise<void>;
  complete(): Promise<void>;
}

/** Stub the thread route's network surface, exposing a controllable SSE ensure stream. */
function stubThreadRoute(): EnsureController {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let resolveStreamReady = () => {};
  const streamReady = new Promise<void>(resolve => {
    resolveStreamReady = resolve;
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
    // The gated /ensure call — streams SSE progress under test control.
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
          resolveStreamReady();
        },
      });
      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    // Agent-controller endpoints — these must respond even before /ensure completes.
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
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return {
    async emitProgress(phase, message) {
      await streamReady;
      const payload = JSON.stringify({ phase, message });
      streamController?.enqueue(encoder.encode(`event: progress\ndata: ${payload}\n\n`));
    },
    async complete() {
      await streamReady;
      const payload = JSON.stringify({
        resourceId: SESSION_ID,
        factoryProjectId: FACTORY_ID,
        projectRepositoryId: REPO_ID,
        sandboxId: 'sb-1',
        sandboxWorkdir: '/local/acme/app',
      });
      streamController?.enqueue(encoder.encode(`event: done\ndata: ${payload}\n\n`));
      streamController?.close();
    },
  };
}

function renderThreadRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage eager render during /ensure', () => {
  it('renders the composer, transcript region, and step loader before /ensure resolves', async () => {
    const ensure = stubThreadRoute();
    renderThreadRoute();

    // Header + composer + transcript region should render right away.
    expect(await screen.findByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Factory session' })).toBeInTheDocument();

    // The step loader replaces the "Loading messages" skeleton entirely.
    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading messages')).not.toBeInTheDocument();

    // Before any SSE event, `reattaching` is the active default with a
    // "Starting…" secondary message.
    expect(screen.getByText('Reattaching to sandbox')).toBeInTheDocument();
    expect(screen.getByText('Starting…')).toBeInTheDocument();

    // Send button is disabled during preparing. In Phase 1 this is a
    // *transitive* effect of the connection status (SSE stream is opened but
    // never emits an event in this fixture, so `status` stays 'connecting').
    // Phase 2 makes this the primary gate by wiring `sandboxPreparing` into
    // `sendDisabled` directly; the assertion carries over unchanged.
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();

    // Advance through phases.
    await ensure.emitProgress('provisioning', 'Provisioning a new sandbox…');
    await waitFor(() =>
      expect(screen.getByText('Provisioning a new sandbox…')).toBeInTheDocument(),
    );

    await ensure.emitProgress('cloning', 'Cloning octo/hello…');
    await waitFor(() => expect(screen.getByText('Cloning octo/hello…')).toBeInTheDocument());
    // Provisioning is now complete → the "Provisioning a new sandbox…" secondary
    // message unmounts, and the "Provisioning sandbox" label stays but as complete.
    await waitFor(() => expect(screen.queryByText('Provisioning a new sandbox…')).not.toBeInTheDocument());

    // Resolve /ensure — the step loader unmounts.
    await ensure.complete();
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument(),
    );
  });

  it('keeps the textarea typable during preparing and preserves the draft after /ensure', async () => {
    const ensure = stubThreadRoute();
    renderThreadRoute();

    // Composer mounts eagerly.
    const composerRegion = await screen.findByRole('region', { name: 'Thread composer' });
    const textarea = composerRegion.querySelector('textarea[aria-label="Message"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    // Textarea is fully typable: not disabled, not readOnly, focusable.
    expect(textarea).not.toBeDisabled();
    expect(textarea).not.toHaveAttribute('readOnly');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Ring is spinning (data-busy="true") during preparing.
    const ring = composerRegion.querySelector('[data-slot="composer-ring"]') as HTMLElement;
    expect(ring).not.toBeNull();
    expect(ring.getAttribute('data-busy')).toBe('true');

    // Placeholder starts with the initializing prefix while empty.
    expect(textarea.placeholder.startsWith('Initializing work session')).toBe(true);

    // Send button has the "Initializing session…" title and is disabled.
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveAttribute('title', 'Initializing session…');

    // User types a draft during preparing.
    const user = userEvent.setup();
    await user.type(textarea, 'my draft prompt');
    expect(textarea.value).toBe('my draft prompt');

    // Resolve /ensure — draft is preserved, ring stops spinning, placeholder
    // reverts, Send tooltip clears, Send becomes enabled.
    await ensure.complete();
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument(),
    );
    // Draft survives the flag flip without remount.
    expect(textarea.value).toBe('my draft prompt');
    await waitFor(() => expect(ring.getAttribute('data-busy')).toBe('false'));
    expect(textarea.placeholder).toBe('Ask Mastra Code…');
    expect(sendButton).not.toHaveAttribute('title', 'Initializing session…');
    await waitFor(() => expect(sendButton).not.toBeDisabled());
  });
});
