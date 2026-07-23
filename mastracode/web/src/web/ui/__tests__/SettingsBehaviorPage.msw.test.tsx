/**
 * BDD coverage for the factory Behavior settings page
 * (`/factories/:factoryId/settings/behavior`). The page lives outside any
 * workspace route, so it must address the factory-level session (the
 * `resourceId` returned by the sandbox `/ensure` route) — a regression here
 * leaves every toggle permanently disabled because no session settings or
 * permissions can load.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { createAppRoutes } from '../router';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
/** The factory-level session address returned by the /ensure route. */
const FACTORY_RESOURCE_ID = 'fp-1';

function renderBehaviorSettings() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/settings/behavior`],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

function stubBehaviorPage() {
  const settings = { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true };
  const permissions = { categories: { read: 'ask', edit: 'ask', execute: 'ask', mcp: 'ask', other: 'ask' }, tools: {} };
  const seen = {
    settingsResourceIds: [] as string[],
    permissionResourceIds: [] as string[],
    stateWrites: [] as { resourceId: string; body: unknown }[],
    permissionWrites: [] as { resourceId: string; body: unknown }[],
  };

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/mastra',
                repository: { slug: 'org/mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () =>
      HttpResponse.json({
        resourceId: FACTORY_RESOURCE_ID,
        factoryProjectId: FACTORY_ID,
        projectRepositoryId: REPO_ID,
        sandboxId: 'sb-1',
        sandboxWorkdir: '/workspace/mastra',
      }),
    ),
    http.post(`${API}/sessions`, async ({ request }) => {
      const { resourceId } = (await request.json()) as { resourceId: string };
      return HttpResponse.json({ controllerId: 'code', resourceId, threadId: 'thread-1' });
    }),
    http.get(`${API}/sessions/:resourceId`, ({ params }) => {
      seen.settingsResourceIds.push(String(params.resourceId));
      return HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: 'thread-1',
        settings,
      });
    }),
    http.put(`${API}/sessions/:resourceId/state`, async ({ params, request }) => {
      const body = (await request.json()) as { state?: Record<string, unknown> };
      seen.stateWrites.push({ resourceId: String(params.resourceId), body });
      Object.assign(settings, body.state);
      return HttpResponse.json({});
    }),
    http.get(`${API}/sessions/:resourceId/permissions`, ({ params }) => {
      seen.permissionResourceIds.push(String(params.resourceId));
      return HttpResponse.json(permissions);
    }),
    http.put(`${API}/sessions/:resourceId/permissions/category`, async ({ params, request }) => {
      const body = (await request.json()) as { category: string; policy: string };
      seen.permissionWrites.push({ resourceId: String(params.resourceId), body });
      permissions.categories[body.category as keyof typeof permissions.categories] = body.policy;
      return HttpResponse.json(permissions);
    }),
  );
  return seen;
}

describe('Behavior settings page (factory scope)', () => {
  it('loads factory-level session settings so the behavior toggles are interactive', async () => {
    const seen = stubBehaviorPage();

    renderBehaviorSettings();

    const yolo = await screen.findByRole('switch', { name: 'Auto-approve tools' });
    await waitFor(() => expect(yolo).toBeEnabled());
    expect(screen.getByRole('switch', { name: 'Smart editing' })).toBeEnabled();
    expect(seen.settingsResourceIds).toContain(FACTORY_RESOURCE_ID);
    // Never address a session with an empty resourceId.
    expect(seen.settingsResourceIds).not.toContain('');
  });

  it('persists a toggle change to the factory-level session', async () => {
    const seen = stubBehaviorPage();
    const user = userEvent.setup();

    renderBehaviorSettings();

    const yolo = await screen.findByRole('switch', { name: 'Auto-approve tools' });
    await waitFor(() => expect(yolo).toBeEnabled());
    await user.click(yolo);

    await waitFor(() => expect(seen.stateWrites).toHaveLength(1));
    expect(seen.stateWrites[0]).toEqual({
      resourceId: FACTORY_RESOURCE_ID,
      body: { state: { yolo: true } },
    });
    await waitFor(() => expect(yolo).toBeChecked());
  });

  it('loads and updates tool permissions for the factory-level session', async () => {
    const seen = stubBehaviorPage();
    const user = userEvent.setup();

    renderBehaviorSettings();

    const readGroup = await screen.findByRole('group', { name: 'Read permission' });
    const readAllow = within(readGroup).getByRole('button', { name: 'Allow' });
    await waitFor(() => expect(readAllow).toBeEnabled());
    expect(seen.permissionResourceIds).toContain(FACTORY_RESOURCE_ID);

    await user.click(readAllow);

    await waitFor(() => expect(seen.permissionWrites).toHaveLength(1));
    expect(seen.permissionWrites[0]).toEqual({
      resourceId: FACTORY_RESOURCE_ID,
      body: { category: 'read', policy: 'allow' },
    });
  });
});
