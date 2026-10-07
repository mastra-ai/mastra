import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useStartFactoryRun, type StartFactoryRunWorkItem } from '../useStartFactoryRun';

const FACTORY_ID = 'fp-1';

function RouteInner({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}`]}>
      <Routes>
        <Route path="/factories/:factoryId" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

function stubEndpoints(
  repositories: Array<{ id: string; externalId: string; slug: string; provider?: 'github' | 'gitlab' }>,
) {
  const sessionsCreatedFor: string[] = [];
  const patches: Array<Record<string, unknown>> = [];
  let started: Record<string, unknown> | undefined;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: repositories.map(repository => ({
          id: `conn-${repository.id}`,
          installationId: `inst-${repository.id}`,
          integrationId: repository.provider ?? 'github',
          repositories: [
            {
              id: repository.id,
              branch: 'main',
              sandboxWorkdir: '/repo',
              repository: { externalId: repository.externalId, slug: repository.slug, defaultBranch: 'main' },
            },
          ],
        })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: { github: { enabled: true, sourceIds: [] }, linear: { enabled: false } } }),
    ),
    http.patch(`${TEST_BASE_URL}/web/factory/work-items/:id`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      return HttpResponse.json({
        workItem: {
          id: 'item-1',
          factoryProjectId: FACTORY_ID,
          externalSource: null,
          title: 'Fix login bug',
          stages: ['intake'],
          stageHistory: [],
          sessions: {},
          metadata: body.metadata,
          revision: 2,
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:00.000Z',
        },
      });
    }),
    http.post(`${TEST_BASE_URL}/web/source-control/projects/:projectRepositoryId/sessions`, ({ params }) => {
      sessionsCreatedFor.push(String(params.projectRepositoryId));
      return HttpResponse.json({ session: { sessionId: 'session-1', branch: 'factory/item-1', title: null } });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      started = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ prepared: { threadId: 'thread-1' } });
    }),
  );
  return { sessionsCreatedFor, patches, started: () => started };
}

const workItem: StartFactoryRunWorkItem = {
  id: 'item-1',
  role: 'work',
  source: 'github-issue' as const,
  sourceKey: 'github-issue:7',
  title: 'Fix login bug',
  // The card was filed before the repository was renamed from acme/old-name.
  metadata: { number: 7, repository: 'acme/old-name', githubRepositoryId: 101 },
};

describe.each(['github', 'gitlab'] as const)('useStartFactoryRun with %s', provider => {
  it.each([
    ['a single linked repository', [{ id: 'repo-1', externalId: '101', slug: 'acme/renamed' }]],
    [
      'several linked repositories',
      [
        { id: 'repo-2', externalId: '202', slug: 'acme/other' },
        { id: 'repo-1', externalId: '101', slug: 'acme/renamed' },
      ],
    ],
  ])('starts a renamed repository card by its provider id with %s', async (_label, repositories) => {
    const providerWorkItem: StartFactoryRunWorkItem = {
      ...workItem,
      source: provider === 'github' ? 'github-issue' : 'gitlab-issue',
      sourceKey: `${provider}-issue:7`,
      metadata: {
        number: 7,
        repository: 'acme/old-name',
        ...(provider === 'github' ? { githubRepositoryId: 101 } : { gitlabProjectId: '101' }),
      },
    };
    const calls = stubEndpoints(repositories.map(repository => ({ ...repository, provider })));
    const { result } = renderHookWithProviders(() => useStartFactoryRun(), { inner: RouteInner });
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await result.current.start.mutateAsync({
      branch: 'factory/item-1',
      threadTitle: 'Fix login bug',
      workItem: providerWorkItem,
    });

    expect(calls.sessionsCreatedFor).toEqual(['repo-1']);
    expect(calls.patches).toEqual([{ metadata: { ...providerWorkItem.metadata, repository: 'acme/renamed' } }]);
    const startedWorkItem = calls.started()?.workItem as { input: { metadata: Record<string, unknown> } };
    expect(startedWorkItem.input.metadata.repository).toBe('acme/renamed');
  });
});

describe('useStartFactoryRun in a mixed-provider factory', () => {
  describe.each(['github', 'gitlab'] as const)('a %s card with both provider ids', provider => {
    it.each(['both match', 'only the other provider matches'])(
      'creates the session in the source provider when %s',
      async matchCase => {
        const otherProvider = provider === 'github' ? 'gitlab' : 'github';
        const targetSlug = `acme/${provider}-renamed`;
        const providerWorkItem: StartFactoryRunWorkItem = {
          ...workItem,
          source: provider === 'github' ? 'github-issue' : 'gitlab-issue',
          sourceKey: `${provider}-issue:7`,
          metadata: {
            ...workItem.metadata,
            repository: matchCase === 'both match' ? 'acme/old-name' : targetSlug,
            githubRepositoryId: 101,
            gitlabProjectId: '101',
          },
        };
        const calls = stubEndpoints([
          { id: 'other-repo', provider: otherProvider, externalId: '101', slug: `acme/${otherProvider}` },
          {
            id: 'source-repo',
            provider,
            externalId: matchCase === 'both match' ? '101' : '999',
            slug: targetSlug,
          },
        ]);
        const { result } = renderHookWithProviders(() => useStartFactoryRun(), { inner: RouteInner });
        await waitFor(() => expect(result.current.enabled).toBe(true));

        await result.current.start.mutateAsync({
          branch: 'factory/item-1',
          threadTitle: 'Fix login bug',
          workItem: providerWorkItem,
        });

        expect(calls.sessionsCreatedFor).toEqual(['source-repo']);
        expect(calls.patches).toEqual(
          matchCase === 'both match' ? [{ metadata: { ...providerWorkItem.metadata, repository: targetSlug } }] : [],
        );
        expect(calls.started()).toMatchObject({
          workItem: { input: { metadata: { ...providerWorkItem.metadata, repository: targetSlug } } },
        });
      },
    );
  });

  it('starts in GitHub when GitLab has the same external id', async () => {
    const calls = stubEndpoints([
      { id: 'gitlab-repo', provider: 'gitlab', externalId: '101', slug: 'acme/gitlab' },
      { id: 'github-repo', provider: 'github', externalId: '101', slug: 'acme/renamed' },
    ]);
    const { result } = renderHookWithProviders(() => useStartFactoryRun(), { inner: RouteInner });
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await result.current.start.mutateAsync({ branch: 'factory/item-1', threadTitle: 'Fix login bug', workItem });

    expect(calls.sessionsCreatedFor).toEqual(['github-repo']);
    expect(calls.patches).toEqual([{ metadata: { ...workItem.metadata, repository: 'acme/renamed' } }]);
  });
});
