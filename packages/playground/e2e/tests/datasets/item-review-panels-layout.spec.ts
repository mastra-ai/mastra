import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { longPanelItems, longPanelResults, mockPanelRequests } from './__tests__/fixtures/item-review-panels';

/** A drawer dialog wraps the card in a popup; an inline panel is the card itself. */
function card(panel: Locator, inline = false) {
  return inline ? panel : panel.locator('section').first();
}

/**
 * On desktop the experiment result docks inline in the route side panel (a
 * named region); narrower screens keep the drawer dialog.
 */
/** On desktop the dataset item docks inline in the route side panel. */
function datasetItem(page: Page, itemId: string) {
  return page.getByRole('region', { name: `Dataset item ${itemId}` });
}

function experimentResult(page: Page) {
  return page.getByRole('region', { name: 'Experiment item item-1' });
}

/**
 * Wheel-scrolls inside the card's content area and returns how far the card's
 * own scroll region moved, regardless of tabs or other wrappers around it.
 */
async function scrollCardContent(page: Page, panel: Locator, inline = false) {
  const target = card(panel, inline);
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
 * Item details open as a modal drawer, except dataset items and experiment
 * results on desktop, which sit inline in the route side panel. Fixtures cross only the network
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
    for (const { surface, url, label, inline = false } of [
      {
        surface: 'dataset item',
        url: '/datasets/ds-1/items/item-a',
        label: 'Dataset item item-a',
        inline: device === 'desktop',
      },
      {
        surface: 'experiment result',
        url: '/experiments/exp-1/items/item-1',
        label: 'Experiment item item-1',
        inline: device === 'desktop',
      },
      {
        surface: 'review result',
        url: '/experiments/review-queue?experiment=exp-1&review=res-3',
        label: 'Review item res-3',
      },
    ]) {
      test.describe(`when a ${surface} is opened directly on ${device}`, () => {
        test.use({ viewport });

        test(`opens ${inline ? 'an inline panel' : 'a drawer'} that can be closed`, async ({ page }, testInfo) => {
          await page.goto(url);
          const panel = page.getByRole(inline ? 'region' : 'dialog', { name: label });
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
    test('allows cancelling deletion above the item panel', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const panel = datasetItem(page, 'item-a');
      await panel.getByRole('button', { name: 'Open actions menu' }).click();
      await page.getByRole('menuitem', { name: 'Delete Item' }).click();
      const confirmation = page.getByRole('alertdialog', { name: 'Delete Item' });
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(confirmation).toBeHidden();
      await expect(panel).toBeVisible();
      await expect(panel.getByText('alpha', { exact: false })).toBeVisible();
    });
  });

  test.describe('when another item is selected after closing the panel', () => {
    test('restores the previous selection with browser back', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const first = datasetItem(page, 'item-a');
      await expect(first).toBeVisible();
      await first.getByRole('button', { name: 'Close Panel', exact: true }).click();
      await expect(first).toBeHidden();
      await page.getByText('item-b', { exact: true }).click();
      await expect(datasetItem(page, 'item-b')).toBeVisible();
      await page.goBack();
      await page.goBack();
      await expect(datasetItem(page, 'item-a')).toBeVisible();
      await expect(page).toHaveURL(/\/datasets\/ds-1\/items\/item-a$/);
    });
  });

  test.describe('when a dataset item has long content', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/datasets/ds-1/items?*', route => route.fulfill({ json: longPanelItems }));
    });

    test('scrolls inside the card and keeps navigating', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const panel = datasetItem(page, 'item-a');
      await expect(panel.getByRole('button', { name: 'Close Panel', exact: true })).toBeVisible();
      // Payloads are clipped until expanded, so open one to overflow the card.
      await panel.getByRole('region', { name: 'Input' }).getByRole('button', { name: 'Expand' }).click();
      const contentScrollTop = await scrollCardContent(page, panel, true);
      await expect.poll(contentScrollTop).toBeGreaterThan(0);
      expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
      await panel.getByRole('button', { name: 'Go to next item', exact: true }).click();
      await expect(datasetItem(page, 'item-b')).toBeVisible();
    });
  });

  for (const { surface, url, label, inline = false } of [
    {
      surface: 'experiment result',
      url: '/experiments/exp-1/items/item-1',
      label: 'Experiment item item-1',
      inline: true,
    },
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
        const panel = page.getByRole(inline ? 'region' : 'dialog', { name: label });
        const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
        await expect(close).toBeVisible();
        // Payloads are clipped until expanded, so open one to overflow the card.
        await panel.getByRole('region', { name: 'Input' }).getByRole('button', { name: 'Expand' }).click();
        const contentScrollTop = await scrollCardContent(page, panel, inline);
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
      const panel = experimentResult(page);
      await expect(panel.getByText('first question', { exact: false })).toBeVisible();
      await panel.getByRole('button', { name: 'See trace', exact: true }).click();
      const trace = page.getByRole('dialog', { name: /^Trace / });
      await expect(trace).toBeVisible();
      await trace.getByText('Experiment tool call', { exact: true }).click();
      await expect(trace.getByRole('heading', { name: /child1/ })).toBeVisible();
      // The span column has no close button: clicking the selected span again toggles it off.
      await trace.getByText('Experiment tool call', { exact: true }).click();
      await expect(trace.getByRole('heading', { name: /child1/ })).toBeHidden();
      await trace.getByRole('button', { name: 'Close trace', exact: true }).click();
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
