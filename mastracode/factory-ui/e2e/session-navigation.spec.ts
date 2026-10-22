import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import type { FactoryUserSession } from '../src/ui/domains/workspaces/services/user-sessions';
import { server } from './ui/msw-server';

const slackThreadUrl = 'https://app.slack.com/client/T123/C123/thread/C123-1791936483.798759';

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

/** Records what the browser bases its native menu on: whether the default survived, and the link under the pointer. */
async function recordContextMenus(page: Page) {
  await page.evaluate(() => {
    const events: { prevented: boolean; href: string | null | undefined }[] = [];
    window.addEventListener(
      'contextmenu',
      event => {
        const href = event.target instanceof Element ? event.target.closest('a')?.getAttribute('href') : undefined;
        setTimeout(() => {
          events.push({ prevented: event.defaultPrevented, href });
          document.documentElement.dataset.contextMenus = JSON.stringify(events);
        }, 0);
      },
      true,
    );
  });
  return () => page.evaluate(() => JSON.parse(document.documentElement.dataset.contextMenus ?? '[]'));
}

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
      http.get('*/web/factory/projects/fp-1/work-items', () =>
        HttpResponse.json({
          workItems: [
            {
              id: 'slack-item',
              orgId: 'org-1',
              createdBy: 'user-1',
              factoryProjectId: 'fp-1',
              board: 'review',
              externalSource: {
                integrationId: 'slack',
                type: 'slack-thread',
                workspaceId: 'T123',
                externalId: 'slack:C123:1791936483.798759',
              },
              parentWorkItemId: null,
              title: 'Slack source',
              stages: ['done'],
              stageHistory: [],
              sessions: {
                chat: {
                  sessionId: 'session-1',
                  branch: 'slack/1791936483-798759',
                  threadId: 'session-1',
                  startedBy: 'user-1',
                },
              },
              metadata: {},
              revision: 1,
              createdAt: '2026-10-22T00:00:00.000Z',
              updatedAt: '2026-10-22T00:00:00.000Z',
            },
          ],
        }),
      ),
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

  test.describe('when right-clicking a second time', () => {
    test('allows the native browser menu on a link inside the popup', async ({ page }) => {
      await page.goto('/factories/fp-1/work');
      const contextMenus = await recordContextMenus(page);
      await page.getByRole('link', { name: 'Slack discussion', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Open in Slack' }).click({ button: 'right' });
      await expect(page.getByRole('menu')).toBeHidden();
      await expect.poll(contextMenus).toEqual([
        { prevented: true, href: '/factories/fp-1/user/threads/session-1' },
        { prevented: false, href: slackThreadUrl },
      ]);
      await expect(page).toHaveURL(/\/factories\/fp-1\/work$/);
    });

    test('allows the native browser menu on the original session link', async ({ page }) => {
      await page.goto('/factories/fp-1/work');
      const contextMenus = await recordContextMenus(page);
      const row = page.getByRole('link', { name: 'Slack discussion', exact: true });
      const bounds = await row.boundingBox();
      if (!bounds) throw new Error('Session link must be visible');
      const { x, y } = { x: bounds.x + 10, y: bounds.y + 10 };
      await page.mouse.click(x, y, { button: 'right' });
      await expect(page.getByRole('menuitem', { name: 'Open in Slack' })).toBeVisible();
      await page.mouse.click(x, y, { button: 'right' });
      await expect(page.getByRole('menu')).toBeHidden();
      await expect.poll(contextMenus).toEqual([
        { prevented: true, href: '/factories/fp-1/user/threads/session-1' },
        { prevented: false, href: '/factories/fp-1/user/threads/session-1' },
      ]);
      await expect(page).toHaveURL(/\/factories\/fp-1\/work$/);
      await page.keyboard.press('Escape');
      await page.mouse.click(x, y, { button: 'right' });
      await expect(page.getByRole('menuitem', { name: 'Open in Slack' })).toBeVisible();
    });
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
    test.describe(`when using the three-dot menu on ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width < 1024 });

      test('pins the Slack session and retains it after reloading', async ({ page }, testInfo) => {
        await page.goto('/factories/fp-1/work');
        if (viewport.width < 1024) {
          await page.getByRole('button', { name: 'Open navigation menu' }).click();
        }
        if (viewport.width >= 1024) await page.getByRole('link', { name: 'Slack discussion', exact: true }).hover();
        const row = await page.getByRole('link', { name: 'Slack discussion', exact: true }).boundingBox();
        const actions = page.getByRole('button', { name: 'Session actions for Slack discussion' });
        const button = await actions.boundingBox();
        if (!row || !button) throw new Error('Session and its actions must be visible');
        expect(button.y + button.height / 2).toBeCloseTo(row.y + row.height / 2, 0);
        await actions.click();
        await expect(page.getByRole('menuitem', { name: 'Pin session' })).toBeVisible();
        await expect(page.getByLabel('Slack discussion session details')).toBeHidden();
        await page.screenshot({
          path: testInfo.outputPath(`session-menu-${viewport.name}.png`),
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
