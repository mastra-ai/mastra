import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useStartFactoryRun } from '../useStartFactoryRun';

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

function stubEndpoints(repositories: Array<{ id: string; externalId: string; slug: string }>) {
  const sessionsCreatedFor: string[] = [];
  const patches: Array<Record<string, unknown>> = [];
  let started: Record<string, unknown> | undefined;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: repositories.map(repository => ({
              id: repository.id,
              branch: 'main',
              sandboxWorkdir: '/repo',
              repository: { externalId: repository.externalId, slug: repository.slug, defaultBranch: 'main' },
            })),
          },
        ],
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

const workItem = {
  id: 'item-1',
  role: 'work',
  source: 'github-issue' as const,
  sourceKey: 'github-issue:7',
  title: 'Fix login bug',
  // The card was filed before the repository was renamed from acme/old-name.
  metadata: { number: 7, repository: 'acme/old-name', githubRepositoryId: 101 },
};

describe('useStartFactoryRun', () => {
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
    const calls = stubEndpoints(repositories);
    const { result } = renderHookWithProviders(() => useStartFactoryRun(), { inner: RouteInner });
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await result.current.start.mutateAsync({ branch: 'factory/item-1', threadTitle: 'Fix login bug', workItem });

    expect(calls.sessionsCreatedFor).toEqual(['repo-1']);
    expect(calls.patches).toEqual([{ metadata: { ...workItem.metadata, repository: 'acme/renamed' } }]);
    const startedWorkItem = calls.started()?.workItem as { input: { metadata: Record<string, unknown> } };
    expect(startedWorkItem.input.metadata.repository).toBe('acme/renamed');
  });
});
