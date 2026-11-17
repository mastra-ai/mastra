import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { largeBoard } from '../src/ui/__tests__/fixtures/largeBoard';
import { listedRepository } from './ui/factory-projects';
import { server } from './ui/msw-server';

// Every card sits in Intake, so each later phase of the Work board is empty and collapses.
const workItems = largeBoard(3).map(card => ({ ...card, stages: ['intake'] }));

async function phaseHeading(page: Page, label: string) {
  const heading = page.getByRole('heading', { name: label, exact: true });
  await expect(heading).toBeVisible();
  return heading;
}

test.describe('Factory board collapsed columns', () => {
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ page, baseURL }) => {
    server.use(
      http.get('*/auth/me', () => HttpResponse.json({ authenticated: true, authEnabled: false })),
      http.get('*/web/factory/projects', () =>
        HttpResponse.json({
          projects: [
            {
              id: 'fp-1',
              name: 'Factory',
              repositories: [listedRepository('repo-1', 'acme/app', { branch: 'main' })],
            },
          ],
        }),
      ),
      http.get('*/web/factory/projects/fp-1/work-items', () => HttpResponse.json({ workItems })),
      http.get('*/web/factory/projects/fp-1/sessions', () => HttpResponse.json({ sessions: [] })),
      http.get('*/web/factory/projects/fp-1/feed-events', () => new HttpResponse(null, { status: 404 })),
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
        const response = await fetch(request.url(), { method: request.method() });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        });
      },
    );
  });

  // Phones used to keep an empty column full width with its name laid flat under a count, so a board of
  // mostly empty phases took several screens of sideways scrolling to cross.
  for (const viewport of [
    { name: 'phone', width: 390, height: 844, touch: true },
    { name: 'desktop', width: 1240, height: 900, touch: false },
  ]) {
    test.describe(`on ${viewport.name}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.touch,
        hasTouch: viewport.touch,
      });

      test('narrows an empty column to a strip that names its phase vertically', async ({ page }) => {
        await page.goto('/factories/fp-1/work?layout=board');
        const intake = page.getByTestId('board-column-intake');
        await expect(intake.getByTestId('work-item-card')).toHaveCount(workItems.length);

        // Set BOARD_COLUMNS_SCREENSHOT to a directory to capture the board for visual review.
        const screenshotDir = process.env.BOARD_COLUMNS_SCREENSHOT;
        if (screenshotDir) {
          await page.mouse.move(0, 0);
          await page.screenshot({ path: `${screenshotDir}/${viewport.name}.png` });
          // Then at the board's far edge, where a phone scrolls to reach the later phases.
          await page.getByRole('group', { name: 'Board columns' }).evaluate(columns => {
            let surface = columns.parentElement;
            while (surface && surface.scrollWidth <= surface.clientWidth) surface = surface.parentElement;
            surface?.scrollTo({ left: surface.scrollWidth });
          });
          await page.screenshot({ path: `${screenshotDir}/${viewport.name}-far-edge.png` });
        }

        const intakeBox = await intake.boundingBox();
        expect(intakeBox).not.toBeNull();
        for (const [stage, label] of [
          ['triage', 'Triage'],
          ['planning', 'Planning'],
          ['done', 'Done'],
        ] as const) {
          const column = page.getByTestId(`board-column-${stage}`);
          await expect(column).toHaveAccessibleName(`${label}, empty`);
          const columnBox = await column.boundingBox();
          expect(columnBox?.width, `${label} column width`).toBeLessThan((intakeBox?.width ?? 0) / 4);

          const heading = await phaseHeading(page, label);
          await expect(heading).toHaveCSS('writing-mode', 'vertical-rl');
          const headingBox = await heading.boundingBox();
          expect(headingBox?.height, `${label} heading reads top to bottom`).toBeGreaterThan(headingBox?.width ?? 0);
          // The name hangs below the header, centered over its own strip.
          const headingCenter = (headingBox?.x ?? 0) + (headingBox?.width ?? 0) / 2;
          const columnCenter = (columnBox?.x ?? 0) + (columnBox?.width ?? 0) / 2;
          expect(Math.abs(headingCenter - columnCenter), `${label} heading over its column`).toBeLessThan(1);
        }
      });
    });
  }
});
