import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../api/keys';
import type { FactoryAuthState } from '../domains/auth/services/auth';
import type { FactoryDecisionPage } from '../domains/factory/services/decisions';
import type { FactoryProjectPayload, ProjectConnectionPayload } from '../domains/workspaces/services/github';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { GithubIssuePage, GithubPullRequestPage } from '../domains/factory/services/factory';
import type { IntakeConfig } from '../domains/factory/services/intake';
import type { BoardSnapshot, WireWorkItem } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';

const factoryId = 'multi-repo-factory';
const projectUrl = `${TEST_BASE_URL}/web/factory/projects/${factoryId}`;
const timestamp = '2026-10-01T00:00:00.000Z';

describe('board intake from multiple linked repositories', () => {
  it.each([
    { kind: 'work', fails: false, sameNumber: true },
    { kind: 'review', fails: false, sameNumber: true },
    { kind: 'work', fails: true, sameNumber: false },
  ])('imports a secondary repository card on $kind (initial failure: $fails)', async ({ kind, fails, sameNumber }) => {
    const review = kind === 'review';
    const title = `Secondary repository ${review ? 'pull request' : 'issue'}`;
    const sourceUrl = `https://github.com/acme/b/${review ? 'pull' : 'issues'}/1`;
    const card: WireWorkItem = {
      id: 'secondary-card',
      orgId: 'org-1',
      createdBy: 'user-1',
      factoryProjectId: factoryId,
      parentWorkItemId: null,
      title,
      stages: ['intake'],
      stageHistory: [],
      sessions: {},
      metadata: { githubRepositoryId: 102, ...(review ? { githubPullRequestNumber: 1 } : { githubIssueNumber: 1 }) },
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      externalSource: {
        integrationId: 'github',
        type: review ? 'pull-request' : 'issue',
        externalId: `github:102:${review ? 'pull-request' : 'issue'}:1`,
        url: sourceUrl,
      },
    };
    let ingested = false;
    let unavailable = fails;
    const feeds: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authenticated: true,
          authEnabled: true,
          user: { userId: 'user-1' },
        } satisfies FactoryAuthState),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({
          projects: [{ id: factoryId, name: 'Two repositories' }] satisfies FactoryProjectPayload[],
        }),
      ),
      http.get(`${projectUrl}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'connection-1',
              installationId: 'installation-1',
              repositories: ['a', 'b'].map(name => ({
                id: `repo-${name}`,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: `acme/${name}`, defaultBranch: 'main' },
              })),
            },
          ] satisfies ProjectConnectionPayload[],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: { github: { enabled: true, sourceIds: ['acme/a', 'acme/b'] } } satisfies Partial<IntakeConfig>,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/:id/issues`, ({ params, request }) => {
        if (new URL(request.url).searchParams.has('label'))
          return HttpResponse.json({ issues: [], nextPage: null } satisfies GithubIssuePage);
        feeds.push(`${params.id}/issues`);
        if (params.id === 'repo-b') {
          if (unavailable) return HttpResponse.json({ error: 'Unavailable' }, { status: 503 });
          ingested = true;
        }
        return HttpResponse.json({
          issues:
            params.id === 'repo-b'
              ? [
                  {
                    number: 1,
                    title,
                    url: sourceUrl,
                    author: 'user-1',
                    labels: [],
                    comments: 0,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  },
                ]
              : sameNumber
                ? [
                    {
                      number: 1,
                      title: 'Primary same-number candidate',
                      url: 'https://github.com/acme/a/issues/1',
                      author: 'user-1',
                      labels: [],
                      comments: 0,
                      createdAt: timestamp,
                      updatedAt: timestamp,
                    },
                  ]
                : [],
          nextPage: null,
        } satisfies GithubIssuePage);
      }),
      http.get(`${TEST_BASE_URL}/web/github/projects/:id/prs`, ({ params }) => {
        feeds.push(`${params.id}/prs`);
        if (params.id === 'repo-b') {
          if (unavailable) return HttpResponse.json({ error: 'Unavailable' }, { status: 503 });
          ingested = true;
        }
        return HttpResponse.json({
          pullRequests:
            params.id === 'repo-b'
              ? [
                  {
                    number: 1,
                    title,
                    url: sourceUrl,
                    author: 'user-1',
                    baseBranch: 'main',
                    headBranch: 'fix',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  },
                ]
              : sameNumber
                ? [
                    {
                      number: 1,
                      title: 'Primary same-number candidate',
                      url: 'https://github.com/acme/a/pull/1',
                      author: 'user-1',
                      baseBranch: 'main',
                      headBranch: 'fix',
                      createdAt: timestamp,
                      updatedAt: timestamp,
                    },
                  ]
                : [],
          nextPage: null,
        } satisfies GithubPullRequestPage);
      }),
      http.get(`${projectUrl}/work-items`, () =>
        HttpResponse.json({ workItems: ingested ? [card] : [], runningSessionIds: [], parkedSessionIds: [] }),
      ),
      http.get(`${projectUrl}/decisions`, () => HttpResponse.json({ decisions: [] } satisfies FactoryDecisionPage)),
      http.get(`${TEST_BASE_URL}/web/source-control/projects/:id/sessions`, () => HttpResponse.json({ sessions: [] })),
    );
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${factoryId}/${kind}`] });
    const { client } = renderWithProviders(<RouterProvider router={router} />);
    if (fails) {
      await screen.findByText(/Unable to sync intake from acme\/b/);
      unavailable = false;
      await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    }
    await waitFor(() =>
      expect(
        client.getQueryData<BoardSnapshot>(queryKeys.workItems(factoryId))?.workItems.map(item => item.id),
      ).toEqual(['secondary-card']),
    );
    await screen.findByRole('button', { name: `Details for ${title}` });
    if (sameNumber) await screen.findByText('Primary same-number candidate');
    await waitFor(() => expect(feeds).toContain(`repo-b/${review ? 'prs' : 'issues'}`));
    expect(feeds).toContain(`repo-a/${review ? 'prs' : 'issues'}`);
  });
});
