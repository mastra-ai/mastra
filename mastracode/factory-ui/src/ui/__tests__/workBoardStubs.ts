import { http, HttpResponse } from 'msw';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../e2e/ui/render';

export const FACTORY_ID = 'fp-1';
export const REPO_ID = 'repo-1';
export const OTHER_FACTORY_ID = 'fp-2';

export function workItem(
  id: string,
  title: string,
  createdAt: string,
  enteredAt: string,
  factoryProjectId = FACTORY_ID,
) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['triage'],
    stageHistory: [{ stage: 'triage', enteredAt, by: 'user-1' }],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    description: null,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

export function stubWorkBoard() {
  const repository = listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' });
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: FACTORY_ID, name: 'Acme Factory', repositories: [repository] },
          { id: OTHER_FACTORY_ID, name: 'Other Factory', repositories: [repository] },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/work-items`, ({ params }) =>
      HttpResponse.json({
        workItems:
          params.factoryId === OTHER_FACTORY_ID
            ? [
                workItem(
                  'other-card',
                  'Other factory card',
                  '2026-08-01T00:00:00.000Z',
                  '2026-08-02T00:00:00.000Z',
                  OTHER_FACTORY_ID,
                ),
                {
                  ...workItem(
                    'other-moved-card',
                    'Other factory moved',
                    '2026-07-01T00:00:00.000Z',
                    '2026-08-04T00:00:00.000Z',
                    OTHER_FACTORY_ID,
                  ),
                  metadata: { labels: ['moved'] },
                },
              ]
            : [
                {
                  ...workItem('newer-card', 'Created later', '2026-08-02T00:00:00.000Z', '2026-08-03T00:00:00.000Z'),
                  metadata: { labels: ['later'] },
                },
                workItem('recent-card', 'Moved recently', '2026-07-01T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
              ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/decisions`, () => HttpResponse.json({ decisions: [] })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => HttpResponse.json({ enabled: false, configured: false })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ permissions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
}
