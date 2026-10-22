import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import type { FactoryUserSession } from '../src/ui/domains/workspaces/services/user-sessions';
import { server } from './ui/msw-server';

const sessions: FactoryUserSession[] = [
  ['user/session', 'User session'],
  ['slack/1791936483-798759', 'Slack discussion'],
  ['factory/issue-528', 'Work session'],
].map(([branch, title], index): FactoryUserSession => ({
  id: `row-${index}`,
  sessionId: `session-${index}`,
  projectRepositoryId: 'repo-1',
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org',
  branch,
  title,
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
}));

// FACT-528: jsdom cannot open browser tabs. Exercise native anchors in the
// real app; only API traffic crosses the same MSW boundary as the UI suite.
test.describe('Factory session navigation', () => {
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ context, baseURL }) => {
    server.use(
      http.get('*/auth/me', () => HttpResponse.json({ authenticated: true, authEnabled: false })),
      http.get('*/web/factory/projects', () =>
        HttpResponse.json({
          projects: [
            { id: 'fp-1', name: 'Session links' },
            { id: 'fp-2', name: 'Another Factory' },
          ],
        }),
      ),
      http.get('*/web/factory/projects/fp-1/source-control-connections', () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              installationId: 'inst-1',
              repositories: [
                {
                  id: 'repo-1',
                  branch: 'main',
                  sandboxWorkdir: '/repo',
                  repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get('*/web/factory/projects/fp-1/sessions', () => HttpResponse.json({ sessions })),
      http.get('*/web/github/projects/repo-1/issues', () => HttpResponse.json({ issues: [], nextPage: null })),
      http.get('*/web/intake/config', () => HttpResponse.json({ config: {} })),
      http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
      http.get('*/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
      http.get('*/api/agent-controller/code/sessions/fp-1/permissions', () => HttpResponse.json({ permissions: [] })),
    );
    await context.route(
      url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
      async route => {
        const request = route.request();
        if (request.url().endsWith('/feed-events')) {
          await route.fulfill({ contentType: 'text/event-stream', body: '' });
          return;
        }
        const response = await fetch(request.url(), { method: request.method() });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        });
      },
    );
  });

  test.describe('when a session is opened with a browser gesture', () => {
    for (const [index, session] of sessions.entries()) {
      for (const gesture of ['modifier', 'middle']) {
        test(`${gesture}-click opens ${session.title} in another tab`, async ({ page, context }) => {
          await page.goto('/factories/fp-1/work');
          const link = page.getByRole('link', { name: session.title, exact: true });
          const path =
            index === 2
              ? `/factories/fp-1/workspaces/${session.sessionId}/threads/${session.sessionId}`
              : `/factories/fp-1/user/threads/${session.sessionId}`;
          const opened = context.waitForEvent('page');

          await link.click({
            button: gesture === 'middle' ? 'middle' : 'left',
            modifiers: gesture === 'modifier' ? ['ControlOrMeta'] : [],
          });

          const newTab = await opened;
          await expect(newTab).toHaveURL(new RegExp(`${path}$`));
          await expect(page).toHaveURL(/\/factories\/fp-1\/work$/);
          await newTab.close();
        });
      }
    }
  });

  test.describe('when a session menu opens another tab', () => {
    for (const entry of ['context', 'dropdown']) {
      test(`the ${entry} menu opens the Slack thread and leaves the current tab in place`, async ({
        page,
        context,
      }) => {
        await page.goto('/factories/fp-1/work');
        const row = page.getByRole('link', { name: 'Slack discussion', exact: true });
        if (entry === 'context') await row.click({ button: 'right' });
        else {
          await row.hover();
          await page.getByRole('button', { name: 'Session actions for Slack discussion' }).click();
        }

        const opened = context.waitForEvent('page');
        await page.getByRole('menuitem', { name: 'Open in new tab' }).click();
        const newTab = await opened;
        await expect(newTab).toHaveURL(/\/factories\/fp-1\/user\/threads\/session-1$/);
        await expect(page).toHaveURL(/\/factories\/fp-1\/work$/);
        await newTab.close();
      });
    }
  });

  test.describe('when opening another Factory from its switcher', () => {
    test('modifier-click opens the corresponding board in another tab', async ({ page, context }) => {
      await page.goto('/factories/fp-1/work');
      await page.getByRole('button', { name: 'Select factory' }).click();
      const opened = context.waitForEvent('page');
      await page.getByRole('menuitem', { name: 'Another Factory' }).click({ modifiers: ['ControlOrMeta'] });

      const newTab = await opened;
      await expect(newTab).toHaveURL(/\/factories\/fp-2\/work$/);
      await expect(page).toHaveURL(/\/factories\/fp-1\/work$/);
      await newTab.close();
    });
  });

  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test.describe(`when using the session context menu on ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('pins the Slack session and retains it after reloading', async ({ page }, testInfo) => {
        await page.goto('/factories/fp-1/work');
        if (viewport.width < 1024) {
          await page.getByRole('button', { name: 'Open navigation menu' }).click();
        }
        await page.getByRole('link', { name: 'Slack discussion', exact: true }).click({ button: 'right' });
        await expect(page.getByRole('menuitem', { name: 'Pin session' })).toBeVisible();
        await expect(page.getByLabel('Slack discussion session details')).toBeHidden();
        await page.screenshot({
          path: testInfo.outputPath(`session-context-${viewport.name}.png`),
          animations: 'disabled',
        });
        await page.getByRole('menuitem', { name: 'Pin session' }).click();
        await expect(page.getByLabel('Slack discussion pinned')).toBeAttached();

        await page.reload();
        if (viewport.width < 1024) {
          await page.getByRole('button', { name: 'Open navigation menu' }).click();
        }
        await expect(page.getByLabel('Slack discussion pinned')).toBeAttached();
        await expect(page).toHaveURL(/\/factories\/fp-1\/work$/);
      });
    });
  }
});
