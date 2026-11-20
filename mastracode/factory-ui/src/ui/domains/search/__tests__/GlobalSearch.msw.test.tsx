import type { ProjectListRepository } from '@mastra/factory/routes/contracts';
import type { FactoryTransitionResultRejected } from '@mastra/factory/rules/types';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isStubbedProjectRead } from '../../../../../e2e/ui/board-reads';
import { server } from '../../../../../e2e/ui/msw-server';
import { recordProviderListRequests } from '../../../../../e2e/ui/provider-list-requests';
import { workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { createQueryClient } from '../../../../query-client';
import type { WorkItem } from '../../factory/services/workItems';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { createAppRoutes } from '../../../router';
import {
  ACTIVE_FACTORY_ID,
  factoryProjects,
  factoryRepositories,
  FIRST_REPOSITORY_ID,
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
  created: Record<string, unknown>[];
  transitions: Array<{ itemId: string; body: Record<string, unknown> }>;
  providerListRequests: string[];
  sessionRequests: Record<string, number>;
  /** The query string of each read of the card list; `''` is a read of the whole board. */
  workItemQueries: string[];
}

interface StubSearchOptions {
  activeFactoryHasRepositories?: boolean;
  failSessionAttempts?: number;
  /** How many reads of the cards holding a session fail before one answers. */
  failSessionCardAttempts?: number;
  failWorkItems?: boolean;
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
  return options.activeFactoryHasRepositories === false ? [] : factoryRepositories[ACTIVE_FACTORY_ID];
}

const noFeedStream = http.get(
  `${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/feed-events`,
  () => new HttpResponse(null, { status: 404 }),
);

function stubSearchApi(options: StubSearchOptions = {}): SearchRequestState {
  const state: SearchRequestState = {
    abortRequests: 0,
    createSessionRequests: 0,
    created: [],
    transitions: [],
    providerListRequests: recordProviderListRequests(),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${ACTIVE_FACTORY_ID}/work-items/:itemId/session-repository`, () =>
      HttpResponse.json({ status: 'unlinked', hint: 'No repository in this search stub.' }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId`, ({ params }) => {
      const project = factoryProjects.find(candidate => candidate.id === String(params.factoryProjectId));
      return project
        ? HttpResponse.json({ project })
        : HttpResponse.json({ error: 'Factory not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, ({ params, request }) => {
      const query = new URL(request.url).searchParams;
      const appRead = !isStubbedProjectRead(request);
      if (appRead) state.workItemQueries.push(query.toString());
      if (appRead && options.failWorkItems) {
        return HttpResponse.json({ error: 'work items unavailable' }, { status: 500 });
      }
      const sessionCardReads = state.workItemQueries.filter(asked => asked === 'scope=sessions').length;
      if (appRead && query.get('scope') === 'sessions' && sessionCardReads <= (options.failSessionCardAttempts ?? 0)) {
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/sessions`, async ({ params, request }) => {
      const factoryProjectId = String(params.factoryProjectId);
      if (!isStubbedProjectRead(request)) {
        state.sessionRequests[factoryProjectId] = (state.sessionRequests[factoryProjectId] ?? 0) + 1;
        if (options.sessionsGate) {
          request.signal.addEventListener('abort', () => options.onSessionsAbort?.(), { once: true });
          await options.sessionsGate;
        }
        if (state.sessionRequests[factoryProjectId] <= (options.failSessionAttempts ?? 0)) {
          return HttpResponse.json({ error: 'sessions unavailable' }, { status: 500 });
        }
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

function renderSearchRoute(initialEntry = `/factories/${ACTIVE_FACTORY_ID}/settings/account`) {
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
  vi.restoreAllMocks();
});

describe('Global search', () => {
  it('opens with Mod+K on the labeled, focused command input and hands focus back on close', async () => {
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();

    await screen.findByRole('heading', { name: 'My account' });
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

  it('hands focus back to the menu button when search opened from the phone sidebar closes', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();

    await user.click(await screen.findByRole('button', { name: 'Open navigation menu' }, { timeout: 5_000 }));
    const navigation = await screen.findByRole('dialog', { name: 'Navigation' });
    await user.click(within(navigation).getByRole('button', { name: 'Search and navigate' }));
    await screen.findByRole('dialog', { name: 'Global search' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus());
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
      'My account',
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

  it('given open issues and pull requests with no card, when searching, then it asks for cards only and never for a provider list', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await within(dialog).findByText('Review command palette PR');

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'universal');
    expect(await within(dialog).findByText('Add universal command search')).toBeInTheDocument();
    await waitFor(() => expect(requests.workItemQueries).toContain('started=false&q=universal'));

    expect(requests.providerListRequests).toEqual([]);
    expect(requests.workItemQueries.filter(query => query.startsWith('source='))).toEqual([]);
    expect(within(dialog).queryByText('not filed')).not.toBeInTheDocument();
  });

  it('reads its sessions and the cards holding them once when it opens, never the board', async () => {
    const requests = stubSearchApi();
    renderSearchRoute();

    await openWithShortcut();
    await screen.findByText('Review command palette PR');
    await screen.findByText('Bump the command palette dependencies');

    expect(requests.sessionRequests).toEqual({ [ACTIVE_FACTORY_ID]: 1 });
    expect(requests.workItemQueries.toSorted()).toEqual(['scope=sessions', 'started=false&q=']);
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

    expect(await within(rail).findByRole('button', { name: /^Work items\s*25$/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Backlog chore 23')).toBeInTheDocument();
    expect(within(dialog).queryByText('Rotate the signing keys')).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'SIGNING rotate');

    expect(await within(dialog).findByText('Rotate the signing keys')).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /^Work items\s*25$/ })).toBeInTheDocument();
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
    const pullRequest = {
      number: 20454,
      title: 'Harden the review board drop target',
      url: 'https://github.com/mastra-ai/mastra/pull/20454',
    };
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

    expect(await within(rail).findByRole('button', { name: /^Work items\s*25$/ })).toBeInTheDocument();
    expect(await within(results).findByText('Backlog chore 23')).toBeInTheDocument();
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

    expect(await within(rail).findByRole('button', { name: /^Work items\s*2$/ })).toBeInTheDocument();
    await user.click(within(rail).getByRole('button', { name: /Work items/ }));
    // The cards holding no session, each once; no card holding a session.
    await listed(['Bump the command palette dependencies', 'Palette keyboard traps focus on mobile']);

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), 'palette');
    await listed(['Bump the command palette dependencies', 'Palette keyboard traps focus on mobile']);
    expect(within(rail).getByRole('button', { name: /^Work items\s*2$/ })).toBeInTheDocument();
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

  it('opens the draft of a listed card that a later update pushed out of the search', async () => {
    const cards: WorkItem[] = Array.from({ length: 21 }, (_, index) => ({
      ...unstartedCard(`backlog-${index}`, `Backlog chore ${index}`, `2026-07-${String(index + 1).padStart(2, '0')}`),
      board: 'custom',
      metadata: { repository: 'mastra-ai/mastra' },
    }));
    const requests = stubSearchApi({ workItems: cards });
    const user = userEvent.setup();
    const { router } = renderSearchRoute();
    const search = await openWithShortcut();
    // The last of the 20 the search lists.
    const row = await within(search).findByText('Backlog chore 1');

    // Another card is touched since: the search would now list it in this one's place.
    cards[0] = { ...cards[0], updatedAt: '2026-08-01T10:00:00.000Z' };
    await user.click(row);

    expect(await screen.findByRole('heading', { level: 2, name: 'Backlog chore 1' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(new RegExp(`^/factories/${ACTIVE_FACTORY_ID}/cards/backlog-1/new/`));
    expect(requests.createSessionRequests).toBe(0);
  });

  // Technical: a server older than `workItemId` ignores it and sends the whole board, which holds the card.
  it('opens the draft of the card clicked when the server sends the whole board whatever is asked', async () => {
    const cards: WorkItem[] = ['first', 'second', 'third'].map((name, index) => ({
      ...unstartedCard(`backlog-${name}`, `Backlog chore ${name}`, `2026-07-0${3 - index}`),
      board: 'custom',
      metadata: { repository: 'mastra-ai/mastra' },
    }));
    stubSearchApi({ workItems: cards, serverNarrowsBySessionOnly: true });
    const user = userEvent.setup();
    renderSearchRoute();
    const search = await openWithShortcut();

    await user.click(await within(search).findByText('Backlog chore third'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Backlog chore third' })).toBeInTheDocument();
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
    const requests = stubSearchApi({ failSessionAttempts: 1 });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();

    expect(await screen.findByText('Sessions could not be loaded.')).toBeInTheDocument();
    expect(within(dialog).getByText('Mastra Factory')).toBeInTheDocument();
    expect(requests.sessionRequests[ACTIVE_FACTORY_ID]).toBe(1);

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(requests.sessionRequests[ACTIVE_FACTORY_ID]).toBe(2));
    expect(await screen.findByText('Review command palette PR')).toBeInTheDocument();
    expect(screen.queryByText('Sessions could not be loaded.')).not.toBeInTheDocument();
  });

  // Technical: with no candidate the filed-cards lookup is disabled, and refetching it fails for good.
  it('recovers from a failed read of the session cards on retry when the intake offers nothing', async () => {
    stubSearchApi({ failSessionCardAttempts: 1 });
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

  it('finds a board card with no session by identifier and opens it, moving nothing', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    const { router } = renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');

    const rail = screen.getByRole('complementary', { name: 'Search categories' });
    expect(await within(rail).findByRole('button', { name: /^Work items\s*2$/ })).toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Search MastraCode' }), '#4242');
    const card = await screen.findByText('Bump the command palette dependencies');
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    expect(within(results).getByText('Work Items')).toBeInTheDocument();
    expect(screen.queryByText('Palette keyboard traps focus on mobile')).not.toBeInTheDocument();

    await user.click(card);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Bump the command palette dependencies' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(
      new RegExp(`^/factories/${ACTIVE_FACTORY_ID}/cards/work-item-unstarted-review/new/`),
    );
    expect(requests.transitions).toEqual([]);
    expect(requests.createSessionRequests).toBe(0);
  });

  it('finds the card a pasted link names, whatever page of the pull request the link opens', async () => {
    const requests = stubSearchApi();
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');
    const input = screen.getByRole('combobox', { name: 'Search MastraCode' });
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    // A card holding a session: the palette reads it itself.
    await user.type(input, 'https://github.com/mastra-ai/mastra/pull/900/files#diff-1a2b');
    expect(await within(results).findByText('Review command palette PR')).toBeInTheDocument();
    expect(within(results).queryByText('Add universal command search')).not.toBeInTheDocument();

    // A card holding none: the server finds it, and the palette keeps it.
    await user.clear(input);
    await user.type(input, 'GitHub.com/Mastra-AI/mastra/pull/4242?tab=checks');
    expect(await within(results).findByText('Bump the command palette dependencies')).toBeInTheDocument();
    expect(within(results).queryByText('Review command palette PR')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(requests.workItemQueries).toContain(
        // Asked lowercased: the server reads it so, and `GitHub.com` and `github.com` share one answer.
        `started=false&q=${encodeURIComponent('github.com/mastra-ai/mastra/pull/4242?tab=checks')}`,
      ),
    );

    // A link names its own number, never one it starts.
    await user.clear(input);
    await user.type(input, 'https://github.com/mastra-ai/mastra/pull/42');
    expect(await within(dialog).findByText('No matching results.')).toBeInTheDocument();
  });

  it('keeps the cards the server’s search finds by what their rows do not show, and no other', async () => {
    // A pull request opened from a card's session rides on the card: its key, link and branch are the card's too.
    const attachPullRequest = (item: WorkItem, number: number, headBranch: string): WorkItem => {
      const source = (sourceType: string, key: string, url: string, metadata: Record<string, unknown>) => ({
        id: `${item.id}:${key}`,
        workItemId: item.id,
        provider: 'github' as const,
        integrationId: 'github',
        sourceType,
        workspaceId: null,
        externalId: key,
        sourceKey: null,
        key,
        url,
        state: 'open',
        labels: [],
        author: null,
        metadata,
        revision: 1,
        syncedAt: null,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      });
      return {
        ...item,
        workItem: {
          provider: 'github',
          key: null,
          url: item.url,
          title: item.title,
          state: 'open',
          labels: [],
          author: null,
          metadata: item.metadata,
          sources: [
            source('issue', `mastra-ai/mastra#${String(item.metadata.number)}`, item.url ?? '', item.metadata),
            source('pull-request', `mastra-ai/mastra#${number}`, `https://github.com/mastra-ai/mastra/pull/${number}`, {
              githubPullRequestNumber: number,
              headBranch,
            }),
          ],
        },
      };
    };
    const withSession = workItems.find(item => item.id === 'work-item-search')!;
    const unstarted = workItems.find(item => item.id === 'work-item-unstarted-issue')!;
    stubSearchApi({
      workItems: workItems.map(item =>
        item === withSession
          ? attachPullRequest(item, 5150, 'octo.cat/command-search')
          : item === unstarted
            ? attachPullRequest(item, 7070, 'palette-focus')
            : item,
      ),
    });
    const user = userEvent.setup();
    renderSearchRoute();
    const dialog = await openWithShortcut();
    await screen.findByText('Review command palette PR');
    const input = screen.getByRole('combobox', { name: 'Search MastraCode' });
    const results = within(dialog).getByRole('region', { name: 'Search results' });
    const search = async (typed: string) => {
      await user.clear(input);
      await user.type(input, typed);
    };

    for (const typed of ['5150', 'octo.cat/command-search', 'https://github.com/mastra-ai/mastra/pull/5150/files']) {
      await search(typed);
      expect(await within(results).findByText('Add universal command search')).toBeInTheDocument();
      expect(within(results).queryByText('Review command palette PR')).not.toBeInTheDocument();
    }

    // A card nobody started is found by the server, and its row stays.
    for (const typed of ['7070', 'work-item-unstarted-issue']) {
      await search(typed);
      expect(await within(results).findByText('Palette keyboard traps focus on mobile')).toBeInTheDocument();
    }

    // The card answers the second link only; the first is in it as text, and still finds nothing.
    await search('https://github.com/mastra-ai/mastra/pull/515 https://github.com/mastra-ai/mastra/pull/5150');
    expect(await within(dialog).findByText('No matching results.')).toBeInTheDocument();
    expect(within(results).queryByText('Add universal command search')).not.toBeInTheDocument();
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
    expect(within(dialog).queryByText('Harden the review board drop target')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Rail scopes overflow on narrow viewports')).not.toBeInTheDocument();
    expect(screen.queryByText('Review command palette PR')).not.toBeInTheDocument();
    expect(screen.queryByText('research-notes')).not.toBeInTheDocument();
  });

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

  it('runs no session request for a Factory with no linked repository', async () => {
    const requests = stubSearchApi({ activeFactoryHasRepositories: false });
    renderSearchRoute();
    const dialog = await openWithShortcut();
    const results = within(dialog).getByRole('region', { name: 'Search results' });

    expect(within(results).getByText('Navigation')).toBeInTheDocument();
    expect(within(results).getByText('Factories')).toBeInTheDocument();
    expect(Object.values(requests.sessionRequests)).toHaveLength(0);
    expect(requests.workItemQueries).toHaveLength(0);
    expect(requests.providerListRequests).toEqual([]);
  });

  it('cancels its read of the sessions when the dialog closes, as nothing else on the page reads them', async () => {
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
    await waitFor(() => expect(onAbort).toHaveBeenCalledOnce());
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
    const origin = `/factories/${ACTIVE_FACTORY_ID}/settings/account`;
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
    const origin = `/factories/${ACTIVE_FACTORY_ID}/settings/account`;
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
