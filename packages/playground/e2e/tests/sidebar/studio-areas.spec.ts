import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function sidebarWidth(sidebar: Locator) {
  const box = await sidebar.boundingBox();
  if (!box) throw new Error('The contextual sidebar must be visible');
  return box.width;
}

async function resizeSidebar(page: Page, name: string) {
  const divider = page.getByRole('separator', { name: `Resize ${name} navigation` });
  const box = await divider.boundingBox();
  if (!box) throw new Error('The resize divider must be visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe('Studio task areas', () => {
  test.describe('when switching task areas on desktop', () => {
    test('shares a full-height sidebar, resize preference and accessible feature navigation', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/agents');
      const rail = page.getByRole('complementary', { name: 'Studio navigation' });
      const build = page.getByRole('complementary', { name: 'Build navigation', exact: true });
      await expect(build).toBeVisible();
      const initial = await sidebarWidth(build);
      await resizeSidebar(page, 'Build');
      await expect.poll(() => sidebarWidth(build)).toBeGreaterThan(initial + 60);
      const resized = await sidebarWidth(build);
      const frame = await build.elementHandle();
      for (const area of ['Evaluate', 'Monitor', 'Resources', 'Build']) {
        await rail.getByRole('link', { name: area, exact: true }).click();
        const sidebar = page.getByRole('complementary', {
          name: `${area === 'Resources' ? 'Workspace' : area} navigation`,
          exact: true,
        });
        await expect(sidebar).toBeVisible();
        expect(await sidebar.evaluate((element, previous) => element === previous, frame)).toBe(true);
        await expect.poll(async () => Math.abs((await sidebarWidth(sidebar)) - resized)).toBeLessThan(2);
        const shell = await page.locator('[data-slot="studio-frame-content"]').boundingBox();
        const bounds = await sidebar.boundingBox();
        if (!shell || !bounds) throw new Error('The shell must be visible');
        expect(Math.abs(bounds.y - shell.y)).toBeLessThan(2);
        expect(Math.abs(bounds.height - shell.height)).toBeLessThan(2);
        await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
      }
      await build.getByRole('link', { name: 'Prompts', exact: true }).click();
      await expect(page).toHaveURL(/\/prompts$/);
      await page.reload();
      await expect(build).toBeVisible();
      await expect.poll(async () => Math.abs((await sidebarWidth(build)) - resized)).toBeLessThan(2);
    });
  });

  test.describe('when opening evaluation on a phone', () => {
    test('navigates the shared drawer and closes it after selecting a feature', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/scorers');
      await page.getByRole('button', { name: 'Evaluate navigation', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Evaluate navigation', exact: true });
      for (const name of ['Experiments', 'Datasets', 'Scorers', 'Review Queue']) {
        await expect(drawer.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await drawer.getByRole('link', { name: 'Review Queue' }).click();
      await expect(page).toHaveURL(/\/experiments\/review-queue$/);
      await expect(drawer).toHaveCount(0);
      await page.getByRole('button', { name: 'Evaluate navigation', exact: true }).click();
      await expect(drawer.getByRole('link', { name: 'Review Queue' })).toHaveAttribute('aria-current', 'page');
      await expect(drawer.getByRole('link', { name: 'Experiments', exact: true })).not.toHaveAttribute('aria-current');
      await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    });
  });
});
