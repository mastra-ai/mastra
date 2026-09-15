import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { setupMockAuth } from '../__utils__/auth';
import { createAgentList } from './__tests__/fixtures/agent-list';

function listViewport(page: Page) {
  return page.locator('[data-slot="app-shell-main"] [role="presentation"][tabindex]');
}

async function expectNoVerticalOverflow(viewport: Locator) {
  await expect.poll(() => viewport.evaluate(element => element.scrollHeight - element.clientHeight)).toBe(0);
  await expect(viewport).not.toHaveAttribute('data-has-overflow-y');
  await expect(viewport).not.toHaveAttribute('data-overflow-y-start');
  await expect(viewport).not.toHaveAttribute('data-overflow-y-end');
}

test.describe('Agents list scrolling', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, { enabled: false });
  });

  test.describe('when tabbing into the agents page', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('reaches the filter without stopping on the page container', async ({ page }) => {
      await page.route(
        url => url.pathname === '/api/agents',
        route => route.fulfill({ json: createAgentList(2) }),
      );
      await page.goto('/agents');
      await expect(page.locator('.data-list-row')).toHaveCount(2);
      const filter = page.getByRole('textbox', { name: 'Filter agents' });

      await filter.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('[data-slot="app-shell-main"]')).not.toBeFocused();
      await page.keyboard.press('Tab');
      await expect(filter).toBeFocused();
    });
  });

  for (const { device, viewport } of [
    { device: 'desktop', viewport: { width: 1440, height: 900 } },
    { device: 'tablet', viewport: { width: 768, height: 1024 } },
    { device: 'mobile', viewport: { width: 390, height: 844 } },
  ]) {
    test.describe(`when two agents fit on ${device}`, () => {
      test.use({ viewport });

      test('keeps every row unfaded without a vertical scroll range', async ({ page }, testInfo) => {
        await page.route(
          url => url.pathname === '/api/agents',
          route => route.fulfill({ json: createAgentList(2) }),
        );
        await page.goto('/agents');
        const rows = page.locator('.data-list-row');
        await expect(rows).toHaveCount(2);
        await page.evaluate(() => document.fonts.ready);
        const viewport = listViewport(page);
        await expectNoVerticalOverflow(viewport);
        if (device !== 'mobile') await expect(viewport).toHaveCSS('mask-image', 'none');

        await rows.last().focus();
        await page.keyboard.press('Tab');
        const provider = page.getByRole('button', { name: 'Show model details for Agent 2' });
        await expect(provider).toBeFocused();
        await expectNoVerticalOverflow(viewport);
        await page.keyboard.press('Escape');

        await viewport.hover({ position: { x: 4, y: 4 } });
        await page.mouse.wheel(0, 100);
        await expectNoVerticalOverflow(viewport);
        expect(await viewport.evaluate(element => element.scrollTop)).toBe(0);
        await expect(page.getByRole('dialog', { name: 'Model', exact: true })).toBeHidden();

        const screenshot = testInfo.outputPath(`agents-${device}.png`);
        await page.screenshot({ path: screenshot });
        await testInfo.attach(`agents-${device}`, { path: screenshot, contentType: 'image/png' });
      });
    });
  }

  test.describe('when the agents exceed the available height', () => {
    test.use({ viewport: { width: 1440, height: 600 } });

    test.beforeEach(async ({ page }) => {
      await page.route(
        url => url.pathname === '/api/agents',
        route => route.fulfill({ json: createAgentList(40) }),
      );
      await page.goto('/agents');
      await expect(page.locator('.data-list-row')).toHaveCount(40);
    });

    test('scrolls to the last agent and removes the fade at the end', async ({ page }) => {
      const viewport = listViewport(page);
      await expect(viewport).toHaveAttribute('data-overflow-y-end');
      await expect(viewport).not.toHaveCSS('mask-image', 'none');
      await viewport.hover({ position: { x: 4, y: 60 } });
      await page.mouse.wheel(0, 10000);
      await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect(viewport).not.toHaveAttribute('data-overflow-y-end');
      await expect(viewport).toHaveCSS('mask-image', 'none');
      await expect(page.getByRole('link', { name: 'Agent 40 Help with product questions.' })).toBeInViewport();
    });

    test('lets the keyboard reach and scroll the list viewport', async ({ page }) => {
      const viewport = listViewport(page);
      await expect(viewport).toHaveAttribute('data-overflow-y-end');
      await page.locator('.data-list-row').first().focus();
      await page.keyboard.press('Shift+Tab');
      await expect(viewport).toBeFocused();

      await page.keyboard.press('PageDown');
      await expect(page.locator('.data-list-row').nth(10)).toBeFocused();
      await page.keyboard.press('End');
      await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.getByRole('link', { name: 'Agent 40 Help with product questions.' })).toBeInViewport();
    });

    test('clears the scroll range and fade when filtering to two agents', async ({ page }) => {
      const viewport = listViewport(page);
      await expect(viewport).toHaveAttribute('data-overflow-y-end');
      await page.getByRole('textbox', { name: 'Filter agents' }).fill('Agent 4');
      await expect(page.locator('.data-list-row')).toHaveCount(2);
      await expectNoVerticalOverflow(viewport);
      await expect(viewport).toHaveCSS('mask-image', 'none');
    });
  });
});
