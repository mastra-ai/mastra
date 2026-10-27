import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Manifest } from 'vite';

import type { FactoryUserSession } from '../../src/ui/domains/workspaces/services/user-sessions';
import { server } from '../ui/msw-server';

const workPath = '/factories/fp-1/work';
const workHeading = 'Connect a repository to start intake';
const session: FactoryUserSession = {
  id: 'row-1',
  sessionId: 'missing-session',
  projectRepositoryId: 'repo-1',
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org',
  branch: 'user/session',
  title: 'Unavailable session',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
};

async function expectRecovery(page: Page) {
  await expect(page.getByRole('heading', { name: 'Could not load this page', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload page', exact: true })).toBeVisible();
  await expect(page.getByText('Unexpected Application Error!')).toHaveCount(0);
}

function documentRequests(page: Page) {
  let count = 0;
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) count += 1;
  });
  return () => count;
}

// A tab can request a chunk removed by a deploy, or lose its connection. Exercise
// actual asset 404s in the built app so recovery also covers Vite's CSS preloader.
test.describe('Factory page recovery', () => {
  let manifest: Manifest;
  const asset = (page: string, kind: 'file' | 'css' = 'file') => {
    const entry = manifest[`pages/${page}.tsx`];
    const file = kind === 'file' ? entry.file : entry.css?.[0];
    if (!file) throw new Error(`Missing ${kind} asset for ${page}`);
    return `**/${file}`;
  };

  test.beforeAll(() => {
    manifest = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../dist/.vite/manifest.json'), 'utf8'));
    server.listen({ onUnhandledRequest: 'error' });
  });
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ page, baseURL }) => {
    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get('*/web/factory/projects', () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Recovery factory' }] }),
      ),
      http.get('*/web/factory/projects/fp-1/sessions', () => HttpResponse.json({ sessions: [session] })),
      http.get('*/web/user-sessions/missing-session', () =>
        HttpResponse.json({ error: 'Session not found' }, { status: 404 }),
      ),
      http.get('*/api/agent-controller/code/sessions/:sessionId/permissions', () => HttpResponse.json({})),
      http.get('*/api/agent-controller/code/sessions/fp-1', () =>
        HttpResponse.json({
          controllerId: 'code',
          resourceId: 'fp-1',
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'thread-1',
          settings: {},
        }),
      ),
      http.get('*/web/intake/config', () =>
        HttpResponse.json({ config: { github: { enabled: false }, linear: { enabled: false } } }),
      ),
      http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
      http.get('*/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
    );
    await page.route(
      url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
      async route => {
        const request = route.request();
        if (request.url().endsWith('/feed-events')) {
          await route.fulfill({ contentType: 'text/event-stream', body: '' });
          return;
        }
        const response = await fetch(request.url(), { method: request.method(), body: request.postData() });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        });
      },
    );
  });

  for (const routeCase of [
    {
      name: 'Settings (React.lazy)',
      module: 'SettingsPage',
      path: '/factories/fp-1/settings/preferences',
      restoredHeading: 'Preferences',
      open: async (page: Page) => {
        await page.getByRole('button', { name: 'User menu' }).click();
        await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click();
      },
      leave: async (page: Page) => page.getByRole('button', { name: 'Back to app' }).click(),
    },
    {
      name: 'a session (route.lazy)',
      module: 'ThreadPage',
      path: '/factories/fp-1/user/threads/missing-session',
      restoredHeading: 'Session not found',
      open: async (page: Page) => page.getByRole('link', { name: 'Unavailable session', exact: true }).click(),
      leave: async (page: Page) => page.getByRole('link', { name: 'Work', exact: true }).click(),
    },
  ]) {
    test.describe(`when ${routeCase.name} cannot download its chunk`, () => {
      test.beforeEach(async ({ page }) => {
        await page.route(asset(routeCase.module), route =>
          route.fulfill({ status: 404, contentType: 'text/javascript', body: 'Not found' }),
        );
      });

      test('reloads a direct link successfully after the asset is available again', async ({ page }) => {
        const documents = documentRequests(page);
        await page.goto(routeCase.path);
        await expectRecovery(page);
        await expect(page.getByRole('complementary', { name: 'Main sidebar' })).toBeVisible();
        expect(documents()).toBe(1);

        await page.unroute(asset(routeCase.module));
        await page.getByRole('button', { name: 'Reload page', exact: true }).click();

        await expect(page.getByRole('heading', { name: routeCase.restoredHeading, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reload page', exact: true })).toHaveCount(0);
        expect(documents()).toBe(2);
      });

      test('keeps navigation usable after opening the page from Work', async ({ page }) => {
        const documents = documentRequests(page);
        await page.goto(workPath);
        await expect(page.getByRole('heading', { name: workHeading })).toBeVisible();
        const sidebar = await page.getByRole('complementary', { name: 'Main sidebar' }).elementHandle();
        if (!sidebar) throw new Error('Expected the main sidebar');

        await routeCase.open(page);
        await expectRecovery(page);
        expect(await sidebar.evaluate(node => node.isConnected)).toBe(true);
        await routeCase.leave(page);

        await expect(page.getByRole('heading', { name: workHeading })).toBeVisible();
        expect(await sidebar.evaluate(node => node.isConnected)).toBe(true);
        expect(documents()).toBe(1);
      });

      test('lets users reopen a persisted collapsed sidebar and return to Work', async ({ page }, testInfo) => {
        await page.addInitScript(() => localStorage.setItem('mastracode-web:sidebar:state', 'collapsed'));
        await page.goto(routeCase.path);
        await expectRecovery(page);

        const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await page.screenshot({ path: testInfo.outputPath('collapsed-recovery.png') });
        await toggle.click();
        await routeCase.leave(page);

        await expect(page.getByRole('heading', { name: workHeading })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reload page', exact: true })).toHaveCount(0);
      });
    });
  }

  for (const routeCase of [
    { name: 'sign-in stylesheet', module: 'SignInPage', kind: 'css', path: '/signin', heading: workHeading },
    {
      name: 'onboarding chunk',
      module: 'OnboardingPage',
      kind: 'file',
      path: '/onboarding',
      heading: 'Set up your factory.',
    },
  ] as const) {
    test.describe(`when the ${routeCase.name} is unavailable`, () => {
      test('recovers after reloading without requiring sidebar context', async ({ page }) => {
        if (routeCase.module === 'OnboardingPage') {
          server.use(http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })));
        }
        const documents = documentRequests(page);
        const pattern = asset(routeCase.module, routeCase.kind);
        await page.route(pattern, route => route.fulfill({ status: 404, body: '' }));
        await page.goto(routeCase.path);
        await expectRecovery(page);
        expect(documents()).toBe(1);

        await page.unroute(pattern);
        await page.getByRole('button', { name: 'Reload page', exact: true }).click();

        await expect(page.getByRole('heading', { name: routeCase.heading, exact: true })).toBeVisible();
        expect(documents()).toBe(2);
      });
    });
  }
});
