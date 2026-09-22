import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const FACTORY_NAME = 'Acme Factory';

function stubFactory() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { userId: 'user-1', email: 'user@example.com' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: FACTORY_NAME, repositories: [] }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/work-items`, () =>
      HttpResponse.json({ workItems: [], runningSessionIds: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/supervisor/health`, () =>
      HttpResponse.json({ checkedAt: new Date().toISOString(), findings: [], counts: {} }),
    ),
    http.get(`${TEST_BASE_URL}/web/audit/portal-link`, () => new HttpResponse(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/supervisor/config/:factoryId`, () => HttpResponse.json({ isEnabled: false })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:id/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );
}

function renderRoute(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/${path}`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

async function findBreadcrumbs() {
  const layout = await screen.findByRole('navigation', { name: 'Breadcrumb' });
  expect(layout.closest('[data-slot="page-layout"]')).not.toBeNull();
  return layout;
}

describe.each([
  ['overview', 'Overview'],
  ['activity', 'Activity'],
  ['attention', 'Attention'],
  ['audit', 'Audit'],
  ['work', 'Work'],
  ['review', 'Review'],
  ['rules', 'Rules'],
])('Factory page %s', (path, label) => {
  describe('when the page renders', () => {
    it(`shows the "${FACTORY_NAME} / ${label}" breadcrumb inside a page layout`, async () => {
      stubFactory();
      renderRoute(path);
      const nav = await findBreadcrumbs();
      expect(within(nav).getByText(FACTORY_NAME)).toBeInTheDocument();
      expect(within(nav).getByText(label).closest('[aria-current="page"]')).not.toBeNull();
    });
  });
});

describe('Work board page', () => {
  describe('when no repository is linked', () => {
    it('renders a fill empty state pointing at Repository settings', async () => {
      stubFactory();
      renderRoute('work');
      const heading = await screen.findByRole('heading', { name: 'Connect a repository to start intake' });
      expect(heading.closest('[data-slot="empty-state-fill"]')).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Open Repository settings' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/settings/repositories`,
      );
    });
  });
});

describe('Settings page', () => {
  describe('when the section is preferences', () => {
    it('shows the "Settings / Preferences" breadcrumb inside a page layout', async () => {
      stubFactory();
      renderRoute('settings/preferences');
      const nav = await findBreadcrumbs();
      expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/settings/preferences`,
      );
      expect(within(nav).getByText('Preferences').closest('[aria-current="page"]')).not.toBeNull();
    });
  });

  describe('when the section is unknown', () => {
    it('redirects to preferences', async () => {
      stubFactory();
      renderRoute('settings/nope');
      const nav = await findBreadcrumbs();
      expect(within(nav).getByText('Preferences').closest('[aria-current="page"]')).not.toBeNull();
    });
  });

  describe('when on the Slack connection page', () => {
    it('shows the "Settings / Connections / Slack" breadcrumb inside a page layout', async () => {
      stubFactory();
      renderRoute('settings/connections/slack');
      const nav = await findBreadcrumbs();
      expect(within(nav).getByRole('link', { name: 'Connections' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/settings/connections`,
      );
      expect(within(nav).getByText('Slack').closest('[aria-current="page"]')).not.toBeNull();
    });
  });
});
