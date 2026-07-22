/**
 * BDD coverage for the Factory Audit page.
 *
 * Drives the real route table through a memory router with the full provider
 * stack, so the specs exercise what a user sees at /factory/audit: the
 * append-only audit trail fed by the server's org+project-scoped read API.
 * Only the network is mocked (MSW).
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import type { GithubStatus, Factory } from '../../workspaces';
import { createAppRoutes } from '../../../router';
import type { AuditEvent } from '../services/audit';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-gh';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const FACTORY_PROJECT_ID = 'fp-1';

const githubProject: Factory = {
  id: 'project-gh',
  name: 'Mastra',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: FACTORY_PROJECT_ID,
    repositories: [
      {
        projectRepositoryId: 'pr-1',
        slug: 'mastra-ai/mastra',
        gitBranch: 'main',
        sandboxWorkdir: '/sandbox/mastra',
        selectedWorktreePath: '/sandbox/mastra',
        worktrees: [{ branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' }],
      },
    ],
  },
};

const localProject: Factory = {
  id: 'project-local',
  name: 'Local',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/local',
  },
};

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt-1',
    orgId: 'org-1',
    actorId: 'user_alice',
    actorType: 'human',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix flaky test' }],
    metadata: { from: ['triage'], to: ['building'] },
    githubProjectId: FACTORY_PROJECT_ID,
    context: {},
    occurredAt: '2026-07-15T18:00:00.000Z',
    ...overrides,
  };
}

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function sessionState() {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

interface AuditHandlerState {
  /** `(actions, before)` of every audit list request, in order. */
  requests: { actions: string | null; before: string | null }[];
}

interface AuditHandlerOptions {
  /** Pages served in order; the last page is repeated for extra requests. */
  pages?: { events: AuditEvent[]; nextCursor?: string }[];
  /** Portal-link response: a URL when WorkOS is configured, otherwise 404. */
  portalUrl?: string;
}

function useAuditHandlers(options: AuditHandlerOptions = {}): AuditHandlerState {
  const pages = options.pages ?? [{ events: [makeEvent()] }];
  const state: AuditHandlerState = { requests: [] };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedStatus)),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: [] }, linear: { enabled: false, sourceIds: [] } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/audit`, ({ request }) => {
      const url = new URL(request.url);
      state.requests.push({ actions: url.searchParams.get('actions'), before: url.searchParams.get('before') });
      const page = pages[Math.min(state.requests.length - 1, pages.length - 1)]!;
      return HttpResponse.json(page);
    }),
    http.get(`${TEST_BASE_URL}/web/audit/portal-link`, () =>
      options.portalUrl
        ? HttpResponse.json({ url: options.portalUrl })
        : HttpResponse.json({ error: 'not_available' }, { status: 404 }),
    ),
  );
  return state;
}

function renderAt(initialEntry: string, project: Factory = githubProject) {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Factory Audit page', () => {
  it('given recorded events, when the page renders, then the trail shows action, target, actor, and metadata details', async () => {
    useAuditHandlers({
      pages: [
        {
          events: [
            makeEvent(),
            makeEvent({
              id: 'evt-2',
              actorId: 'user_bob',
              action: 'factory.worktree.deleted',
              targets: [{ type: 'worktree', id: '/sandbox/mastra-worktrees/feat-x', name: 'factory/issue-12' }],
              metadata: {},
              occurredAt: '2026-07-15T17:00:00.000Z',
            }),
          ],
        },
      ],
    });
    renderAt('/factory/audit');

    expect(await screen.findByRole('heading', { name: 'Audit' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Audit events' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    // Stage move: action badge, target name, actor, expandable metadata.
    expect(within(rows[0]!).getByText('Stage moved')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('by user_alice')).toBeInTheDocument();
    await userEvent.click(within(rows[0]!).getByText('Details'));
    expect(within(rows[0]!).getByText(/"building"/)).toBeInTheDocument();

    // Worktree delete: no metadata means no Details toggle.
    expect(within(rows[1]!).getByText('Deleted')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('factory/issue-12')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Details')).not.toBeInTheDocument();

    // WorkOS isn't configured (portal-link 404), so the button is hidden.
    expect(screen.queryByRole('button', { name: 'Open in WorkOS' })).not.toBeInTheDocument();
  });

  it('given the All filter, when the user picks Git, then events are refetched with the git action list', async () => {
    const state = useAuditHandlers();
    renderAt('/factory/audit');

    await screen.findByRole('list', { name: 'Audit events' });
    expect(state.requests[0]!.actions).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Git' }));

    await waitFor(() =>
      expect(state.requests.map(r => r.actions)).toContain('factory.git.commit,factory.git.push,factory.git.pr_opened'),
    );
  });

  it('given the All filter, when the user picks Agent, then events are refetched with the agent action list', async () => {
    const state = useAuditHandlers();
    renderAt('/factory/audit');

    await screen.findByRole('list', { name: 'Audit events' });

    await userEvent.click(screen.getByRole('button', { name: 'Agent' }));

    await waitFor(() =>
      expect(state.requests.map(r => r.actions)).toContain(
        'factory.agent.commit,factory.agent.push,factory.agent.pr_opened',
      ),
    );
  });

  it('given an agent event, when the trail renders, then the row attributes it to the agent and the initiating human', async () => {
    useAuditHandlers({
      pages: [
        {
          events: [
            makeEvent({
              id: 'evt-agent',
              actorId: 'agent:thread-42',
              actorType: 'agent',
              action: 'factory.agent.push',
              targets: [{ type: 'worktree', id: '/sandbox/mastra-worktrees/feat-audit' }],
              metadata: { branch: 'feat/audit', startedBy: 'user_alice' },
            }),
          ],
        },
      ],
    });
    renderAt('/factory/audit');

    const list = await screen.findByRole('list', { name: 'Audit events' });
    const row = within(list).getAllByRole('listitem')[0]!;
    expect(within(row).getByText('Push')).toBeInTheDocument();
    expect(within(row).getByText('by agent · started by user_alice')).toBeInTheDocument();
    expect(within(row).queryByText(/agent:thread-42/)).not.toBeInTheDocument();
  });

  it('given more events than one page, when the user clicks Load more, then the next page is fetched with the cursor and appended', async () => {
    const state = useAuditHandlers({
      pages: [
        { events: [makeEvent()], nextCursor: '2026-07-15T18:00:00.000Z_evt-1' },
        {
          events: [
            makeEvent({ id: 'evt-older', action: 'factory.work_item.created', occurredAt: '2026-07-14T00:00:00.000Z' }),
          ],
        },
      ],
    });
    renderAt('/factory/audit');

    const list = await screen.findByRole('list', { name: 'Audit events' });
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
    expect(state.requests[1]!.before).toBe('2026-07-15T18:00:00.000Z_evt-1');
    expect(screen.getByText('Created')).toBeInTheDocument();
    // Both pages exhausted — nothing more to load.
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('given WorkOS is configured, when the user clicks Open in WorkOS, then the one-time portal link opens in a new tab', async () => {
    useAuditHandlers({ portalUrl: 'https://portal.workos.com/audit-logs/one-time' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderAt('/factory/audit');

    await userEvent.click(await screen.findByRole('button', { name: 'Open in WorkOS' }));

    expect(open).toHaveBeenCalledWith('https://portal.workos.com/audit-logs/one-time', '_blank', 'noopener,noreferrer');
  });

  it('given no events yet, when the page renders, then a friendly empty state appears', async () => {
    useAuditHandlers({ pages: [{ events: [] }] });
    renderAt('/factory/audit');

    expect(await screen.findByText(/No audit events yet/)).toBeInTheDocument();
  });

  it('given a local project, when visiting Audit, then the GitHub-only notice renders instead of the trail', async () => {
    useAuditHandlers();
    renderAt('/factory/audit', localProject);

    expect(
      await screen.findByText(/Board, metrics, and audit are available for server-backed Factories/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Audit events' })).not.toBeInTheDocument();
  });
});
