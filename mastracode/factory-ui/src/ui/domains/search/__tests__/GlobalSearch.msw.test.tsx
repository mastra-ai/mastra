import type { ProjectListRepository } from '@mastra/factory/routes/contracts';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { listedRepository } from '../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../e2e/ui/msw-server';
import { releaseBoard, workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import { workspacesQueryOptions } from '../../../../hooks/useWorkspaces';
import { createQueryClient } from '../../../../query-client';
import type { GithubIssue, GithubPullRequest } from '../../factory/services/factory';
import type { WorkItem } from '../../factory/services/workItems';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { createAppRoutes } from '../../../router';
import {
  ACTIVE_FACTORY_ID,
  factoryProjects,
  factoryRepositories,
  FIRST_REPOSITORY_ID,
  intakeIssues,
  intakePullRequests,
  listWorkItemsResponse,
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
const THREAD_IDS_THE_CHAT_MUST_LIST_TO_STAY_MOUNTED = [
  'thread-work-linked',
  'thread-review-linked',
  'session-unlinked',
  'session-user',
];

interface SearchRequestState {
  abortRequests: number;
  createSessionRequests: number;
  sessionsCreatedFor: string[];
  created: Record<string, unknown>[];
  transitions: Array<{ itemId: string; body: Record<string, unknown> }>;
  intakeRequests: number;
  sessionRequests: Record<string, number>;
  /** The query string of each read of the card list; `''` is a read of the whole board. */
  workItemQueries: string[];
}

interface StubSearchOptions {
  activeRepositories?: LinkedRepositoryPayload[];
  activeFactoryHasRepositories?: boolean;
  failSessionAttempts?: number;
  /** How many reads of the cards holding a session fail before one answers. */
  failSessionCardAttempts?: number;
  failIntake?: boolean;
  failWorkItems?: boolean;
  /** The live GitHub intake of `FIRST_REPOSITORY_ID`, instead of the fixtures. */
  intake?: { issues: GithubIssue[]; pullRequests: GithubPullRequest[] };
  /**
   * A server that narrows the list by session only, as before the palette's reads existed: it
   * ignores `started`, `q`, `limit` and `source`, and sends the whole board with no `total`.
   */
  serverNarrowsBySessionOnly?: boolean;
  sessionsGate?: Promise<void>;
  onSessionsAbort?: () => void;
  running?: boolean;
  sessions?: Record<string, FactoryUserSession[]>;
  workItems?: WorkItem[];
}

function resourceIdFromRequestBody(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('resourceId' in body)) return 'resource-search';
  if (typeof body.resourceId !== 'string') return 'resource-search';
  return body.resourceId;
}

function projectListResponse(repositories: Record<string, ProjectListRepository[]>) {
  return HttpResponse.json({
    projects: factoryProjects.map(project => ({ ...project, repositories: repositories[project.id] ?? [] })),
  });
}

function activeFactoryRepositories(options: StubSearchOptions): ProjectListRepository[] {
  if (options.activeFactoryHasRepositories === false) return [];
  if (!options.activeRepositories) return factoryRepositories[ACTIVE_FACTORY_ID];
  return options.activeRepositories.map(repository =>
    listedRepository(repository.projectRepositoryId, repository.slug, {
      integrationId: repository.provider ?? 'github',
      externalId: repository.externalId ?? null,
      branch: 'main',
      sandboxWorkdir: '/repo',
    }),
  );
}

const noFeedStream = http.get(
  `${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/feed-events`,
  () => new HttpResponse(null, { status: 404 }),
);

function stubSearchApi(options: StubSearchOptions = {}): SearchRequestState {
  const state: SearchRequestState = {
    abortRequests: 0,
    createSessionRequests: 0,
    sessionsCreatedFor: [],
    created: [],
    transitions: [],
    intakeRequests: 0,
    sessionRequests: {},
    workItemQueries: [],
  };

  server.use(
    noFeedStream,
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authEnabled: true,
        authenticated: true,
        user: { userId: 'user-search', email: 'search@example.com' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      projectListResponse({ ...factoryRepositories, [ACTIVE_FACTORY_ID]: activeFactoryRepositories(options) }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId`, ({ params }) => {
      const project = factoryProjects.find(candidate => candidate.id === String(params.factoryProjectId));
      return project
        ? HttpResponse.json({ project })
        : HttpResponse.json({ error: 'Factory not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, ({ params, request }) => {
      const query = new URL(request.url).searchParams;
      state.workItemQueries.push(query.toString());
      if (options.failWorkItems) return HttpResponse.json({ error: 'work items unavailable' }, { status: 500 });
      const sessionCardReads = state.workItemQueries.filter(asked => asked === 'scope=sessions').length;
      if (query.get('scope') === 'sessions' && sessionCardReads <= (options.failSessionCardAttempts ?? 0)) {
        return HttpResponse.json({ error: 'work items unavailable' }, { status: 500 });
      }
      const cards = String(params.factoryProjectId) === ACTIVE_FACTORY_ID ? (options.workItems ?? workItems) : [];
      if (options.serverNarrowsBySessionOnly) {
        for (const ignored of ['started', 'q', 'limit', 'source', 'workItemId']) query.delete(ignored);
      }
      const listed = listWorkItemsResponse(cards, query);
      return listed ? HttpResponse.json(listed) : HttpResponse.json({ error: 'invalid_scope' }, { status: 400 });
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
      return HttpResponse.json({
        issues: serveFixtures ? (options.intake?.issues ?? intakeIssues) : [],
        nextPage: null,
      });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/prs`, ({ params }) => {
      state.intakeRequests += 1;
      if (options.failIntake) return HttpResponse.json({ error: 'intake unavailable' }, { status: 500 });
      const serveFixtures = String(params.projectRepositoryId) === FIRST_REPOSITORY_ID;
      return HttpResponse.json({
        pullRequests: serveFixtures ? (options.intake?.pullRequests ?? intakePullRequests) : [],
        nextPage: null,
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/sessions`, async ({ params, request }) => {
      const factoryProjectId = String(params.factoryProjectId);
      state.sessionRequests[factoryProjectId] = (state.sessionRequests[factoryProjectId] ?? 0) + 1;
      if (options.sessionsGate) {
        request.signal.addEventListener('abort', () => options.onSessionsAbort?.(), { once: true });
        await options.sessionsGate;
      }
      if (state.sessionRequests[factoryProjectId] <= (options.failSessionAttempts ?? 0)) {
        return HttpResponse.json({ error: 'sessions unavailable' }, { status: 500 });
      }
      const repositoryIds =
        factoryProjectId === ACTIVE_FACTORY_ID ? [FIRST_REPOSITORY_ID, SECOND_REPOSITORY_ID] : [OTHER_REPOSITORY_ID];
      return HttpResponse.json({
        sessions: repositoryIds.flatMap(id => (options.sessions ?? sessionsByRepository)[id] ?? []),
      });
    }),
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
      // Like the server, the filed card carries the source it was filed from.
      const external = body.externalSource as { integrationId?: string; type?: string } | undefined;
      const source =
        external?.type === 'pull-request'
          ? external.integrationId === 'gitlab'
            ? ('gitlab-pr' as const)
            : ('github-pr' as const)
          : workItems[0].source;
      return HttpResponse.json({
        workItem: toWireWorkItem({
          ...workItems[0],
          id: 'work-item-filed',
          title: String(body.title),
          source,
          board: typeof body.board === 'string' ? body.board : undefined,
          // Like the server, it is filed in the phases it was asked for.
          ...(Array.isArray(body.stages) ? { stages: body.stages as string[] } : {}),
        }),
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
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads`, () =>
      HttpResponse.json({
        threads: THREAD_IDS_THE_CHAT_MUST_LIST_TO_STAY_MOUNTED.map(id => ({
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

/** A card nobody started work on, last touched on `day`. */
function unstartedCard(id: string, title: string, day: string): WorkItem {
  return {
    id,
    orgId: 'org-search',
    createdBy: 'user-search',
    githubProjectId: ACTIVE_FACTORY_ID,
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    description: null,
    revision: 1,
    createdAt: `${day}T08:00:00.000Z`,
    updatedAt: `${day}T08:00:00.000Z`,
  };
}

async function openWithShortcut() {
  await screen.findByRole('complementary', { name: 'Main sidebar' }, { timeout: 5_000 });
  await userEvent.keyboard('{Control>}k{/Control}');
  return screen.findByRole('dialog', { name: 'Global search' }, { timeout: 5_000 });
}

async function waitForTheChatFrameToSettleOnALiveRun() {
  await screen.findByRole('button', { name: 'Abort' }, { timeout: 5_000 });
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
          ...workItems[3],
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
        const search = entryPoint === 'search' ? await openWithShortcut() : undefined;
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

  it('opens with Mod+K on the labeled, focused command input and hands focus back on close', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();

    await screen.findByRole('heading', { name: 'Preferences' });
    const settingsNavigation = await screen.findByRole('navigation', { name: 'Settings sections' });
    const focusedBeforeSearch = within(settingsNavigation).getByRole('button', { name: 'Back to app' });
    act(() => focusedBeforeSearch.focus());

    await user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('dialog', { name: 'Global search' });
    expect(screen.getByRole('combobox', { name: 'Search MastraCode' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    await waitFor(() => expect(focusedBeforeSearch).toHaveFocus());
  });

  it('opens from the sidebar search button and hands focus back to it on close', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' }, { timeout: 5_000 });
    const trigger = within(sidebar).getByRole('button', { name: 'Search and navigate' });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Global search' });
    expect(screen.getByRole('combobox', { name: 'Search MastraCode' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each(['activity', 'overview', 'attention', 'metrics', 'audit'])(
    'opens the same Factory board from the retired %s URL',
    async page => {
      stubSearchApi();
      const { router } = renderSearchRoute(`/factories/${OTHER_FACTORY_ID}/${page}?events=all`);

      await screen.findByLabelText('Board stages');
      expect(router.state.location.pathname).toBe(`/factories/${OTHER_FACTORY_ID}/work`);
      expect(router.state.location.search).toBe('');
    },
  );

  it('opens with Ctrl+K from the Work route', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute(`/factories/${ACTIVE_FACTORY_ID}/work`);

    await screen.findByLabelText('Board stages');
    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search MastraCode' })).toHaveFocus();
  });

  it('renders navigation, settings, every session kind, and Factories across the active Factory repositories', async () => {
    const requests = stubSearchApi();
    renderSearchRoute();

    const dialog = await openWithShortcut();
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    expect(await screen.findByText('Add universal command search')).toBeInTheDocument();
    expect(await screen.findByText('Review command palette PR')).toBeInTheDocument();
    expect(await screen.findByText('research-notes')).toBeInTheDocument();
    expect(within(results).getByText('Work Sessions')).toBeInTheDocument();
    expect(within(results).getByText('Review Sessions')).toBeInTheDocument();
    expect(within(results).getByText('User Sessions')).toBeInTheDocument();
    expect(within(results).getByText('Mastra Factory')).toBeInTheDocument();
    expect(within(results).getByText('Docs Factory')).toBeInTheDocument();
    for (const label of [
      'Work',
      'Pull requests',
      'Rules',
      'Preferences',
      'Manage Factory',
      'Connections',
      'Repositories',
      'Work Intake',
      'Models',
      'Memory',
      'Behavior',
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).queryByText('Activity')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Audit log')).not.toBeInTheDocument();
    expect(requests.sessionRequests).toEqual({ [ACTIVE_FACTORY_ID]: 1 });
  });

  it('uses the Playground-style category rail to scope visible results', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    expect(within(rail).getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(rail).getByRole('button', { name: /Navigation/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Work sessions/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Review sessions/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /User sessions/ })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Factories/ })).toBeInTheDocument();

    await user.click(within(rail).getByRole('button', { name: /Review sessions/ }));

    expect(screen.getByText('Review command palette PR')).toBeInTheDocument();
    expect(screen.queryByText('Add universal command search')).not.toBeInTheDocument();
    expect(within(results).queryByText('Navigation')).not.toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Review sessions/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters across titles, branches, ids, and Factory repositories without ever downloading the board', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    await openWithShortcut();
    await screen.findByText('Review command palette PR');

    const input = screen.getByRole('combobox', { name: 'Search MastraCode' });
    const sessionRequestCount = Object.values(requests.sessionRequests).reduce((total, count) => total + count, 0);

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
    // The server is asked once typing pauses, never for the whole board.
    await waitFor(() => expect(requests.workItemQueries).toContain('started=false&q=nothing+can+match+this'));
    expect(requests.workItemQueries).not.toContain('');
  });

  it('opens on warm sessions without refetching them, and reads the cards in parts instead of the board', async () => {
    const requests = stubSearchApi();
    const { client } = renderSearchRoute();

    await client.query(workspacesQueryOptions(TEST_BASE_URL, ACTIVE_FACTORY_ID));
    expect(requests.sessionRequests).toEqual({ [ACTIVE_FACTORY_ID]: 1 });

    await openWithShortcut();
    await screen.findByText('Review command palette PR');
    await screen.findByText('Bump the command palette dependencies');
    await screen.findByText('Harden the review board drop target');

    expect(requests.sessionRequests).toEqual({ [ACTIVE_FACTORY_ID]: 1 });
    // The sidebar already read the cards holding a session: the palette shares that read.
    expect(requests.workItemQueries.toSorted()).toEqual([
      'scope=sessions',
      // Each live candidate, by its key and its URL, to learn which of them a card is already filed from.
      `source=${[
        'github-pr:20454',
        'https://github.com/mastra-ai/mastra/pull/20454',
        'github-issue:20455',
        'https://github.com/mastra-ai/mastra/issues/20455',
        'github-pr:900',
        'https://github.com/mastra-ai/mastra/pull/900',
      ]
        .map(encodeURIComponent)
        .join('&source=')}`,
      'started=false&q=',
    ]);
  });

  it('finds a card past the first 20 once its words are typed, while the rail keeps counting every card', async () => {
    const backlog = Array.from({ length: 24 }, (_, index) =>
      unstartedCard(`backlog-${index}`, `Backlog chore ${index}`, `2026-07-${String(index + 1).padStart(2, '0')}`),
    );
    const requests = stubSearchApi({
      workItems: [...backlog, unstartedCard('signing-keys', 'Rotate the signing keys', '2026-06-01')],
    });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    const rail = screen.getByRole('complementary', { name: 'Search categories' });

    // 25 cards, plus the three live candidates no card is filed from.
    expect(await within(rail).findByRole('button', { name: /^Work items\s*28$/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Backlog chore 23')).toBeInTheDocument();
    expect(within(dialog).queryByText('Rotate the signing keys')).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'SIGNING rotate');

    expect(await within(dialog).findByText('Rotate the signing keys')).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /^Work items\s*28$/ })).toBeInTheDocument();
    // One search for the settled text, none for the letters on the way to it.
    expect(requests.workItemQueries.filter(query => query.startsWith('started=false'))).toEqual([
      'started=false&q=',
      'started=false&q=SIGNING+rotate',
    ]);
  });

  it('does not offer a pull request whose card is past the first 20, and lists that card once typed', async () => {
    const backlog = Array.from({ length: 24 }, (_, index) =>
      unstartedCard(`backlog-${index}`, `Backlog chore ${index}`, `2026-07-${String(index + 1).padStart(2, '0')}`),
    );
    const [pullRequest] = intakePullRequests;
    stubSearchApi({
      workItems: [
        ...backlog,
        {
          ...unstartedCard('filed-pull-request', pullRequest.title, '2026-06-01'),
          source: 'github-pr',
          sourceKey: `github-pr:${pullRequest.number}`,
          url: pullRequest.url,
          workItem: {
            provider: 'github',
            key: null,
            url: pullRequest.url,
            title: pullRequest.title,
            state: 'open',
            labels: [],
            author: null,
            metadata: { number: pullRequest.number },
          },
        },
      ],
    });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    // 25 cards and two unfiled candidates: the pull request counts as its card, not as a candidate too.
    expect(await within(rail).findByRole('button', { name: /^Work items\s*27$/ })).toBeInTheDocument();
    expect(await within(results).findByText('Rail scopes overflow on narrow viewports')).toBeInTheDocument();
    expect(within(results).queryByText(pullRequest.title)).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), `#${pullRequest.number}`);

    expect(await within(results).findByRole('option', { name: /not started/ })).toHaveTextContent(pullRequest.title);
    expect(within(results).getAllByRole('option')).toHaveLength(1);
  });

  // Technical: the server matches a card's number whatever its source; the palette then filters the row itself.
  it('lists a card found by its number alone when it has no key and no GitHub source', async () => {
    stubSearchApi({
      workItems: [
        {
          ...unstartedCard('numbered-card', 'Rotate the signing keys', '2026-07-01'),
          source: 'gitlab-issue',
          sourceKey: 'gitlab-issue:9001',
          url: 'https://gitlab.com/group/repo/-/issues/9001',
          workItem: {
            provider: 'gitlab',
            key: null,
            url: 'https://gitlab.com/group/repo/-/issues/9001',
            title: 'Rotate the signing keys',
            state: 'opened',
            labels: [],
            author: null,
            metadata: { number: 42 },
          },
        },
      ],
    });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    await within(results).findByText('Rotate the signing keys');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '42');

    await waitFor(() => expect(within(results).getAllByRole('option')).toHaveLength(1));
    expect(within(results).getByRole('option', { name: /not started/ })).toHaveTextContent('Rotate the signing keys');
  });

  // Technical: only the 20 best candidates are looked up, ranked on the text their rows are filtered on.
  it('lists the one candidate matching a typed source label when it is the oldest of more than 20', async () => {
    const issues: GithubIssue[] = Array.from({ length: 21 }, (_, index) => {
      const at = `2026-07-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`;
      return {
        number: 31000 + index,
        title: `Flaky check ${index}`,
        url: `https://github.com/mastra-ai/mastra/issues/${31000 + index}`,
        author: 'cleo',
        labels: [],
        comments: 0,
        createdAt: at,
        updatedAt: at,
      };
    });
    const pullRequest: GithubPullRequest = {
      number: 30001,
      title: 'Tighten the upload size limit',
      url: 'https://github.com/mastra-ai/mastra/pull/30001',
      author: 'ana',
      baseBranch: 'main',
      headBranch: 'fix/upload-size',
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
    };
    stubSearchApi({ intake: { issues, pullRequests: [pullRequest] } });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    await within(results).findByText('Flaky check 20');

    // Its row reads "PR Review"; nothing else about it, and nothing about any issue, has the word.
    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'review');

    expect(await within(results).findByRole('option', { name: /not filed/ })).toHaveTextContent(pullRequest.title);
  });

  it.each([
    ['a server that searches the cards itself', false],
    ['a server that sends the whole board whatever is asked', true],
  ])('lists the same cards from %s', async (_server, serverNarrowsBySessionOnly) => {
    stubSearchApi({ serverNarrowsBySessionOnly });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');
    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    const listed = (titles: string[]) =>
      waitFor(() => {
        expect(within(results).getAllByRole('option')).toHaveLength(titles.length);
        for (const title of titles) expect(within(results).getByText(title)).toBeInTheDocument();
      });

    expect(await within(rail).findByRole('button', { name: /^Work items\s*4$/ })).toBeInTheDocument();
    await user.click(within(rail).getByRole('button', { name: /Work items/ }));
    // The cards holding no session and the candidates not filed, each once; no card holding a session.
    await listed([
      'Harden the review board drop target',
      'Rail scopes overflow on narrow viewports',
      'Bump the command palette dependencies',
      'Palette keyboard traps focus on mobile',
    ]);

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'palette');
    await listed(['Bump the command palette dependencies', 'Palette keyboard traps focus on mobile']);
    expect(within(rail).getByRole('button', { name: /^Work items\s*4$/ })).toBeInTheDocument();
  });

  it('keeps search open while choosing a repository for an unattributed work item', async () => {
    const item = {
      ...workItems[3],
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
    const search = await openWithShortcut();
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

  it('opens the session a listed card gained since, instead of starting another', async () => {
    const listed = { ...workItems[3], board: 'custom', metadata: { number: 777 } };
    const cards = [listed];
    const requests = stubSearchApi({ workItems: cards });
    const user = userEvent.setup();
    const { router } = renderSearchRoute();
    const search = await openWithShortcut();
    const row = await within(search).findByText(listed.title);

    // Someone starts work on the card while the palette still lists it as not started.
    cards[0] = {
      ...listed,
      sessions: {
        build: { sessionId: 'session-late', branch: 'factory/late', threadId: 'thread-late', startedBy: 'user-other' },
      },
    };
    await user.click(row);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/factories/${ACTIVE_FACTORY_ID}/workspaces/session-late/threads/thread-late`,
      ),
    );
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
  });

  it('starts a session on a listed card that a later update pushed out of the search', async () => {
    const cards: WorkItem[] = Array.from({ length: 21 }, (_, index) => ({
      ...unstartedCard(`backlog-${index}`, `Backlog chore ${index}`, `2026-07-${String(index + 1).padStart(2, '0')}`),
      board: 'custom',
      metadata: { repository: 'mastra-ai/mastra' },
    }));
    stubSearchApi({ workItems: cards });
    const starts: unknown[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/runs/start`, async ({ request }) => {
        starts.push(await request.json());
        return HttpResponse.json({ threadId: 'thread-search' });
      }),
    );
    const user = userEvent.setup();
    renderSearchRoute();
    const search = await openWithShortcut();
    // The last of the 20 the search lists.
    const row = await within(search).findByText('Backlog chore 1');

    // Another card is touched since: the search would now list it in this one's place.
    cards[0] = { ...cards[0], updatedAt: '2026-08-01T10:00:00.000Z' };
    await user.click(row);

    await waitFor(() =>
      expect(starts).toEqual([expect.objectContaining({ workItem: expect.objectContaining({ id: 'backlog-1' }) })]),
    );
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
  });

  // Technical: a server older than `workItemId` ignores it and sends the whole board, which holds the card.
  it('starts a session on the card clicked when the server sends the whole board whatever is asked', async () => {
    const cards: WorkItem[] = ['first', 'second', 'third'].map((name, index) => ({
      ...unstartedCard(`backlog-${name}`, `Backlog chore ${name}`, `2026-07-0${3 - index}`),
      board: 'custom',
      metadata: { repository: 'mastra-ai/mastra' },
    }));
    stubSearchApi({ workItems: cards, serverNarrowsBySessionOnly: true });
    const starts: unknown[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/runs/start`, async ({ request }) => {
        starts.push(await request.json());
        return HttpResponse.json({ threadId: 'thread-search' });
      }),
    );
    const user = userEvent.setup();
    renderSearchRoute();
    const search = await openWithShortcut();

    await user.click(await within(search).findByText('Backlog chore third'));

    await waitFor(() =>
      expect(starts).toEqual([expect.objectContaining({ workItem: expect.objectContaining({ id: 'backlog-third' }) })]),
    );
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
  });

  it('says a listed card was deleted since, and starts nothing on it', async () => {
    const cards: WorkItem[] = [
      {
        ...unstartedCard('deleted-since', 'Card someone deletes', '2026-07-01'),
        board: 'custom',
        metadata: { repository: 'mastra-ai/mastra' },
      },
    ];
    const requests = stubSearchApi({ workItems: cards });
    const starts: unknown[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/runs/start`, async ({ request }) => {
        starts.push(await request.json());
        return HttpResponse.json({ threadId: 'thread-search' });
      }),
    );
    const user = userEvent.setup();
    renderSearchRoute();
    const search = await openWithShortcut();
    const row = await within(search).findByText('Card someone deletes');

    cards.length = 0;
    await user.click(row);

    expect(await screen.findByText(/This card no longer exists/)).toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
    expect(starts).toEqual([]);
  });

  it('reports a session failure while retaining navigation and Factories, then recovers on retry', async () => {
    const requests = stubSearchApi({ failSessionAttempts: 2 });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();

    expect(await screen.findByText('Sessions could not be loaded.')).toBeInTheDocument();
    expect(within(dialog).getByText('Mastra Factory')).toBeInTheDocument();
    expect(requests.sessionRequests[ACTIVE_FACTORY_ID]).toBe(2);

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(requests.sessionRequests[ACTIVE_FACTORY_ID]).toBe(3));
    expect(await screen.findByText('Review command palette PR')).toBeInTheDocument();
    expect(screen.queryByText('Sessions could not be loaded.')).not.toBeInTheDocument();
  });

  // Technical: with no candidate the filed-cards lookup is disabled, and refetching it fails for good.
  it('recovers from a failed read of the session cards on retry when the intake offers nothing', async () => {
    stubSearchApi({ failSessionCardAttempts: 1, intake: { issues: [], pullRequests: [] } });
    const user = userEvent.setup();
    renderSearchRoute();
    await openWithShortcut();

    expect(await screen.findByText(/^Board cards could not be loaded/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/ }));

    expect(await screen.findByText('Add universal command search')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/^Board cards could not be loaded/)).not.toBeInTheDocument());
    expect(screen.getByText('Bump the command palette dependencies')).toBeInTheDocument();
  });

  it('keeps branch-based review results when work-item enrichment fails', async () => {
    stubSearchApi({ failWorkItems: true });
    renderSearchRoute();
    await openWithShortcut();
    expect(await screen.findByRole('option', { name: /factory\/pr-900/ })).toBeInTheDocument();
    expect(await screen.findByText(/^Board cards could not be loaded/)).toBeInTheDocument();
  });

  it('searches GitLab issue and MR intake for a GitLab-linked repository without querying GitHub intake', async () => {
    const requests = stubSearchApi();
    let githubIntakeRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        projectListResponse({
          ...factoryRepositories,
          [ACTIVE_FACTORY_ID]: [{ ...factoryRepositories[ACTIVE_FACTORY_ID][0], integrationId: 'gitlab' }],
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
    await openWithShortcut();

    expect(await screen.findByText('Search GitLab issue')).toBeInTheDocument();
    const mr = await screen.findByText('Search GitLab MR');
    expect(githubIntakeRequests).toBe(0);

    await userEvent.click(mr);
    await waitFor(() => expect(requests.transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(requests.created).toEqual([
      expect.objectContaining({
        title: 'Search GitLab MR',
        board: 'work',
        stages: ['intake'],
        externalSource: expect.objectContaining({ integrationId: 'gitlab', type: 'pull-request' }),
      }),
    ]);
    expect(requests.transitions[0]).toMatchObject({
      itemId: 'work-item-filed',
      body: { board: 'work', stage: 'pr-review' },
    });
  });

  it('tells apart the sessions one card holds on its branch by the phase each runs, current first', async () => {
    const [searchItem] = workItems;
    const [workSession] = sessionsByRepository[FIRST_REPOSITORY_ID];
    const triageSession = { ...workSession, id: 'row-session-triage', sessionId: 'session-triage' };
    stubSearchApi({
      sessions: { ...sessionsByRepository, [FIRST_REPOSITORY_ID]: [triageSession, workSession] },
      workItems: [
        {
          ...searchItem,
          stageHistory: [
            {
              stage: 'triage',
              enteredAt: '2026-07-29T10:00:00.000Z',
              exitedAt: '2026-07-29T11:00:00.000Z',
              by: 'user-search',
            },
          ],
          sessions: {
            triage: { ...searchItem.sessions.build, sessionId: 'session-triage', threadId: 'thread-triage' },
            work: searchItem.sessions.build,
          },
        },
        ...workItems.slice(1),
      ],
    });
    const user = userEvent.setup();
    renderSearchRoute();
    await openWithShortcut();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'universal 321');

    const options = await screen.findAllByRole('option', { name: /Add universal command search/ });
    expect(options).toHaveLength(2);
    expect(within(options[0]).getByText('Work')).toBeInTheDocument();
    expect(within(options[0]).getByText('current')).toBeInTheDocument();
    expect(within(options[1]).getByText('Triage')).toBeInTheDocument();
    expect(within(options[1]).queryByText('current')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('combobox', { name: 'Search MastraCode' }));
    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'triage 321');
    const triageOnly = await screen.findAllByRole('option', { name: /Add universal command search/ });
    expect(triageOnly).toHaveLength(1);
    expect(within(triageOnly[0]).getByText('Triage')).toBeInTheDocument();
  });

  it.each(['#900', '900', 'PR #900'])('finds the review session by GitHub identifier "%s"', async query => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
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
    await openWithShortcut();
    await screen.findByRole('option', { name: /factory\/pr-900/ });

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#900');

    expect(await screen.findByRole('option', { name: /factory\/pr-900/ })).toBeInTheDocument();
    expect(screen.queryByText('feature/offline-index')).not.toBeInTheDocument();
  });

  it('finds a board card with no session by identifier and moves it into its lane', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    expect(await within(rail).findByRole('button', { name: /^Work items\s*4$/ })).toBeInTheDocument();

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
      body: { board: 'work', stage: 'pr-review', cause: 'card_action' },
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
    await openWithShortcut();
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
    await openWithShortcut();
    await screen.findByText('Review command palette PR');
    await waitFor(() => expect(client.isFetching()).toBe(0));

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    await user.click(await screen.findByText('Bump the command palette dependencies'));

    expect(await screen.findByText("Another run can't start while this card is busy.")).toBeInTheDocument();
    expect(requests.transitions).toEqual([]);
  });

  it('refuses to open a session on a custom-board card while automation is already starting a run on it', async () => {
    const item = { ...workItems[3], board: 'custom', metadata: { number: 777 } };
    const requests = stubSearchApi({ workItems: [item] });
    stubAutomationStartingRunOn(item.id);
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    const search = await openWithShortcut();
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
      await openWithShortcut();
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
    const item = { ...workItems[3], board: 'custom', metadata: { number: 777 } };
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
    const search = await openWithShortcut();
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
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    await user.click(within(rail).getByRole('button', { name: /Work items/ }));

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
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#20454');
    const candidate = await within(dialog).findByRole('option', { name: /Harden the review board drop target/ });
    expect(within(candidate).getByText('Intake')).toBeInTheDocument();
    expect(within(candidate).getByText('not filed')).toBeInTheDocument();

    await user.click(candidate);

    await waitFor(() => expect(requests.transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(requests.created).toEqual([
      expect.objectContaining({ title: 'Harden the review board drop target', board: 'work', stages: ['intake'] }),
    ]);
    expect(requests.transitions[0]).toMatchObject({
      itemId: 'work-item-filed',
      body: { board: 'work', stage: 'pr-review' },
    });
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
  });

  it('stays open, and files nothing, when a candidate is picked before the board catalog is available', async () => {
    const requests = stubSearchApi();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/boards`, () =>
        HttpResponse.json({ error: 'unavailable' }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#20454');
    await user.click(await within(dialog).findByRole('option', { name: /Harden the review board drop target/ }));

    expect(await screen.findByText('The board is still loading. Try again in a moment.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Global search' })).toBeInTheDocument();
    expect(requests.created).toEqual([]);
    expect(requests.transitions).toEqual([]);
  });

  it('files a candidate in the initial phase of a default board that has no move for it', async () => {
    const requests = stubSearchApi();
    const { flow: _flow, ...noLoop } = workBoardInfo;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/boards`, () =>
        HttpResponse.json({ boards: [{ ...noLoop, flow: { completed: 'done' } }] }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#20454');
    await user.click(await within(dialog).findByRole('option', { name: /Harden the review board drop target/ }));

    await waitFor(() => expect(requests.created).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(requests.created[0]).toMatchObject({ board: 'work', stages: ['intake'] });
    // This stub answers with a card elsewhere, so the board may put it back; it never moves it on.
    expect(requests.transitions.map(({ body }) => body.stage).filter(stage => stage !== 'intake')).toEqual([]);
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
  });

  // A card in more than one phase sits in its furthest one, as its card label says.
  it.each([[['planning']], [['triage', 'planning']]])(
    "starts a card with no session in %j from the phase it sits in, not its board's first phase",
    async stages => {
      const planning = { ...workItems.find(item => item.id === 'work-item-unstarted-issue')!, stages };
      const requests = stubSearchApi({ workItems: [planning] });
      const user = userEvent.setup();
      renderSearchRoute();
      await openWithShortcut();

      await user.click(await screen.findByText('Palette keyboard traps focus on mobile'));

      await waitFor(() => expect(requests.transitions).toHaveLength(1));
      expect(requests.transitions[0]).toMatchObject({
        itemId: 'work-item-unstarted-issue',
        body: { stage: 'planning' },
      });
    },
  );

  it('lists a pull request already filed as a card only once', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#900');

    const results = within(dialog).getByRole('region', { name: 'Search results' });
    await waitFor(() => expect(within(results).getAllByRole('option')).toHaveLength(1));
    expect(within(results).getByText('Review Sessions')).toBeInTheDocument();
  });

  it('reads the intake feeds once and sends no further request while it stays open and idle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const requests = stubSearchApi();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    expect(await within(dialog).findByText('Harden the review board drop target')).toBeInTheDocument();
    const read = requests.intakeRequests;
    expect(read).toBeGreaterThan(0);

    // Two minutes: four of the 30 second polls the feeds used to run.
    await vi.advanceTimersByTimeAsync(2 * 60_000);

    expect(requests.intakeRequests).toBe(read);
  });

  it('keeps board cards searchable when the GitHub intake feeds fail', async () => {
    stubSearchApi({ failIntake: true });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();

    expect(await screen.findByText('Bump the command palette dependencies')).toBeInTheDocument();
    expect(await screen.findByText('Intake could not be loaded.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Harden the review board drop target')).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    expect(await screen.findByText('Bump the command palette dependencies')).toBeInTheDocument();
  });

  it('runs no session request for a Factory with no linked repository', async () => {
    const requests = stubSearchApi({ activeFactoryHasRepositories: false });
    renderSearchRoute();
    const dialog = await openWithShortcut();
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    expect(within(results).getByText('Navigation')).toBeInTheDocument();
    expect(within(results).getByText('Factories')).toBeInTheDocument();
    expect(Object.values(requests.sessionRequests)).toHaveLength(0);
    expect(requests.workItemQueries).toHaveLength(0);
    expect(requests.intakeRequests).toBe(0);
  });

  it('keeps the sessions request alive when the notification observer also consumes it', async () => {
    let releaseSessions = () => {};
    const sessionsGate = new Promise<void>(resolve => {
      releaseSessions = resolve;
    });
    const onAbort = vi.fn();
    const requests = stubSearchApi({ sessionsGate, onSessionsAbort: onAbort });
    const user = userEvent.setup();
    renderSearchRoute();

    await openWithShortcut();
    await waitFor(() => expect(requests.sessionRequests[ACTIVE_FACTORY_ID]).toBe(1));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onAbort).not.toHaveBeenCalled();
    releaseSessions();
  });

  it('finds Memory settings by the former page name "personal memory"', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'personal memory');

    expect(await within(dialog).findByText('Memory')).toBeInTheDocument();
  });

  it('selects Settings with origin state and closes without creating a session', async () => {
    const requests = stubSearchApi();
    const origin = `/factories/${ACTIVE_FACTORY_ID}/settings/preferences`;
    const user = userEvent.setup();
    const { router } = renderSearchRoute(origin);
    const dialog = await openWithShortcut();

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
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    await user.click(within(dialog).getByRole('option', { name: name => name.startsWith(title) }));

    await waitFor(() => expect(router.state.location.pathname).toBe(path));
    if (preservesOrigin) expectOriginPathname(router.state.location.state, origin);
    else expect(router.state.location.state).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    expect(requests.createSessionRequests).toBe(0);
  });

  it('closes from a busy chat route, restores the prior focus, and does not abort the run', async () => {
    const requests = stubSearchApi({ running: true });
    const user = userEvent.setup();
    renderSearchRoute(`/factories/${ACTIVE_FACTORY_ID}/workspaces/session-work/threads/thread-work-linked`);

    await waitForTheChatFrameToSettleOnALiveRun();

    const sidebar = screen.getByRole('complementary', { name: 'Main sidebar' });
    const focusedBeforeSearch = await within(sidebar).findByRole('link', { name: /^Work/ });
    act(() => focusedBeforeSearch.focus());
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument());
    await waitFor(() => expect(focusedBeforeSearch).toHaveFocus());
    expect(requests.abortRequests).toBe(0);
  });

  it('aborts a busy run when Escape is pressed while typing in the composer', async () => {
    const requests = stubSearchApi({ running: true });
    const user = userEvent.setup();
    renderSearchRoute(`/factories/${ACTIVE_FACTORY_ID}/workspaces/session-work/threads/thread-work-linked`);
    await screen.findByRole('button', { name: 'Abort' }, { timeout: 5_000 });

    await user.click(screen.getByRole('textbox', { name: 'Message' }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(requests.abortRequests).toBe(1));
  });

  it('types "?" in the composer instead of opening the shortcuts help', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute(`/factories/${ACTIVE_FACTORY_ID}/workspaces/session-work/threads/thread-work-linked`);
    const composer = await screen.findByRole('textbox', { name: 'Message' }, { timeout: 5_000 });

    await user.click(composer);
    await user.keyboard('?');

    expect(composer).toHaveValue('?');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});
