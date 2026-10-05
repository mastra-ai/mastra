import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import type {
  GithubIssueDetail,
  GithubIssuePage,
  GithubPullRequestPage,
} from '../../ui/domains/factory/services/factory';
import type { IntakeConfig, IntakeLabelRoute } from '../../ui/domains/factory/services/intake';
import type { WireWorkItem } from '../../ui/domains/factory/services/workItems';
import { repositoryIdForItem } from '../../ui/domains/factory/boardItems';
import { useGitHubIssueDetail } from '../useFactoryData';
import { useWorkItemsQuery } from '../useWorkItems';
import { ApiConfigProvider } from '../../api/config';
import { queryKeys } from '../../api/keys';
import type { FactoryProject } from '../../ui/domains/workspaces/services/github';
import { useRepositoryIntakeSync } from '../useRepositoryIntakeSync';

const baseUrl = 'http://localhost:4111';
const factory: FactoryProject = {
  id: 'factory-a',
  name: 'Multi-repository project',
  repositories: [
    { projectRepositoryId: 'repo-a', slug: 'acme/a' },
    { projectRepositoryId: 'repo-b', slug: 'acme/b' },
    { projectRepositoryId: 'repo-c', slug: 'acme/c' },
    { projectRepositoryId: 'repo-gitlab', slug: 'acme/gitlab', provider: 'gitlab' },
  ],
};
const requests: string[] = [];
let selected: string[] | null;
let enabled: boolean;
let failing: Set<string>;
let routedBoard: string | null;
const handlers = [
  http.get(`${baseUrl}/web/intake/config`, () =>
    HttpResponse.json({ config: { github: { enabled, sourceIds: selected } } satisfies Partial<IntakeConfig> }),
  ),
  http.get(`${baseUrl}/web/intake/label-routes`, () =>
    HttpResponse.json({
      routes: (routedBoard
        ? [{ factoryProjectId: factory.id, integrationId: 'github', label: 'release', board: routedBoard }]
        : []) satisfies IntakeLabelRoute[],
    }),
  ),
  http.get(`${baseUrl}/web/github/projects/:id/:feed`, ({ params, request }) => {
    const page = Number(new URL(request.url).searchParams.get('page'));
    requests.push(`${params.id}/${params.feed}/${page}`);
    if (failing.has(String(params.id))) return HttpResponse.json({ error: 'Unavailable' }, { status: 503 });
    const nextPage = page === 1 ? 2 : null;
    return HttpResponse.json(
      params.feed === 'prs'
        ? ({ pullRequests: [], nextPage } satisfies GithubPullRequestPage)
        : ({ issues: [], nextPage } satisfies GithubIssuePage),
    );
  }),
];
const clients: QueryClient[] = [];
function mount(project = factory, kind = 'work') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiConfigProvider baseUrl={baseUrl}>{children}</ApiConfigProvider>
    </QueryClientProvider>
  );
  return { client, wrapper, ...renderHook(() => useRepositoryIntakeSync(project, kind), { wrapper }) };
}
beforeEach(() => {
  selected = ['acme/a', 'acme/b'];
  enabled = true;
  failing = new Set();
  routedBoard = null;
  server.use(...handlers);
});
afterEach(() => {
  cleanup();
  clients.forEach(client => client.clear());
  clients.length = 0;
  requests.length = 0;
  server.resetHandlers();
  vi.useRealTimers();
});

describe('secondary repository intake', () => {
  it('syncs every page of selected GitHub issues and refreshes only the project board', async () => {
    const { client } = mount();
    client.setQueryData(queryKeys.workItems(factory.id), []);
    client.setQueryData(queryKeys.workItems('other-factory'), []);
    await waitFor(() => expect(requests).toEqual(['repo-b/issues/1', 'repo-b/issues/2']));
    await waitFor(() => expect(client.getQueryState(queryKeys.workItems(factory.id))?.isInvalidated).toBe(true));
    expect(client.getQueryState(queryKeys.workItems('other-factory'))?.isInvalidated).toBe(false);
  });

  it('syncs PRs from every secondary GitHub repository, independently of issue selection', async () => {
    enabled = false;
    selected = null;
    mount(factory, 'review');
    await waitFor(() => expect(requests).toHaveLength(4));
    expect(requests.sort()).toEqual(['repo-b/prs/1', 'repo-b/prs/2', 'repo-c/prs/1', 'repo-c/prs/2']);
  });

  it.each([false, true])('does not sync Work issues with disabled or empty selection (enabled=%s)', async enable => {
    enabled = enable;
    selected = null;
    const { client } = mount();
    await waitFor(() => expect(client.getQueryState(queryKeys.intakeConfig())?.status).toBe('success'));
    expect(requests).toEqual([]);
  });

  it('syncs secondary issues when a custom board has a GitHub label route', async () => {
    routedBoard = 'release';
    mount(factory, 'release');
    await waitFor(() => expect(requests).toEqual(['repo-b/issues/1', 'repo-b/issues/2']));
  });

  it('does not sync a custom board with no GitHub route', async () => {
    const { client } = mount(factory, 'release');
    await waitFor(() => expect(client.getQueryState(queryKeys.intakeLabelRoutes(factory.id))?.status).toBe('success'));
    await waitFor(() => expect(client.getQueryState(queryKeys.intakeConfig())?.status).toBe('success'));
    expect(requests).toEqual([]);
  });

  it('uses each persisted card repository for same-numbered GitHub issue details', async () => {
    const { wrapper } = mount({ ...factory, repositories: [] });
    server.use(
      http.get(`${baseUrl}/web/github/projects/:id/issues/1`, ({ params }) =>
        HttpResponse.json({
          number: 1,
          title: String(params.id),
          description: `Description from ${params.id}`,
          url: 'https://github.com/acme/b/issues/1',
          author: 'alice',
          labels: [],
          comments: 0,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        } satisfies GithubIssueDetail),
      ),
    );
    const { result } = renderHook(
      () => [
        useGitHubIssueDetail(
          repositoryIdForItem(
            {
              source: 'github-issue',
              url: 'https://github.com/acme/a/issues/1',
              metadata: { githubRepositoryId: 101, githubIssueNumber: 1 },
            },
            factory.repositories,
          ),
          1,
        ),
        useGitHubIssueDetail(
          repositoryIdForItem(
            {
              source: 'github-issue',
              url: 'https://github.com/acme/b/issues/1',
              metadata: { githubRepositoryId: 102, githubIssueNumber: 1 },
            },
            factory.repositories,
          ),
          1,
        ),
      ],
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.map(query => query.data?.description)).toEqual([
        'Description from repo-a',
        'Description from repo-b',
      ]),
    );
    expect(repositoryIdForItem({ source: 'manual', url: null, metadata: {} }, factory.repositories)).toBe('repo-a');
    expect(
      repositoryIdForItem(
        {
          source: 'github-issue',
          url: 'https://github.com/acme/unlinked/issues/1',
          metadata: { githubRepositoryId: 103, githubIssueNumber: 1 },
        },
        factory.repositories,
      ),
    ).toBeUndefined();
  });

  it('uses source URLs despite an implementation repository override', () => {
    expect(
      repositoryIdForItem(
        {
          source: 'github-pr',
          url: 'https://github.com/Acme/B/pull/1',
          metadata: { githubRepositoryId: 102, githubPullRequestNumber: 1 },
        },
        factory.repositories,
      ),
    ).toBe('repo-b');
    expect(
      repositoryIdForItem(
        { source: 'github-issue', url: null, metadata: { repository: 'acme/b' } },
        factory.repositories,
      ),
    ).toBeUndefined();
    expect(
      repositoryIdForItem({ source: 'github-issue', url: 'invalid', metadata: {} }, factory.repositories),
    ).toBeUndefined();
    expect(
      repositoryIdForItem(
        {
          source: 'github-issue',
          url: 'https://github.com/acme/b/issues/1',
          metadata: { repository: 'acme/a' },
        },
        factory.repositories,
      ),
    ).toBe('repo-b');
  });

  it('does not duplicate the primary feed or poll a GitLab repository', async () => {
    selected = ['acme/a', 'acme/gitlab'];
    const { client } = mount();
    await waitFor(() => expect(client.getQueryState(queryKeys.intakeConfig())?.status).toBe('success'));
    expect(requests).toEqual([]);
  });

  it('keeps healthy repositories syncing when another fails and supports retry', async () => {
    selected = ['acme/b', 'acme/c'];
    failing.add('repo-b');
    const { result, client } = mount();
    await waitFor(() => expect(result.current.failedRepositories).toEqual(['acme/b']));
    await waitFor(() =>
      expect(client.getQueryState(queryKeys.repositoryIntake(baseUrl, factory.id, 'repo-c', 'work'))?.status).toBe(
        'success',
      ),
    );
    expect(requests).toContain('repo-c/issues/2');
    requests.length = 0;
    failing.clear();
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.failedRepositories).toEqual([]));
    expect(requests).toEqual(['repo-b/issues/1', 'repo-b/issues/2']);
  });

  it('picks up newly selected repositories through the real config query', async () => {
    const { client } = mount();
    await waitFor(() => expect(requests).toContain('repo-b/issues/2'));
    selected = ['acme/c'];
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.intakeConfig() });
    });
    await waitFor(() => expect(requests).toContain('repo-c/issues/2'));
    expect(
      client
        .getQueryCache()
        .find({ queryKey: queryKeys.repositoryIntake(baseUrl, factory.id, 'repo-b', 'work') })
        ?.getObserversCount(),
    ).toBe(0);
  });

  it.each([false, true])('polls healthy feeds every 30 seconds and backs off errors (failed=%s)', async failed => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    if (failed) failing.add('repo-b');
    const { client } = mount();
    const key = queryKeys.repositoryIntake(baseUrl, factory.id, 'repo-b', 'work');
    await vi.waitFor(() => expect(client.getQueryState(key)?.status).toBe(failed ? 'error' : 'success'));
    requests.length = 0;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    if (failed) {
      expect(requests).toEqual([]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(270_000);
      });
      await vi.waitFor(() => expect(requests).toEqual(['repo-b/issues/1']));
    } else {
      await vi.waitFor(() => expect(requests).toEqual(['repo-b/issues/1', 'repo-b/issues/2']));
    }
  });

  it('refetches an active board after the secondary feed ingests cards', async () => {
    let ingested = false;
    const { wrapper } = mount({ ...factory, repositories: [factory.repositories[0]!] });
    server.use(
      http.get(`${baseUrl}/web/github/projects/repo-b/issues`, () => {
        ingested = true;
        return HttpResponse.json({ issues: [], nextPage: null } satisfies GithubIssuePage);
      }),
    );
    server.use(
      http.get(`${baseUrl}/web/factory/projects/${factory.id}/work-items`, () =>
        HttpResponse.json({
          workItems: ingested
            ? [
                {
                  id: 'card-b',
                  factoryProjectId: factory.id,
                  orgId: 'org-a',
                  createdBy: 'alice',
                  title: 'Secondary issue',
                  externalSource: {
                    integrationId: 'github',
                    type: 'issue',
                    externalId: 'github-issue:1',
                    url: 'https://github.com/acme/b/issues/1',
                  },
                  parentWorkItemId: null,
                  stages: ['ready'],
                  stageHistory: [],
                  sessions: {},
                  metadata: {},
                  revision: 1,
                  createdAt: '2026-10-01T00:00:00Z',
                  updatedAt: '2026-10-01T00:00:00Z',
                } satisfies WireWorkItem,
              ]
            : [],
        }),
      ),
    );
    const { result } = renderHook(() => useWorkItemsQuery(factory.id), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    renderHook(() => useRepositoryIntakeSync(factory, 'work'), { wrapper });
    await waitFor(() => expect(result.current.data?.map(card => card.id)).toEqual(['card-b']));
  });
});
