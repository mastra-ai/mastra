import { expect, test } from '@playwright/test';

// A catalog is a single working page: wheel scrolling over rows must move the
// page, while search remains usable. The table must not trap vertical scrolling.
for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`Catalog scrolling on ${viewport.name}`, () => {
    test.use({ viewport });

    test.describe('when the agent catalog exceeds the available height', () => {
      test('scrolls the page and keeps search available without a nested vertical table scroller', async ({
        page,
      }, testInfo) => {
        await page.goto('/agents');
        const search = page.getByPlaceholder('Filter by name or instructions');
        await expect(search).toBeVisible();
        const scroll = page.locator('[data-slot="page-layout-scroll"] > div').first();
        const table = page.locator('[data-slot="data-list"][data-scroll="page"]');
        const toolbar = page.locator('[data-slot="page-layout-action-row"]');
        await expect(table).toBeVisible();
        await expect
          .poll(() => scroll.evaluate(element => element.scrollHeight - element.clientHeight))
          .toBeGreaterThan(100);
        const initialToolbar = await toolbar.boundingBox();
        const initialTable = await table.boundingBox();
        if (!initialToolbar || !initialTable) throw new Error('Catalog controls must have measurable geometry');

        await page.mouse.move(initialTable.x + 30, initialTable.y + 120);
        await page.mouse.wheel(0, 500);
        await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
        await expect
          .poll(async () => {
            const box = await toolbar.boundingBox();
            return Math.abs((box?.y ?? -1000) - initialToolbar.y);
          })
          .toBeLessThan(2);
        expect(
          await table.evaluate(element =>
            [...element.querySelectorAll('div')].some(child => {
              const style = getComputedStyle(child);
              return /auto|scroll/.test(style.overflowY) && child.scrollHeight > child.clientHeight + 2;
            }),
          ),
        ).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await search.fill('Chef Agent');
        await expect(
          page
            .locator('main')
            .getByRole('link', { name: /^Chef Agent/ })
            .first(),
        ).toBeVisible();
        await expect(search).toHaveValue('Chef Agent');
        await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-catalog.png`) });
      });
    });
  });
}
