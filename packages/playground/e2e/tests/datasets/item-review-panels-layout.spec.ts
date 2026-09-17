import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { longPanelItems, longPanelResults, mockPanelRequests } from './__tests__/fixtures/item-review-panels';

/** The dialog is the drawer popup; the card is its inner `section`. */
function card(panel: Locator) {
  return panel.locator('section').first();
}

/**
 * Wheel-scrolls inside the card's content area and returns how far the card's
 * own scroll region moved, regardless of tabs or other wrappers around it.
 */
async function scrollCardContent(page: Page, panel: Locator) {
  const target = card(panel);
  const box = await target.boundingBox();
  await target.hover({ position: { x: 8, y: box!.height - 8 } });
  await page.mouse.wheel(0, 1000);
  return () =>
    target.evaluate(element =>
      Math.max(
        0,
        ...Array.from(element.querySelectorAll<HTMLElement>('*'))
          .filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY))
          .map(node => node.scrollTop),
      ),
    );
}

/**
 * Item details open as a modal drawer. Fixtures cross only the network
 * boundary; deep links persist the selection without any data mutation.
 */
test.describe('Item and review panel layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockPanelRequests(page);
  });

  for (const { device, viewport } of [
    { device: 'mobile', viewport: { width: 390, height: 844 } },
    { device: 'tablet', viewport: { width: 768, height: 1024 } },
    { device: 'desktop', viewport: { width: 1440, height: 900 } },
  ]) {
    for (const { surface, url, label } of [
      { surface: 'dataset item', url: '/datasets/ds-1/items/item-a', label: 'Dataset item item-a' },
      { surface: 'experiment result', url: '/experiments/exp-1/items/item-1', label: 'Experiment item item-1' },
      {
        surface: 'review result',
        url: '/experiments/review-queue?experiment=exp-1&review=res-3',
        label: 'Review item res-3',
      },
    ]) {
      test.describe(`when a ${surface} is opened directly on ${device}`, () => {
        test.use({ viewport });

        test('opens a drawer that can be closed', async ({ page }, testInfo) => {
          await page.goto(url);
          const panel = page.getByRole('dialog', { name: label });
          const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
          await expect(close).toBeVisible();
          const screenshot = testInfo.outputPath(`${surface.replaceAll(' ', '-')}-${device}.png`);
          await page.screenshot({ path: screenshot });
          await testInfo.attach(`${surface}-${device}`, { path: screenshot, contentType: 'image/png' });
          await close.click();
          await expect(panel).toBeHidden();
        });
      });
    }
  }

  test.describe('when deletion is requested from an open dataset item', () => {
    test('allows cancelling deletion above the item drawer', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const panel = page.getByRole('dialog', { name: 'Dataset item item-a' });
      await panel.getByRole('button', { name: 'Actions menu' }).click();
      await page.getByRole('menuitem', { name: 'Delete Item' }).click();
      const confirmation = page.getByRole('alertdialog', { name: 'Delete Item' });
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(confirmation).toBeHidden();
      await expect(panel).toBeVisible();
      await expect(panel.getByText('alpha', { exact: false })).toBeVisible();
    });
  });

  test.describe('when another item is selected after closing the drawer', () => {
    test('restores the previous selection with browser back', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const first = page.getByRole('dialog', { name: 'Dataset item item-a' });
      await expect(first).toBeVisible();
      await first.getByRole('button', { name: 'Close Panel', exact: true }).click();
      await expect(first).toBeHidden();
      await page.getByText('item-b', { exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Dataset item item-b' })).toBeVisible();
      await page.goBack();
      await page.goBack();
      await expect(page.getByRole('dialog', { name: 'Dataset item item-a' })).toBeVisible();
      await expect(page).toHaveURL(/\/datasets\/ds-1\/items\/item-a$/);
    });
  });

  test.describe('when a dataset item has long content', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/datasets/ds-1/items?*', route => route.fulfill({ json: longPanelItems }));
    });

    test('scrolls inside the card and keeps navigating', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const panel = page.getByRole('dialog', { name: 'Dataset item item-a' });
      await expect(panel.getByRole('button', { name: 'Close Panel', exact: true })).toBeVisible();
      const contentScrollTop = await scrollCardContent(page, panel);
      await expect.poll(contentScrollTop).toBeGreaterThan(0);
      expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
      await panel.getByRole('button', { name: 'Next item', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Dataset item item-b' })).toBeVisible();
    });
  });

  for (const { surface, url, label } of [
    { surface: 'experiment result', url: '/experiments/exp-1/items/item-1', label: 'Experiment item item-1' },
    {
      surface: 'review result',
      url: '/experiments/review-queue?experiment=exp-1&review=res-3',
      label: 'Review item res-3',
    },
  ]) {
    test.describe(`when the ${surface} has long content`, () => {
      test.beforeEach(async ({ page }) => {
        await page.route(
          url => url.pathname === '/api/datasets/ds-1/experiments/exp-1/results',
          route => route.fulfill({ json: longPanelResults }),
        );
      });

      test('scrolls inside the card and still closes', async ({ page }) => {
        await page.goto(url);
        const panel = page.getByRole('dialog', { name: label });
        const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
        await expect(close).toBeVisible();
        const contentScrollTop = await scrollCardContent(page, panel);
        await expect.poll(contentScrollTop).toBeGreaterThan(0);
        expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
        await close.click();
        await expect(panel).toBeHidden();
      });
    });
  }

  test.describe('when a result trace span is inspected', () => {
    test('stacks the trace drawer over the result and restores it after closing', async ({ page }) => {
      await page.goto('/experiments/exp-1/items/item-1');
      const panel = page.getByRole('dialog', { name: 'Experiment item item-1' });
      await expect(panel.getByText('first question', { exact: false })).toBeVisible();
      await panel.getByRole('button', { name: 'Trace', exact: true }).click();
      const trace = page.getByRole('dialog', { name: /^Trace / });
      await expect(trace).toBeVisible();
      await trace.getByText('Experiment tool call', { exact: true }).click();
      await expect(trace.getByRole('heading', { name: /span-child/ })).toBeVisible();
      await trace.getByRole('button', { name: 'Close Panel', exact: true }).last().click();
      await expect(trace.getByRole('heading', { name: /span-child/ })).toBeHidden();
      await trace.getByRole('button', { name: 'Close Panel', exact: true }).first().click();
      await expect(trace).toBeHidden();
      await expect(panel.getByText('first question', { exact: false })).toBeVisible();
    });
  });

  test.describe('when a review result is opened directly', () => {
    test('closes from the close control', async ({ page }) => {
      await page.goto('/experiments/review-queue?experiment=exp-1&review=res-3');
      const panel = page.getByRole('dialog', { name: 'Review item res-3' });
      const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
      await expect(close).toBeVisible();
      await close.click({ timeout: 3000 });
      await expect(panel).toBeHidden();
    });
  });
});
