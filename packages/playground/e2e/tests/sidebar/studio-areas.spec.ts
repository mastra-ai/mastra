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
      const agents = page.getByRole('complementary', { name: 'Agents navigation', exact: true });
      await expect(agents).toBeVisible();
      const initial = await sidebarWidth(agents);
      await resizeSidebar(page, 'Agents');
      await expect.poll(() => sidebarWidth(agents)).toBeGreaterThan(initial + 60);
      const resized = await sidebarWidth(agents);
      const frame = await agents.elementHandle();
      for (const area of ['Evaluate', 'Agents']) {
        await rail.getByRole('link', { name: area, exact: true }).click();
        const label = `${area} navigation`;
        const sidebar = page.getByRole('complementary', { name: label, exact: true });
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
      await page.reload();
      await expect(agents).toBeVisible();
      await expect.poll(async () => Math.abs((await sidebarWidth(agents)) - resized)).toBeLessThan(2);
    });
  });

  test.describe('when opening evaluation on a phone', () => {
    test('navigates the shared drawer and closes it after selecting a feature', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/experiments');
      await page.getByRole('button', { name: 'Evaluate navigation', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Evaluate navigation', exact: true });
      for (const name of ['Experiments', 'Review Queue']) {
        await expect(drawer.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await expect(drawer.getByRole('navigation', { name: 'Datasets list' })).toBeVisible();
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
