import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

// Navigation shares its working width across primitive routes.
// Real pointer geometry and browser storage are the boundaries under test.
async function width(sidebar: Locator) {
  const box = await sidebar.boundingBox();
  if (!box) throw new Error('Sidebar is not visible');
  return box.width;
}

async function dragDivider(page: Page, divider: Locator, offset: number) {
  const box = await divider.boundingBox();
  if (!box) throw new Error('Resize divider is not visible');
  await page.mouse.move(box.x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + offset, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe('Contextual sidebar resizing', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.describe('when opening Studio on a phone', () => {
    test('shares one mobile header and restores desktop navigation when widened', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/tools');
      const header = page.getByRole('banner', { name: 'Studio header' });
      await expect(header.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
      await expect(header.getByRole('button', { name: 'Agents navigation', exact: true })).toBeVisible();
      await expect(page.getByRole('banner')).toHaveCount(1);
      await page.setViewportSize({ width: 1440, height: 900 });
      const sidebar = page.getByRole('complementary', { name: 'Agents navigation', exact: true });
      await expect.poll(() => width(sidebar)).toBeGreaterThanOrEqual(200);
      await expect(sidebar.getByRole('link', { name: 'Tools', exact: true })).toBeVisible();
    });

    test('retains a saved desktop width after reloading on mobile', async ({ page }) => {
      await page.goto('/tools');
      const sidebar = page.getByRole('complementary', { name: 'Agents navigation', exact: true });
      await dragDivider(page, page.getByRole('separator', { name: 'Resize Agents navigation' }), 120);
      const savedWidth = await width(sidebar);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('button', { name: 'Agents navigation', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Agents navigation', exact: true })).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect.poll(async () => Math.abs((await width(sidebar)) - savedWidth)).toBeLessThan(2);
    });
  });

  test.describe('when widening MCP navigation', () => {
    test('retains the width through server navigation and reload and shares it with Tools', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');
      const sidebar = page.getByRole('complementary', { name: 'MCP navigation', exact: true });
      const originalWidth = await width(sidebar);
      await dragDivider(page, page.getByRole('separator', { name: 'Resize MCP navigation' }), 100);
      await expect.poll(() => width(sidebar)).toBeGreaterThan(originalWidth + 80);
      const resizedWidth = await width(sidebar);
      await sidebar.getByRole('link', { name: 'Simple MCP Server', exact: true }).click();
      await expect(page).toHaveURL(/\/mcps\/simple-mcp-server$/);
      await page.reload();
      await expect(sidebar).toBeVisible();
      await expect.poll(async () => Math.abs((await width(sidebar)) - resizedWidth)).toBeLessThan(2);
      await page.goto('/tools');
      const tools = page.getByRole('complementary', { name: 'Agents navigation', exact: true });
      await expect.poll(async () => Math.abs((await width(tools)) - resizedWidth)).toBeLessThan(2);
    });
  });

  test.describe('when focusing the sidebar search near its edge', () => {
    test('uses the whole search row as the input and filters servers', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');
      const sidebar = page.getByRole('complementary', { name: 'MCP navigation', exact: true });
      const search = sidebar.getByRole('searchbox', { name: 'Search servers and tools' });
      const inputBox = await search.boundingBox();
      const sidebarBox = await sidebar.boundingBox();
      if (!inputBox || !sidebarBox) throw new Error('Search is not visible');
      expect(Math.abs(inputBox.x - sidebarBox.x)).toBeLessThan(2);
      expect(Math.abs(inputBox.width - sidebarBox.width)).toBeLessThan(2);
      await page.mouse.click(inputBox.x + 2, inputBox.y + inputBox.height / 2);
      await expect(search).toBeFocused();
      await search.fill('No matching server');
      await expect(sidebar.getByRole('link', { name: 'Simple MCP Server', exact: true })).toHaveCount(0);
      await sidebar.getByRole('button', { name: 'Clear search servers and tools' }).click();
      await expect(search).toBeFocused();
      await expect(sidebar.getByRole('link', { name: 'Simple MCP Server', exact: true })).toBeVisible();
    });
  });

  test.describe('when focusing the navigation divider', () => {
    test('supports keyboard resizing', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');
      const sidebar = page.getByRole('complementary', { name: 'MCP navigation', exact: true });
      const originalWidth = await width(sidebar);
      const divider = page.getByRole('separator', { name: 'Resize MCP navigation' });
      await divider.focus();
      await divider.press('ArrowRight');
      await expect.poll(() => width(sidebar)).toBeGreaterThan(originalWidth + 5);
    });
  });

  test.describe('when moving resized tool navigation into a mobile drawer', () => {
    test('preserves the desktop width and unsent tool input', async ({ page }) => {
      await page.goto('/tools/weatherInfo');
      const sidebar = page.getByRole('complementary', { name: 'Tools navigation', exact: true });
      await dragDivider(page, page.getByRole('separator', { name: 'Resize Tools navigation' }), 80);
      const resizedWidth = await width(sidebar);
      const city = page.getByRole('textbox', { name: /City name/ });
      await city.fill('Lisbon');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('separator', { name: 'Resize Tools navigation' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Tools navigation', exact: true }).click();
      await expect(city).toHaveValue('Lisbon');
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect.poll(async () => Math.abs((await width(sidebar)) - resizedWidth)).toBeLessThan(2);
      await expect(city).toHaveValue('Lisbon');
    });
  });

  test.describe('when rendering MCP navigation inside the frame', () => {
    test('insets navigation rows and clips the sidebar fill inside the outer rim', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');
      const sidebar = page.getByRole('complementary', { name: 'MCP navigation', exact: true });
      const sidebarBox = await sidebar.boundingBox();
      const rowBox = await sidebar.getByRole('link', { name: 'All servers' }).boundingBox();
      if (!sidebarBox || !rowBox) throw new Error('Navigation is not visible');
      expect(rowBox.x - sidebarBox.x).toBeGreaterThanOrEqual(4);
      expect(sidebarBox.x + sidebarBox.width - rowBox.x - rowBox.width).toBeGreaterThanOrEqual(4);
      const frameContent = page.locator('[data-slot="studio-frame-content"]');
      await expect(frameContent).toBeVisible();
      const corner = await frameContent.evaluate(element => {
        const style = getComputedStyle(element);
        return { radius: parseFloat(style.borderTopLeftRadius), overflow: style.overflow };
      });
      expect(corner.radius).toBeGreaterThan(0);
      expect(corner.overflow).toBe('hidden');
    });
  });
});
