import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { listedRepository } from '../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactorySkillInfo, FactorySkillsResponse, StoredBoardResponse } from '../../../../../api/types';
import { createAppRoutes } from '../../../../router';

export const FACTORY_ID = 'fp-1';
export const PROJECT_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;
export const BOARD_URL = `${PROJECT_URL}/boards/work`;

/** The built-in skills a real server always lists. */
export const BUILT_IN_SKILLS: FactorySkillInfo[] = [
  'factory-triage',
  'factory-plan',
  'factory-build',
  'factory-self-review',
  'factory-review',
  'factory-rereview',
  'factory-gitlab-review',
  'factory-gitlab-rereview',
].map(name => ({ name, description: `The ${name} skill`, content: `# ${name}`, builtIn: true }));

/** Serves a signed-in factory with one repository, enough for the app shell around a board's settings. */
export function stubFactory(factory: Record<string, unknown> = {}) {
  const project = { id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false, ...factory };
  const patches: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [{ ...project, repositories: [listedRepository('repo-1', 'acme/app', { sandboxWorkdir: '/repo' })] }],
      }),
    ),
    http.patch(PROJECT_URL, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      Object.assign(project, body);
      return HttpResponse.json({ project });
    }),
    http.get(`${PROJECT_URL}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${PROJECT_URL}/metrics`, () => HttpResponse.json({ error: 'unavailable' }, { status: 500 })),
    http.get(`${TEST_BASE_URL}/web/factory/skills`, () =>
      HttpResponse.json({ skills: BUILT_IN_SKILLS, canEdit: true } satisfies FactorySkillsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/repo-1/ensure`, () => HttpResponse.json({ ok: true })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );
  return patches;
}

export function serveBoard(board: StoredBoardResponse | (() => StoredBoardResponse), url = BOARD_URL) {
  server.use(http.get(url, () => HttpResponse.json(typeof board === 'function' ? board() : board)));
}

export function renderAt(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return { ...renderWithProviders(<RouterProvider router={router} />), router };
}
