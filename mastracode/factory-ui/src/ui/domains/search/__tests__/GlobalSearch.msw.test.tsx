import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { releaseBoard } from '../../../../../e2e/ui/board-catalog';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import { queryKeys } from '../../../../api/keys';
import { workspacesQueryOptions } from '../../../../hooks/useWorkspaces';
import { createQueryClient } from '../../../../query-client';
import { listWorkItems } from '../../factory/services/workItems';
import type { WorkItem } from '../../factory/services/workItems';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { createAppRoutes } from '../../../router';
import {
  ACTIVE_FACTORY_ID,
  factoryConnections,
  factoryProjects,
  FIRST_REPOSITORY_ID,
  intakeIssues,
  intakePullRequests,
  OTHER_FACTORY_ID,
  OTHER_REPOSITORY_ID,
  SECOND_REPOSITORY_ID,
  sessionsByRepository,
  toWireWorkItem,
  workItems,
} from './fixtures/globalSearch';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const AGENT_CONTROLLER_API = `${TEST_BASE_URL}/api/agent-controller/code`;

interface SearchRequestState {
  abortRequests: number;
  createSessionRequests: number;
  sessionsCreatedFor: string[];
  created: Record<string, unknown>[];
  transitions: Array<{ itemId: string; body: Record<string, unknown> }>;
  intakeRequests: number;
  sessionRequests: Record<string, number>;
  workItemRequests: number;
}

interface StubSearchOptions {
  activeRepositories?: LinkedRepositoryPayload[];
  activeFactoryHasRepositories?: boolean;
  failRepositories?: string[];
  failRepositoryAttempts?: Record<string, number>;
  failIntake?: boolean;
  failWorkItems?: boolean;
  secondRepositoryGate?: Promise<void>;
  onSecondRepositoryAbort?: () => void;
  running?: boolean;
  workItems?: WorkItem[];
}

function resourceIdFromRequestBody(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('resourceId' in body)) return 'resource-search';
  if (typeof body.resourceId !== 'string') return 'resource-search';
  return body.resourceId;
}

function stubSearchApi(options: StubSearchOptions = {}): SearchRequestState {
  const state: SearchRequestState = {
    abortRequests: 0,
    createSessionRequests: 0,
    sessionsCreatedFor: [],
    created: [],
    transitions: [],
    intakeRequests: 0,
    sessionRequests: {},
    workItemRequests: 0,
  };
  const failRepositories = new Set(options.failRepositories ?? []);

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authEnabled: true,
        authenticated: true,
        user: { userId: 'user-search', email: 'search@example.com' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: factoryProjects })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId`, ({ params }) => {
      const project = factoryProjects.find(candidate => candidate.id === String(params.factoryProjectId));
      return project
        ? HttpResponse.json({ project })
        : HttpResponse.json({ error: 'Factory not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, ({ params }) => {
      const factoryProjectId = String(params.factoryProjectId);
      if (factoryProjectId === ACTIVE_FACTORY_ID) {
        const connections =
          options.activeRepositories?.map(repository => ({
            id: `connection-${repository.projectRepositoryId}`,
            installationId: `installation-${repository.projectRepositoryId}`,
            integrationId: repository.provider ?? 'github',
            repositories: [
              {
                id: repository.projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { externalId: repository.externalId, slug: repository.slug, defaultBranch: 'main' },
              },
            ],
          })) ?? factoryConnections[ACTIVE_FACTORY_ID];
        return HttpResponse.json({
          connections: options.activeFactoryHasRepositories === false ? [] : connections,
        });
      }
      return HttpResponse.json({ connections: factoryConnections[OTHER_FACTORY_ID] });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, ({ params }) => {
      state.workItemRequests += 1;
      if (options.failWorkItems) return HttpResponse.json({ error: 'work items unavailable' }, { status: 500 });
      const factoryProjectId = String(params.factoryProjectId);
      return HttpResponse.json({
        workItems: factoryProjectId === ACTIVE_FACTORY_ID ? (options.workItems ?? workItems).map(toWireWorkItem) : [],
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: ['mastra-ai/mastra'] },
          linear: { enabled: false, sourceIds: null },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/issues`, ({ params, request }) => {
      state.intakeRequests += 1;
      if (options.failIntake) return HttpResponse.json({ error: 'intake unavailable' }, { status: 500 });
      const label = new URL(request.url).searchParams.get('label');
      const serveFixtures = !label && String(params.projectRepositoryId) === FIRST_REPOSITORY_ID;
      return HttpResponse.json({ issues: serveFixtures ? intakeIssues : [], nextPage: null });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/prs`, ({ params }) => {
      state.intakeRequests += 1;
      if (options.failIntake) return HttpResponse.json({ error: 'intake unavailable' }, { status: 500 });
      const serveFixtures = String(params.projectRepositoryId) === FIRST_REPOSITORY_ID;
      return HttpResponse.json({ pullRequests: serveFixtures ? intakePullRequests : [], nextPage: null });
    }),
    http.get(
      `${TEST_BASE_URL}/web/source-control/projects/:projectRepositoryId/sessions`,
      async ({ params, request }) => {
        const repositoryId = String(params.projectRepositoryId);
        state.sessionRequests[repositoryId] = (state.sessionRequests[repositoryId] ?? 0) + 1;
        if (repositoryId === SECOND_REPOSITORY_ID && options.secondRepositoryGate) {
          request.signal.addEventListener('abort', () => options.onSecondRepositoryAbort?.(), { once: true });
          await options.secondRepositoryGate;
        }
        const failedAttempts = options.failRepositoryAttempts?.[repositoryId] ?? 1;
        if (failRepositories.has(repositoryId) && state.sessionRequests[repositoryId] <= failedAttempts) {
          return HttpResponse.json({ error: 'sessions unavailable' }, { status: 500 });
        }
        return HttpResponse.json({ sessions: sessionsByRepository[repositoryId] ?? [] });
      },
    ),
    http.post(
      `${TEST_BASE_URL}/web/source-control/projects/:projectRepositoryId/sessions`,
      async ({ request, params }) => {
        state.createSessionRequests += 1;
        state.sessionsCreatedFor.push(String(params.projectRepositoryId));
        const body = (await request.json()) as { branch?: string };
        return HttpResponse.json({
          session: {
            sessionId: 'session-search',
            branch: body.branch ?? 'factory/search',
          },
        });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      const sessionId = String(params.sessionId);
      const session = Object.values(sessionsByRepository)
        .flat()
        .find(candidate => candidate.sessionId === sessionId);
      return session
        ? HttpResponse.json({ session })
        : HttpResponse.json({ error: 'Session not found' }, { status: 404 });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/work-items`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      state.created.push(body);
      return HttpResponse.json({
        workItem: toWireWorkItem({ ...workItems[0], id: 'work-item-filed', title: String(body.title) }),
      });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/work-items/:itemId/transition`,
      async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        state.transitions.push({ itemId: String(params.itemId), body });
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-search',
            itemId: String(params.itemId),
            revision: 9,
            stage: body.stage,
            decisions: [],
          },
        });
      },
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions`, async ({ request }) => {
      const resourceId = resourceIdFromRequestBody(await request.json());
      return HttpResponse.json({ controllerId: 'code', resourceId, threadId: 'thread-search' });
    }),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: 'thread-search',
        running: options.running ?? false,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${AGENT_CONTROLLER_API}/models`, () =>
      HttpResponse.json({
        models: [
          {
            id: 'openai/gpt-4o-mini',
            provider: 'openai',
            modelName: 'gpt-4o-mini',
            hasApiKey: true,
            useCount: 1,
          },
        ],
      }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: { read: 'ask' }, tools: {} }),
    ),
    // Every thread a test routes to must be listed, or the chat falls back to another one and
    // remounts the page frame under the open dialog.
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads`, () =>
      HttpResponse.json({
        threads: ['thread-work-linked', 'thread-review-linked', 'session-unlinked', 'session-user'].map(id => ({
          id,
          title: id,
          updatedAt: '2026-07-29T12:00:00.000Z',
        })),
      }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads/:threadId/messages`, () =>
      HttpResponse.json({ messages: [] }),
    ),
    http.get(
      `${AGENT_CONTROLLER_API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/thread`, () => HttpResponse.json({ ok: true })),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/abort`, () => {
      state.abortRequests += 1;
      return HttpResponse.json({});
    }),
    http.put(`${AGENT_CONTROLLER_API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/web/fs/list`, () =>
      HttpResponse.json({ root: '/tmp', path: '/tmp', parent: null, entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, ({ request }) => {
      const url = new URL(request.url);
      const workspacePath = url.searchParams.get('workspacePath') ?? '';
      const root = url.searchParams.get('root') ?? '';
      return HttpResponse.json({ workspacePath, root, rootPath: '', entries: [] });
    }),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
  );

  return state;
}

function renderSearchRoute(initialEntry = `/factories/${ACTIVE_FACTORY_ID}/settings/preferences`) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  const client = createQueryClient();
  renderWithProviders(
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" />
    </>,
    client,
  );
  return { router, client };
}

async function warmFirstRepositoryAndWorkItems(client: ReturnType<typeof createQueryClient>) {
  await Promise.all([
    client.prefetchQuery(workspacesQueryOptions(TEST_BASE_URL, FIRST_REPOSITORY_ID)),
    client.prefetchQuery({
      queryKey: queryKeys.workItems(ACTIVE_FACTORY_ID),
      queryFn: ({ signal }) => listWorkItems(TEST_BASE_URL, ACTIVE_FACTORY_ID, signal),
    }),
  ]);
}

async function openFromSidebar() {
  const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' }, { timeout: 5_000 });
  const trigger = within(sidebar).getByRole('button', { name: 'Search and navigate' });
  await userEvent.click(trigger);
  return screen.findByRole('dialog', { name: 'Global search' }, { timeout: 5_000 });
}

function expectOriginPathname(locationState: unknown, expectedPathname: string) {
  if (typeof locationState !== 'object' || locationState === null || !('from' in locationState)) {
    throw new Error('Expected navigation state to contain an origin location');
  }
  const from = locationState.from;
  if (typeof from !== 'object' || from === null || !('pathname' in from) || typeof from.pathname !== 'string') {
    throw new Error('Expected navigation state to contain an origin pathname');
  }
  expect(from.pathname).toBe(expectedPathname);
}

afterEach(() => {
  window.localStorage.removeItem('mastracode-web:sidebar:state');
  window.localStorage.removeItem('mastracode-web:sidebar:width');
});

describe('Global search', () => {
  describe.each(['board', 'search'] as const)('%s entry point', entryPoint => {
    describe.each(['github', 'gitlab'] as const)('%s source-provider repository choices', provider => {
      it.each([0, 1, 2])('offers usable choices with %s matching repositories', async count => {
        const sourceRepositories: LinkedRepositoryPayload[] = Array.from({ length: count }, (_, index) => ({
          projectRepositoryId: `${provider}-repo-${index}`,
          provider,
          externalId: String(index),
          slug: `${provider}-org/repo-${index}`,
        }));
        const otherProvider = provider === 'github' ? 'gitlab' : 'github';
        const otherRepository: LinkedRepositoryPayload = {
          projectRepositoryId: 'other-provider-repo',
          provider: otherProvider,
          slug: 'other-provider/repo',
        };
        const item: WorkItem = {
          ...workItems[3]!,
          source: provider === 'github' ? 'github-issue' : 'gitlab-issue',
          board: 'release',
          stages: ['shipped'],
          metadata: {},
        };
        const requests = stubSearchApi({
          workItems: [item],
          activeRepositories: [otherRepository, ...sourceRepositories],
        });
        const patches: unknown[] = [];
        const starts: unknown[] = [];
        server.use(
          http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
          http.get(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/boards`, () =>
            HttpResponse.json({ boards: [releaseBoard] }),
          ),
          http.get(`${TEST_BASE_URL}/web/gitlab/issues`, () => HttpResponse.json({ issues: [], nextCursor: null })),
          http.get(`${TEST_BASE_URL}/web/gitlab/projects/:projectRepositoryId/prs`, () =>
            HttpResponse.json({ pullRequests: [], nextPage: null }),
          ),
          http.patch(`${TEST_BASE_URL}/web/factory/work-items/${item.id}`, async ({ request }) => {
            patches.push(await request.json());
            return HttpResponse.json({ workItem: toWireWorkItem(item) });
          }),
          http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/runs/start`, async ({ request }) => {
            starts.push(await request.json());
            return HttpResponse.json({ prepared: { threadId: 'thread-search' } });
          }),
        );
        const user = userEvent.setup();
        renderSearchRoute(entryPoint === 'board' ? `/factories/${ACTIVE_FACTORY_ID}/boards/release` : undefined);
        const search = entryPoint === 'search' ? await openFromSidebar() : undefined;
        const results = search ? within(search) : screen;
        if (search) await user.click(await results.findByText(item.title));
        else await user.click(await screen.findByRole('button', { name: 'Start session' }));

        if (count === 0) {
          expect(
            await screen.findByText("No repository matching this card's provider is linked to this Factory."),
          ).toBeInTheDocument();
          expect(screen.queryByRole('dialog', { name: 'Choose a repository' })).not.toBeInTheDocument();
          expect(requests.createSessionRequests).toBe(0);
          expect(patches).toEqual([]);
          expect(starts).toEqual([]);
          return;
        }
        if (count > 1) {
          const picker = await screen.findByRole('dialog', { name: 'Choose a repository' });
          expect(within(picker).queryByRole('button', { name: /other-provider\/repo/ })).not.toBeInTheDocument();
          expect(within(picker).getAllByRole('button', { name: new RegExp(`${provider}-org/repo-`) })).toHaveLength(
            count,
          );
          expect(requests.createSessionRequests).toBe(0);
          await user.click(within(picker).getByRole('button', { name: new RegExp(`${provider}-org/repo-0`) }));
        }
        await waitFor(() => expect(starts).toHaveLength(1));
        expect(requests.sessionsCreatedFor).toEqual([`${provider}-repo-0`]);
        expect(patches).toEqual([{ metadata: { repository: `${provider}-org/repo-0` } }]);
        expect(screen.queryByRole('dialog', { name: 'Choose a repository' })).not.toBeInTheDocument();
        if (search) await waitFor(() => expect(search).not.toBeInTheDocument());
      });
    });
  });

  it('opens from the sidebar and Mod+K with the labeled, focused command input', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();

    await screen.findByRole('heading', { name: 'Preferences' });
    await screen.findByRole('navigation', { name: 'Settings sections' });
    const sidebar = screen.getByRole('complementary', { name: 'Main sidebar' });
    const trigger = within(sidebar).getByRole('button', { name: 'Search and navigate' });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Global search' });

    const input = screen.getByRole('combobox', { name: 'Search MastraCode' });
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search MastraCode' })).toHaveFocus();
  });

  it('opens with Ctrl+K from the Work route', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute(`/factories/${ACTIVE_FACTORY_ID}/work`);

    await screen.findByLabelText('Board columns');
    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search MastraCode' })).toHaveFocus();
  });

  it('renders navigation, settings, every session kind, and Factories across the active Factory repositories', async () => {
    const requests = stubSearchApi();
    renderSearchRoute();

    const dialog = await openFromSidebar();
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    expect(await screen.findByText('Add universal command search')).toBeInTheDocument();
    expect(await screen.findByText('Review command palette PR')).toBeInTheDocument();
    expect(await screen.findByText('research-notes')).toBeInTheDocument();
    expect(within(results).getByText('Work Sessions')).toBeInTheDocument();
    expect(within(results).getByText('Review Sessions')).toBeInTheDocument();
    expect(within(results).getByText('User Sessions')).toBeInTheDocument();
    expect(screen.getByText('Mastra Factory')).toBeInTheDocument();
    expect(screen.getByText('Docs Factory')).toBeInTheDocument();
    for (const label of [
      'Overview',
      'Work',
      'Review',
      'Rules',
      'Audit log',
      'Preferences',
      'Manage Factory',
      'Connections',
      'Repositories',
      'Work Intake',
      'Factory models',
      'Your models',
      'Factory memory',
      'Your memory',
      'Behavior',
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(requests.sessionRequests[FIRST_REPOSITORY_ID]).toBe(1);
    expect(requests.sessionRequests[SECOND_REPOSITORY_ID]).toBe(1);
    expect(requests.sessionRequests[OTHER_REPOSITORY_ID]).toBeUndefined();
  });

  it('uses the Playground-style category rail to scope visible results', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    expect(within(rail).getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(rail).getByRole('button', { name: /Navigation/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Work Sessions/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Review Sessions/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /User Sessions/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Factories/ })).toBeInTheDocument();

    await user.click(within(rail).getByRole('button', { name: /Review Sessions/ }));

    expect(screen.getByText('Review command palette PR')).toBeInTheDocument();
    expect(screen.queryByText('Add universal command search')).not.toBeInTheDocument();
    expect(within(results).queryByText('Navigation')).not.toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Review Sessions/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters locally across titles, branches, ids, and Factory repositories without issuing more requests', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    await openFromSidebar();
    await screen.findByText('Review command palette PR');

    const input = screen.getByRole('combobox', { name: 'Search MastraCode' });
    const sessionRequestCount = Object.values(requests.sessionRequests).reduce((total, count) => total + count, 0);
    const workItemRequestCount = requests.workItemRequests;

    await user.type(input, 'universal 321');
    expect(await screen.findByText('Add universal command search')).toBeInTheDocument();
    expect(screen.queryByText('Review command palette PR')).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'session-user research-notes');
    expect(await screen.findByText('research-notes')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Docs other-repo');
    expect(await screen.findByText('Docs Factory')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'nothing can match this');
    expect(await screen.findByText('No matching results.')).toBeInTheDocument();
    expect(screen.getAllByText('No matching results.')).toHaveLength(1);

    expect(Object.values(requests.sessionRequests).reduce((total, count) => total + count, 0)).toBe(
      sessionRequestCount,
    );
    expect(requests.workItemRequests).toBe(workItemRequestCount);
  });

  it('reuses warm first-repository and work-item caches while fetching the missing repository once', async () => {
    const requests = stubSearchApi();
    const { client } = renderSearchRoute();

    await warmFirstRepositoryAndWorkItems(client);
    expect(requests.sessionRequests[FIRST_REPOSITORY_ID]).toBe(1);
    expect(requests.workItemRequests).toBe(1);
    expect(requests.sessionRequests[SECOND_REPOSITORY_ID]).toBeUndefined();

    await openFromSidebar();
    await screen.findByText('Review command palette PR');

    expect(requests.sessionRequests[FIRST_REPOSITORY_ID]).toBe(1);
    expect(requests.sessionRequests[SECOND_REPOSITORY_ID]).toBe(1);
    expect(requests.workItemRequests).toBe(1);
  });

  it('keeps search open while choosing a repository for an unattributed work item', async () => {
    const item = {
      ...workItems[3]!,
      board: 'custom',
      metadata: { number: 777 },
    };
    const requests = stubSearchApi({ workItems: [item] });
    const patches: unknown[] = [];
    const starts: unknown[] = [];
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/${item.id}`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ workItem: toWireWorkItem(item) });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/runs/start`, async ({ request }) => {
        starts.push(await request.json());
        return HttpResponse.json({ threadId: 'thread-search' });
      }),
    );
    const user = userEvent.setup();
    renderSearchRoute();
    const search = await openFromSidebar();
    await user.click(await within(search).findByText(item.title));

    const picker = await screen.findByRole('dialog', { name: 'Choose a repository' });
    expect(search).toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
    expect(patches).toHaveLength(0);
    await user.click(within(picker).getByRole('button', { name: /mastra-ai\/docs/ }));
    await waitFor(() => expect(patches).toEqual([{ metadata: { number: 777, repository: 'mastra-ai/docs' } }]));
    await waitFor(() => expect(starts).toHaveLength(1));
    await waitFor(() => expect(search).not.toBeInTheDocument());
  });

  it('keeps successful results when one repository fails and retries only the failed source', async () => {
    const requests = stubSearchApi({
      failRepositories: [SECOND_REPOSITORY_ID],
      failRepositoryAttempts: { [SECOND_REPOSITORY_ID]: 2 },
    });
    const user = userEvent.setup();
    renderSearchRoute();
    await openFromSidebar();

    expect(await screen.findByText('Add universal command search')).toBeInTheDocument();
    expect(await screen.findByText('Some linked repositories could not be searched.')).toBeInTheDocument();
    expect(requests.sessionRequests[SECOND_REPOSITORY_ID]).toBe(2);

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(requests.sessionRequests[SECOND_REPOSITORY_ID]).toBe(3));
    expect(screen.getByText('Add universal command search')).toBeInTheDocument();
    expect(await screen.findByText('Review command palette PR')).toBeInTheDocument();
  });

  it('shows destructive all-repository failure while retaining navigation and Factories', async () => {
    stubSearchApi({
      failRepositories: [FIRST_REPOSITORY_ID, SECOND_REPOSITORY_ID],
      failRepositoryAttempts: { [FIRST_REPOSITORY_ID]: 2, [SECOND_REPOSITORY_ID]: 2 },
    });
    renderSearchRoute();
    await openFromSidebar();

    expect(await screen.findByText('Sessions could not be loaded from any linked repository.')).toBeInTheDocument();
    expect(screen.getByText('Mastra Factory')).toBeInTheDocument();
  });

  it('keeps branch-based review results when work-item enrichment fails', async () => {
    stubSearchApi({ failWorkItems: true });
    renderSearchRoute();
    await openFromSidebar();
    expect(await screen.findByText('factory/pr-900')).toBeInTheDocument();
    expect(await screen.findByText(/^Board cards could not be loaded/)).toBeInTheDocument();
  });

  it('searches GitLab issue and MR intake for a GitLab-linked repository without querying GitHub intake', async () => {
    const requests = stubSearchApi();
    let githubIntakeRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              ...factoryConnections[ACTIVE_FACTORY_ID][0],
              integrationId: 'gitlab',
              repositories: [
                {
                  ...factoryConnections[ACTIVE_FACTORY_ID][0].repositories[0],
                },
              ],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/issues`, () =>
        HttpResponse.json({
          issues: [
            {
              id: '43',
              externalId: 'gitlab-issue:43',
              identifier: 'group/repo#43',
              title: 'Search GitLab issue',
              url: 'https://gitlab.com/group/repo/-/issues/43',
              state: 'opened',
              stateType: 'unstarted',
              priority: null,
              assignee: null,
              author: 'alice',
              source: 'group/repo',
              sourceId: 'gitlab-project:repo',
              labels: [],
              createdAt: '2026-07-29T12:00:00.000Z',
              updatedAt: '2026-07-29T12:00:00.000Z',
            },
          ],
          nextCursor: null,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/projects/${FIRST_REPOSITORY_ID}/prs`, () =>
        HttpResponse.json({
          pullRequests: [
            {
              number: 44,
              externalId: 'gitlab-mr:44',
              title: 'Search GitLab MR',
              url: 'https://gitlab.com/group/repo/-/merge_requests/44',
              author: 'alice',
              assignees: [],
              requestedReviewers: [],
              baseBranch: 'main',
              headBranch: 'feature',
              createdAt: '2026-07-29T13:00:00.000Z',
              updatedAt: '2026-07-29T13:00:00.000Z',
            },
          ],
          nextPage: null,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/issues`, () => {
        githubIntakeRequests += 1;
        return HttpResponse.json({ issues: [], nextPage: null });
      }),
      http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/prs`, () => {
        githubIntakeRequests += 1;
        return HttpResponse.json({ pullRequests: [], nextPage: null });
      }),
    );
    const { client } = renderSearchRoute();
    await openFromSidebar();

    expect(await screen.findByText('Search GitLab issue')).toBeInTheDocument();
    const mr = await screen.findByText('Search GitLab MR');
    expect(githubIntakeRequests).toBe(0);

    await userEvent.click(mr);
    await waitFor(() => expect(requests.transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(requests.created).toEqual([
      expect.objectContaining({
        title: 'Search GitLab MR',
        board: 'review',
        stages: ['intake'],
        externalSource: expect.objectContaining({ integrationId: 'gitlab', type: 'pull-request' }),
      }),
    ]);
    expect(requests.transitions[0]).toMatchObject({ itemId: 'work-item-filed', body: { stage: 'review' } });
  });

  it.each(['#900', '900', 'PR #900'])('finds the review session by GitHub identifier "%s"', async query => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), query);

    expect(await screen.findByText('Review command palette PR')).toBeInTheDocument();
    expect(within(dialog).getByText('#900')).toBeInTheDocument();
    expect(screen.queryByText('Add universal command search')).not.toBeInTheDocument();
  });

  it('still finds the review session by identifier when work items fail to load', async () => {
    stubSearchApi({ failWorkItems: true });
    const user = userEvent.setup();
    renderSearchRoute();
    await openFromSidebar();
    await screen.findByText('factory/pr-900');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#900');

    expect(await screen.findByText('factory/pr-900')).toBeInTheDocument();
    expect(screen.queryByText('feature/offline-index')).not.toBeInTheDocument();
  });

  it('finds a board card with no session by identifier and moves it into its lane', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    expect(await within(rail).findByRole('button', { name: /^Work Items\s*4$/ })).toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    const card = await screen.findByText('Bump the command palette dependencies');
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    expect(within(results).getByText('Work Items')).toBeInTheDocument();
    expect(screen.queryByText('Palette keyboard traps focus on mobile')).not.toBeInTheDocument();

    await user.click(card);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument());
    await waitFor(() => expect(requests.transitions).toHaveLength(1));
    expect(requests.transitions[0]).toMatchObject({
      itemId: 'work-item-unstarted-review',
      body: { board: 'review', stage: 'review', cause: 'card_action' },
    });
    expect(requests.createSessionRequests).toBe(0);
  });

  it('toasts the reason when the move it fired is refused, after the palette has closed', async () => {
    stubSearchApi();
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/work-items/:itemId/transition`, () =>
        HttpResponse.json({ result: { status: 'rejected', reason: 'Reviewing is paused for this repository.' } }),
      ),
    );
    const user = userEvent.setup();
    renderSearchRoute();
    await openFromSidebar();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    await user.click(await screen.findByText('Bump the command palette dependencies'));

    expect(await screen.findByText('Reviewing is paused for this repository.')).toBeInTheDocument();
  });

  function stubAutomationStartingRunOn(workItemId: string) {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/decisions`, () =>
        HttpResponse.json({
          decisions: [
            {
              id: 'decision-queued-run',
              evaluationId: 'evaluation-queued-run',
              workItemId,
              type: 'invokeSkill',
              status: 'pending',
              attempts: 0,
              failureOccurrence: 0,
              source: null,
              failureCode: null,
              canRetry: true,
              lastError: null,
              createdAt: '2026-07-18T00:00:00.000Z',
              updatedAt: '2026-07-18T00:01:00.000Z',
              completedAt: null,
            },
          ],
        }),
      ),
    );
  }

  it('refuses to move a card into its lane while automation is already starting a run on it', async () => {
    const requests = stubSearchApi();
    stubAutomationStartingRunOn('work-item-unstarted-review');
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    await openFromSidebar();
    await screen.findByText('Review command palette PR');
    await waitFor(() => expect(client.isFetching()).toBe(0));

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    await user.click(await screen.findByText('Bump the command palette dependencies'));

    expect(await screen.findByText("Another run can't start while this card is busy.")).toBeInTheDocument();
    expect(requests.transitions).toEqual([]);
  });

  it('refuses to open a session on a custom-board card while automation is already starting a run on it', async () => {
    const item = { ...workItems[3]!, board: 'custom', metadata: { number: 777 } };
    const requests = stubSearchApi({ workItems: [item] });
    stubAutomationStartingRunOn(item.id);
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    const search = await openFromSidebar();
    const card = await within(search).findByText(item.title);
    await waitFor(() => expect(client.isFetching()).toBe(0));

    await user.click(card);

    expect(await screen.findByText("Another run can't start while this card is busy.")).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Choose a repository' })).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
    expect(requests.transitions).toEqual([]);
  });

  it('refuses a second move of a card whose first move from search is still in flight', async () => {
    const requests = stubSearchApi();
    let releaseTransition = () => {};
    const transitionGate = new Promise<void>(resolve => {
      releaseTransition = resolve;
    });
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/work-items/:itemId/transition`,
        async ({ params }) => {
          requests.transitions.push({ itemId: String(params.itemId), body: {} });
          await transitionGate;
          return HttpResponse.json({ result: { status: 'rejected', reason: 'Released by the test.' } });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    const pickCard = async () => {
      await openFromSidebar();
      await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
      await user.click(await screen.findByText('Bump the command palette dependencies'));
    };

    await pickCard();
    await waitFor(() => expect(requests.transitions).toHaveLength(1));
    await pickCard();

    expect(await screen.findByText("Another run can't start while this card is busy.")).toBeInTheDocument();
    expect(requests.transitions).toHaveLength(1);
    releaseTransition();
    await waitForMutationsIdle(client);
  });

  it('refuses to open a second session while the session chosen through the repository picker is still starting', async () => {
    const item = { ...workItems[3]!, board: 'custom', metadata: { number: 777 } };
    stubSearchApi({ workItems: [item] });
    const starts: unknown[] = [];
    let releaseStart = () => {};
    const startGate = new Promise<void>(resolve => {
      releaseStart = resolve;
    });
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/${item.id}`, () =>
        HttpResponse.json({ workItem: toWireWorkItem(item) }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/runs/start`, async ({ request }) => {
        starts.push(await request.json());
        await startGate;
        return HttpResponse.json({ threadId: 'thread-search' });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    const search = await openFromSidebar();
    await user.click(await within(search).findByText(item.title));
    const picker = await screen.findByRole('dialog', { name: 'Choose a repository' });
    await user.click(within(picker).getByRole('button', { name: /mastra-ai\/docs/ }));
    await waitFor(() => expect(starts).toHaveLength(1));

    await user.click(within(search).getByText(item.title));

    expect(await screen.findByText("Another run can't start while this card is busy.")).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Choose a repository' })).not.toBeInTheDocument();
    releaseStart();
    await waitForMutationsIdle(client);
    expect(starts).toHaveLength(1);
  });

  it('scopes results to board cards with no session', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    await user.click(within(rail).getByRole('button', { name: /Work Items/ }));

    expect(within(dialog).getByText('Bump the command palette dependencies')).toBeInTheDocument();
    expect(within(dialog).getByText('Palette keyboard traps focus on mobile')).toBeInTheDocument();
    expect(within(dialog).getByText('Harden the review board drop target')).toBeInTheDocument();
    expect(within(dialog).getByText('Rail scopes overflow on narrow viewports')).toBeInTheDocument();
    expect(screen.queryByText('Review command palette PR')).not.toBeInTheDocument();
    expect(screen.queryByText('research-notes')).not.toBeInTheDocument();
  });

  it('finds a pull request that has no card yet, files it, and moves it into its lane', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#20454');
    const candidate = await screen.findByText('Harden the review board drop target');
    expect(within(dialog).getByText(/Intake · not filed/)).toBeInTheDocument();

    await user.click(candidate);

    await waitFor(() => expect(requests.transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(requests.created).toEqual([
      expect.objectContaining({ title: 'Harden the review board drop target', board: 'review', stages: ['intake'] }),
    ]);
    expect(requests.transitions[0]).toMatchObject({ itemId: 'work-item-filed', body: { stage: 'review' } });
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
  });

  it('lists a pull request already filed as a card only once', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#900');

    const results = within(dialog).getByRole('region', { name: 'Search results' });
    await waitFor(() => expect(within(results).getAllByRole('option')).toHaveLength(1));
    expect(within(results).getByText('Review Sessions')).toBeInTheDocument();
  });

  it('keeps board cards searchable when the GitHub intake feeds fail', async () => {
    stubSearchApi({ failIntake: true });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openFromSidebar();

    expect(await screen.findByText('Bump the command palette dependencies')).toBeInTheDocument();
    expect(await screen.findByText('Intake could not be loaded.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Harden the review board drop target')).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    expect(await screen.findByText('Bump the command palette dependencies')).toBeInTheDocument();
  });

  it('runs no session request for a Factory with no linked repository', async () => {
    const requests = stubSearchApi({ activeFactoryHasRepositories: false });
    renderSearchRoute();
    const dialog = await openFromSidebar();
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    expect(within(results).getByText('Navigation')).toBeInTheDocument();
    expect(within(results).getByText('Factories')).toBeInTheDocument();
    expect(Object.values(requests.sessionRequests)).toHaveLength(0);
    expect(requests.workItemRequests).toBe(0);
    expect(requests.intakeRequests).toBe(0);
  });

  it('keeps a repository request alive when the notification observer also consumes it', async () => {
    let releaseSecondRepository = () => {};
    const secondRepositoryGate = new Promise<void>(resolve => {
      releaseSecondRepository = resolve;
    });
    const onAbort = vi.fn();
    const requests = stubSearchApi({ secondRepositoryGate, onSecondRepositoryAbort: onAbort });
    const user = userEvent.setup();
    const { client } = renderSearchRoute();

    await warmFirstRepositoryAndWorkItems(client);
    expect(requests.sessionRequests[FIRST_REPOSITORY_ID]).toBe(1);
    await openFromSidebar();
    await waitFor(() => expect(requests.sessionRequests[SECOND_REPOSITORY_ID]).toBe(1));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onAbort).not.toHaveBeenCalled();
    releaseSecondRepository();
  });

  it('selects Settings with origin state and closes without creating a session', async () => {
    const requests = stubSearchApi();
    const origin = `/factories/${ACTIVE_FACTORY_ID}/settings/preferences`;
    const user = userEvent.setup();
    const { router } = renderSearchRoute(origin);
    const dialog = await openFromSidebar();

    await user.click(within(dialog).getByText('Behavior'));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${ACTIVE_FACTORY_ID}/settings/behavior`),
    );
    expectOriginPathname(router.state.location.state, origin);
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
  });

  it.each([
    {
      title: 'Add universal command search',
      path: `/factories/${ACTIVE_FACTORY_ID}/workspaces/session-work/threads/thread-work-linked`,
      preservesOrigin: true,
    },
    {
      title: 'Review command palette PR',
      path: `/factories/${ACTIVE_FACTORY_ID}/workspaces/session-review/threads/thread-review-linked`,
      preservesOrigin: true,
    },
    {
      title: 'feature/offline-index',
      path: `/factories/${ACTIVE_FACTORY_ID}/workspaces/session-unlinked/threads/session-unlinked`,
      preservesOrigin: true,
    },
    {
      title: 'research-notes',
      path: `/factories/${ACTIVE_FACTORY_ID}/user/threads/session-user`,
      preservesOrigin: false,
    },
    {
      title: 'Docs Factory',
      path: `/factories/${OTHER_FACTORY_ID}/work`,
      preservesOrigin: false,
    },
  ])('selects $title on the declared route and closes search', async ({ title, path, preservesOrigin }) => {
    const requests = stubSearchApi();
    const origin = `/factories/${ACTIVE_FACTORY_ID}/settings/preferences`;
    const user = userEvent.setup();
    const { router } = renderSearchRoute(origin);
    const dialog = await openFromSidebar();
    await screen.findByText('Review command palette PR');

    await user.click(within(dialog).getByText(title));

    await waitFor(() => expect(router.state.location.pathname).toBe(path));
    if (preservesOrigin) expectOriginPathname(router.state.location.state, origin);
    else expect(router.state.location.state).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
  });

  it('closes from a busy chat route, restores trigger focus, and does not abort the run', async () => {
    const requests = stubSearchApi({ running: true });
    const user = userEvent.setup();
    renderSearchRoute(`/factories/${ACTIVE_FACTORY_ID}/workspaces/session-work/threads/thread-work-linked`);

    // Abort renders once the run reports itself live, so it also marks the point where the chat
    // route has stopped swapping its frame — and a trigger captured mid-swap can never take focus.
    await screen.findByRole('button', { name: 'Abort' }, { timeout: 5_000 });

    const sidebar = screen.getByRole('complementary', { name: 'Main sidebar' });
    const trigger = within(sidebar).getByRole('button', { name: 'Search and navigate' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(requests.abortRequests).toBe(0);
  });
});
