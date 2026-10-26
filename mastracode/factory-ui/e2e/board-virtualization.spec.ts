import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { largeBoard, largeCandidatePage } from '../src/ui/__tests__/fixtures/largeBoard';
import { server } from './ui/msw-server';

const viewports = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 } } },
  { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

// Real browser layout and scrolling, with the same MSW transport boundary as
// the UI suite. Thousands of records should never become thousands of cards.
test.describe('Factory board virtualization', () => {
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ page, baseURL }) => {
    server.use(
      http.get('*/auth/me', () => HttpResponse.json({ authenticated: true, authEnabled: false })),
      http.get('*/web/factory/projects', () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Large factory' }] }),
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
                  repository: { slug: 'acme/app', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get('*/web/factory/projects/fp-1/work-items', () => HttpResponse.json({ workItems: largeBoard(2000) })),
      http.get('*/web/factory/projects/fp-1/sessions', () => HttpResponse.json({ sessions: [] })),
      http.get('*/web/github/projects/repo-1/issues', () => HttpResponse.json({ issues: [], nextPage: null })),
      http.get('*/web/github/projects/repo-1/prs', () => HttpResponse.json({ pullRequests: [], nextPage: null })),
      http.get('*/web/intake/config', () =>
        HttpResponse.json({
          config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
        }),
      ),
      http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
      http.get('*/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
      http.get('*/api/agent-controller/code/sessions/fp-1/permissions', () => HttpResponse.json({ permissions: [] })),
    );
    await page.route(
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

  test('keeps the activity halo visible on the first and last list rows after expanding a group', async ({ page }) => {
    server.use(
      http.get('*/web/factory/projects/fp-1/work-items', () =>
        HttpResponse.json({
          workItems: largeBoard(2).map((item, index) => ({
            ...item,
            sessions: {
              chat: {
                sessionId: `session-${index}`,
                threadId: `session-${index}`,
                branch: 'fix/list-glow',
                startedBy: 'user-1',
              },
            },
          })),
        }),
      ),
      http.get('*/api/agent-controller/:controllerId/active-runs', () =>
        HttpResponse.json({
          runs: [0, 1].map(index => ({
            runId: `run-${index}`,
            resourceId: `session-${index}`,
            threadId: `session-${index}`,
          })),
        }),
      ),
    );
    await page.goto('/factories/fp-1/work?item=large-1');
    const halos = page.getByTestId('work-item-card').locator('.session-wick');
    await expect(halos).toHaveCount(2);

    // Check the actual clipping geometry, including the halo's 6px outset.
    // Both the nested list viewport and the collapsible panel used to cut it off.
    const clippedHalos = () =>
      halos.evaluateAll(elements =>
        elements.flatMap(element => {
          const bounds = element.getBoundingClientRect();
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const clip = parent.getBoundingClientRect();
            const clipsX =
              style.overflowX !== 'visible' && (bounds.left - 6 < clip.left || bounds.right + 6 > clip.right);
            const clipsY =
              style.overflowY !== 'visible' && (bounds.top - 6 < clip.top || bounds.bottom + 6 > clip.bottom);
            if (clipsX || clipsY) return [parent.className];
          }
          return [];
        }),
      );
    await expect.poll(clippedHalos).toEqual([]);

    const group = page.getByRole('button', { name: 'Triage, 2', exact: true });
    await group.click();
    await expect(halos.first()).toBeHidden();
    await group.click();
    await expect(halos.first()).toBeVisible();
    await expect.poll(clippedHalos).toEqual([]);
  });

  for (const viewport of viewports) {
    for (const layout of ['list', 'board'] as const) {
      test.describe(`when scrolling paginated candidates in ${layout} on ${viewport.name}`, () => {
        test.use(viewport.use);
        test('appends query pages without jumps or duplicate requests and can retry a failed page', async ({
          page,
        }) => {
          const requestedPages: number[] = [];
          let releasePage = () => {};
          const secondPage = new Promise<void>(resolve => {
            releasePage = resolve;
          });
          let failLastPage = true;
          server.use(
            http.get('*/web/factory/projects/fp-1/work-items', () => HttpResponse.json({ workItems: [] })),
            http.get('*/web/intake/config', () =>
              HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['acme/app'] } } }),
            ),
            http.get('*/web/github/projects/repo-1/issues', async ({ request }) => {
              const params = new URL(request.url).searchParams;
              if (params.has('label')) return HttpResponse.json(largeCandidatePage(0));
              const pageNumber = Number(params.get('page') ?? 1);
              requestedPages.push(pageNumber);
              if (pageNumber === 2) await secondPage;
              if (pageNumber === 3 && failLastPage) {
                return HttpResponse.json({ error: 'Candidate page unavailable' }, { status: 503 });
              }
              return HttpResponse.json({
                ...largeCandidatePage(pageNumber === 1 ? 30 : 100, pageNumber === 1 ? 0 : 30 + (pageNumber - 2) * 100),
                nextPage: pageNumber < 3 ? pageNumber + 1 : null,
              });
            }),
          );
          await page.goto('/factories/fp-1/work');
          await expect(page.getByRole('article', { name: 'Candidate 0', exact: true })).toBeVisible();
          if (layout === 'board') {
            await page.getByRole('button', { name: 'New view', exact: true }).click();
            await page.getByRole('radio', { name: 'Board', exact: true }).click();
            await page.getByRole('button', { name: 'Save view', exact: true }).click();
            await expect(page.getByRole('group', { name: 'Board columns' })).toBeVisible();
          }
          const cards = page.getByTestId('candidate-card');
          const scroll = page
            .getByTestId('board-column-intake')
            .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " overflow-auto ")][1]');
          expect(requestedPages).toEqual([1]);
          await scroll.evaluate(element => {
            element.scrollTop = element.scrollHeight;
          });
          await expect(page.getByRole('status', { name: 'Loading more candidates' })).toBeVisible();
          const anchor = page.getByRole('article', { name: 'Candidate 29', exact: true });
          await expect(anchor).toBeInViewport();
          const before = await anchor.evaluate(element => element.getBoundingClientRect().top);
          await scroll.evaluate(async element => {
            for (let frame = 0; frame < 5; frame++) {
              element.dispatchEvent(new Event('scroll'));
              await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
          });
          expect(requestedPages).toEqual([1, 2]);
          releasePage();
          await expect(page.getByRole('status', { name: 'Loading more candidates' })).toHaveCount(0);
          await expect(anchor).toBeInViewport();
          expect(
            Math.abs((await anchor.evaluate(element => element.getBoundingClientRect().top)) - before),
          ).toBeLessThan(2);
          expect(await cards.count()).toBeLessThan(40);
          expect(requestedPages).toEqual([1, 2]);

          await scroll.evaluate(element => {
            element.scrollTop = element.scrollHeight;
          });
          await expect(page.getByRole('alert')).toContainText('Candidate page unavailable');
          await expect(page.getByRole('article', { name: 'Candidate 129', exact: true })).toBeInViewport();
          failLastPage = false;
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
          await expect(page.getByRole('alert')).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Load more candidates' })).toHaveCount(0);
          await scroll.evaluate(element => {
            element.scrollTop = element.scrollHeight;
          });
          await expect(page.getByRole('article', { name: 'Candidate 229', exact: true })).toBeInViewport();
          expect(await cards.count()).toBeLessThan(40);
          expect(requestedPages).toEqual([1, 2, 3, 3]);

          await scroll.evaluate(element => {
            element.scrollTop = 0;
          });
          await expect(page.getByRole('article', { name: 'Candidate 0', exact: true })).toBeInViewport();
          expect(await cards.count()).toBeLessThan(40);
          expect(requestedPages).toEqual([1, 2, 3, 3]);
        });
      });

      test.describe(`when scrolling a large ${layout} on ${viewport.name}`, () => {
        test.use(viewport.use);
        test('reaches the end and returns with bounded card mounts and no overlapping rows', async ({ page }) => {
          await page.goto('/factories/fp-1/work');
          await expect(page.getByRole('article', { name: 'Large task 1999', exact: true })).toBeVisible();
          if (layout === 'board') {
            await page.getByRole('button', { name: 'New view', exact: true }).click();
            await page.getByRole('radio', { name: 'Board', exact: true }).click();
            await page.getByRole('button', { name: 'Save view', exact: true }).click();
            await expect(page.getByRole('group', { name: 'Board columns' })).toBeVisible();
          }
          const cards = page.getByTestId('work-item-card');
          expect(await cards.count()).toBeLessThan(40);
          const scroll = page
            .getByTestId('board-column-triage')
            .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " overflow-auto ")][1]');
          await scroll.evaluate(element => {
            element.scrollTop = element.scrollHeight;
          });
          await expect(page.getByRole('article', { name: 'Large task 0', exact: true })).toBeVisible();
          await expect(page.getByRole('article', { name: 'Large task 1999', exact: true })).toHaveCount(0);
          expect(await cards.count()).toBeLessThan(40);
          const bounds = await cards.evaluateAll(elements =>
            elements.map(element => {
              const { top, bottom } = element.getBoundingClientRect();
              return { top, bottom };
            }),
          );
          for (let index = 1; index < bounds.length; index++) {
            expect(bounds[index].top).toBeGreaterThanOrEqual(bounds[index - 1].bottom);
          }
          await scroll.evaluate(element => {
            element.scrollTop = 0;
          });
          await expect(page.getByRole('article', { name: 'Large task 1999', exact: true })).toBeVisible();
          expect(await cards.count()).toBeLessThan(40);
        });
      });
    }

    test.describe(`when a large preceding list group is collapsed on ${viewport.name}`, () => {
      test.use(viewport.use);
      test('keeps the following group reachable at its new scroll position', async ({ page }) => {
        server.use(
          http.get('*/web/factory/projects/fp-1/work-items', () =>
            HttpResponse.json({
              workItems: largeBoard(240).map((item, index) => ({
                ...item,
                stages: [index < 120 ? 'triage' : 'planning'],
              })),
            }),
          ),
        );
        await page.goto('/factories/fp-1/work');
        await expect(page.getByRole('article', { name: 'Large task 119', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Triage, 120', exact: true }).click();
        await expect(page.getByRole('article', { name: 'Large task 239', exact: true })).toBeInViewport();
        // Give hidden-row ResizeObservers time to settle: zero-height rows must
        // not cause a collapsed group to mount its entire dataset.
        await page.evaluate(async () => {
          for (let frame = 0; frame < 6; frame++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          }
        });
        expect(await page.getByTestId('work-item-card').count()).toBeLessThan(40);
        await page.getByRole('button', { name: 'Triage, 120', exact: true }).click();
        await expect(page.getByRole('article', { name: 'Large task 119', exact: true })).toBeInViewport();
      });
    });

    for (const count of [10, 2000]) {
      test.describe(`when opening a deep link into a ${count}-item list on ${viewport.name}`, () => {
        test.use(viewport.use);
        test('scrolls the linked issue into the viewport with bounded card mounts', async ({ page }) => {
          server.use(
            http.get('*/web/factory/projects/fp-1/work-items', () =>
              HttpResponse.json({ workItems: largeBoard(count) }),
            ),
          );
          await page.goto('/factories/fp-1/work?item=large-0');
          await expect(page.getByRole('article', { name: 'Large task 0', exact: true })).toBeInViewport();
          await expect(page.getByRole('button', { name: 'Details for Large task 0', exact: true })).toBeFocused();
          expect(await page.getByTestId('work-item-card').count()).toBeLessThan(40);
        });
      });
    }
  }

  test.describe('when a card with open details is sorted out of the rendered range', () => {
    test.use(viewports[0].use);
    test('keeps the card mounted so its draft is there when the user scrolls back', async ({ page }) => {
      await page.goto('/factories/fp-1/work');
      await page
        .getByRole('article', { name: 'Large task 1999', exact: true })
        .getByText('Large task 1999', { exact: true })
        .click();
      const details = page.getByRole('dialog', { name: 'Large task 1999' });
      await details.getByRole('textbox', { name: 'Comment' }).fill('Keep this draft');

      await page.evaluate(() => {
        history.pushState(null, '', '?sort=created-oldest');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page.getByRole('article', { name: 'Large task 0', exact: true })).toBeVisible();
      expect(await page.getByTestId('work-item-card').count()).toBeLessThan(40);

      await page.getByRole('article', { name: 'Large task 1999', exact: true }).scrollIntoViewIfNeeded();
      await expect(details.getByRole('textbox', { name: 'Comment' })).toHaveValue('Keep this draft');
    });
  });
});
