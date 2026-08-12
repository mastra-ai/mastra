/**
 * Eager-render contract for a factory workspace thread route: the transcript
 * region, thread rail, header, and composer must all appear as soon as the
 * server-side session metadata resolves — *without* waiting for
 * `/web/github/projects/:id/ensure` to complete. During the ensure window the
 * transcript region shows the `<SessionPrepareSteps>` step loader driven by
 * the SSE progress phases, and the Send button stays disabled.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

interface ThreadRouteController {
  emitProgress(phase: string, message: string): Promise<void>;
  completeEnsure(): Promise<void>;
  completeMessages(): void;
}

/** Stub the thread route's network surface, exposing controllable ensure and messages responses. */
function stubThreadRoute(): ThreadRouteController {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let resolveStreamReady = () => {};
  let resolveMessages = () => {};
  const streamReady = new Promise<void>(resolve => {
    resolveStreamReady = resolve;
  });
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
    async emitProgress(phase, message) {
      await streamReady;
      const payload = JSON.stringify({ phase, message });
      streamController?.enqueue(encoder.encode(`event: progress\ndata: ${payload}\n\n`));
    },
    async completeEnsure() {
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

    // Before any SSE event, the first group ("Preparing sandbox") is the
    // active default with a "Starting…" secondary message.
    expect(screen.getByText('Preparing sandbox')).toBeInTheDocument();
    expect(screen.getByText('Starting…')).toBeInTheDocument();

    // Send button is disabled during preparing. Phase 2 wires
    // `sandboxPreparing` directly into `sendDisabled` — the more precise
    // assertion (title attribute) lives in the second `it` block below.
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();

    // Advance through phases.
    await ensure.emitProgress('provisioning', 'Provisioning a new sandbox…');
    await waitFor(() => expect(screen.getByText('Provisioning…')).toBeInTheDocument());

    await ensure.emitProgress('cloning', 'Cloning octo/hello…');
    await waitFor(() => expect(screen.getByText('Cloning…')).toBeInTheDocument());
    // The "Preparing sandbox" group is now complete → its short secondary
    // message unmounts, the "Cloning repository" group is the active step.
    await waitFor(() => expect(screen.queryByText('Provisioning…')).not.toBeInTheDocument());
    expect(screen.queryByText('Cloning octo/hello…')).not.toBeInTheDocument();

    // Resolve /ensure while messages are still held: the loader stays mounted,
    // advances to its final step, and Send remains disabled.
    await ensure.completeEnsure();
    await waitFor(() => expect(screen.getByText('Loading messages…')).toBeInTheDocument());
    expect(screen.getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(sendButton).toBeDisabled();

    ensure.completeMessages();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument());
  });

  it('keeps the textarea typable during preparing and preserves the draft after /ensure', async () => {
    const ensure = stubThreadRoute();
    renderThreadRoute();

    // Composer mounts eagerly.
    const composerRegion = await screen.findByRole('region', { name: 'Thread composer' });
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    expect(composerRegion).toContainElement(textarea);

    // Textarea is fully typable: not disabled, not readOnly, focusable.
    expect(textarea).not.toBeDisabled();
    expect(textarea).not.toHaveAttribute('readOnly');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Ring is spinning (data-busy="true") during preparing.
    const ring = composerRegion.querySelector<HTMLElement>('[data-slot="composer-ring"]');
    if (!ring) throw new Error('Composer ring not found');
    expect(ring).toHaveAttribute('data-busy', 'true');

    // Placeholder starts with the initializing prefix while empty.
    expect(textarea.placeholder.startsWith('Initializing work session')).toBe(true);

    // Send and every image-attachment entry point stay disabled while /ensure
    // is pending, without disabling text entry.
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveAttribute('title', 'Initializing session…');
    const image = new File(['png'], 'diagram.png', { type: 'image/png' });
    fireEvent.drop(composerRegion.querySelector('form') ?? composerRegion, { dataTransfer: { files: [image] } });
    fireEvent.paste(textarea, { clipboardData: { files: [image] } });
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

    // User types a draft during preparing.
    const user = userEvent.setup();
    await user.type(textarea, 'my draft prompt');
    expect(textarea.value).toBe('my draft prompt');

    // Resolve /ensure first — the draft remains while the initial messages
    // request is still held and the final loader step stays active.
    await ensure.completeEnsure();
    await waitFor(() => expect(screen.getByText('Loading messages…')).toBeInTheDocument());
    expect(textarea.value).toBe('my draft prompt');
    expect(sendButton).toBeDisabled();
    fireEvent.drop(composerRegion.querySelector('form') ?? composerRegion, { dataTransfer: { files: [image] } });
    fireEvent.paste(textarea, { clipboardData: { files: [image] } });
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

    // Once messages resolve, the loader unmounts, ring stops spinning,
    // placeholder reverts, Send tooltip clears, and Send becomes enabled.
    ensure.completeMessages();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument());
    // Draft survives the flag flip without remount.
    expect(textarea.value).toBe('my draft prompt');
    await waitFor(() => expect(ring.getAttribute('data-busy')).toBe('false'));
    expect(textarea.placeholder).toBe('Ask Mastra Code…');
    expect(sendButton).not.toHaveAttribute('title', 'Initializing session…');
    await waitFor(() => expect(sendButton).not.toBeDisabled());
  });
});
