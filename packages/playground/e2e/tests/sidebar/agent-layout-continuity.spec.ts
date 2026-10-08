import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function geometry(page: Page) {
  const navigation = page.getByRole('complementary', { name: 'Agent navigation', exact: true });
  const views = navigation.getByRole('navigation', { name: 'Agent views' });
  const breadcrumb = page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Agents', exact: true });
  await expect(navigation).toBeVisible();
  await expect(breadcrumb).toBeVisible();
  const boxes = await Promise.all([navigation.boundingBox(), views.boundingBox(), breadcrumb.boundingBox()]);
  if (boxes.some(box => !box)) throw new Error('Agent chrome is not visible');
  return boxes;
}

test.describe('Agent route layout', () => {
  test.describe('when opening an agent from the collection', () => {
    test('keeps navigation full height with the page header beside it', async ({ page }) => {
      await page.goto('/agents');
      const collection = page.getByRole('complementary', { name: 'Build navigation', exact: true });
      await expect(
        page.getByRole('link').filter({ has: page.getByText('Weather Agent', { exact: true }) }),
      ).toBeVisible();
      const collectionBox = await collection.boundingBox();
      if (!collectionBox) throw new Error('Collection navigation is not visible');
      await page
        .getByRole('link')
        .filter({ has: page.getByText('Weather Agent', { exact: true }) })
        .click();
      const navigation = page.getByRole('complementary', { name: 'Agent navigation', exact: true });
      await expect(navigation.getByRole('link', { name: 'Editor', exact: true })).toBeVisible();
      await expect(page.locator('[data-slot="page-layout"] > header').first()).toBeVisible();
      const sidebarBox = await navigation.boundingBox();
      const frameBox = await page.locator('[data-slot="studio-frame-content"]').boundingBox();
      const headerBox = await page.locator('[data-slot="page-layout"] > header').first().boundingBox();
      if (!sidebarBox || !frameBox || !headerBox) throw new Error('Agent layout is not visible');
      expect(sidebarBox.y).toBeCloseTo(frameBox.y, 0);
      expect(sidebarBox.height).toBeCloseTo(frameBox.height, 0);
      expect(Math.abs(sidebarBox.width - collectionBox.width)).toBeLessThan(2);
      expect(Math.abs(headerBox.x - sidebarBox.x - sidebarBox.width)).toBeLessThan(2);
      expect(headerBox.y).toBeCloseTo(frameBox.y, 0);
    });
  });
  test.describe('when switching between Overview and Editor', () => {
    test('keeps the breadcrumb, navigation and saved width in place', async ({ page }) => {
      await page.goto('/agents/weather-agent/overview');
      const navigation = page.getByRole('complementary', { name: 'Agent navigation', exact: true });
      const divider = page.getByRole('separator').first();
      await divider.focus();
      await divider.press('ArrowRight');
      await page
        .locator('#feature-navigation')
        .evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      const initial = await geometry(page);
      const breadcrumb = page
        .getByRole('navigation', { name: 'Breadcrumb' })
        .getByRole('link', { name: 'Agents', exact: true });
      await breadcrumb.evaluate(element => element.setAttribute('data-continuity-check', 'original'));
      await navigation.evaluate(element => element.setAttribute('data-continuity-check', 'original'));
      for (const view of ['Editor', 'Overview']) {
        await navigation.getByRole('link', { name: view, exact: true }).click();
        await expect(navigation.getByRole('link', { name: view, exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(breadcrumb).toHaveAttribute('data-continuity-check', 'original');
        await expect(navigation).toHaveAttribute('data-continuity-check', 'original');
        await expect
          .poll(async () => {
            const next = await geometry(page);
            return next.every((box, index) => {
              const previous = initial[index];
              return (
                box &&
                previous &&
                (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(box[key] - previous[key]) < 2)
              );
            });
          })
          .toBe(true);
        await expect(page.getByRole('complementary', { name: 'Agent navigation', exact: true })).toHaveCount(1);
      }
      const savedWidth = (await navigation.boundingBox())?.width;
      await page.reload();
      await expect
        .poll(async () => Math.abs(((await navigation.boundingBox())?.width ?? 0) - (savedWidth ?? 0)))
        .toBeLessThan(1);
    });
  });
});
