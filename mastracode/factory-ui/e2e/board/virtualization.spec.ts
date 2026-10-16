import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { largeBoard } from '../../src/ui/__tests__/fixtures/largeBoard';
import { server } from '../ui/msw-server';

// Real browser layout and scrolling, with the same MSW transport boundary as
// the UI suite. Thousands of records should never become thousands of cards.
test.describe('Factory board virtualization', () => {
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ page }) => {
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
      url => /^\/(web|auth|api)\//.test(url.pathname),
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

  for (const layout of ['list', 'board'] as const) {
    test.describe(`when scrolling a large ${layout}`, () => {
      test('reaches the end and returns with bounded card mounts and no overlapping rows', async ({
        page,
      }, testInfo) => {
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
          expect(bounds[index]!.top).toBeGreaterThanOrEqual(bounds[index - 1]!.bottom);
        }
        await scroll.evaluate(element => {
          element.scrollTop = 0;
        });
        await expect(page.getByRole('article', { name: 'Large task 1999', exact: true })).toBeVisible();
        expect(await cards.count()).toBeLessThan(40);
        const samples = await scroll.evaluate(async element => {
          const timings: number[] = [];
          let peakCards = 0;
          for (let index = 1; index <= 20; index++) {
            const start = performance.now();
            element.scrollTop = ((element.scrollHeight - element.clientHeight) * index) / 20;
            // Include the React commit and the following browser paint.
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            timings.push(performance.now() - start);
            peakCards = Math.max(peakCards, document.querySelectorAll('[data-testid="work-item-card"]').length);
          }
          return { timings, peakCards };
        });
        expect(samples.peakCards).toBeLessThan(40);
        await testInfo.attach('scroll-samples', { body: JSON.stringify(samples), contentType: 'application/json' });
        console.log(
          `${testInfo.project.name} ${layout}: peak ${samples.peakCards} cards, max scroll/paint ${Math.round(Math.max(...samples.timings))}ms`,
        );
        await page.screenshot({ path: testInfo.outputPath(`${layout}.png`) });
      });
    });
  }

  test.describe('when a large preceding list group is collapsed', () => {
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

  test.describe('when opening a deep link into a large list', () => {
    test('scrolls the linked issue into the viewport without mounting its predecessors', async ({ page }) => {
      await page.goto('/factories/fp-1/work?item=large-0');
      await expect(page.getByRole('article', { name: 'Large task 0', exact: true })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Details for Large task 0', exact: true })).toBeFocused();
      expect(await page.getByTestId('work-item-card').count()).toBeLessThan(40);
    });
  });
});
