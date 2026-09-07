import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { longPanelItems, longPanelResults, mockPanelRequests } from './__tests__/fixtures/item-review-panels';

function routeHeader(page: Page) {
  return page.locator('header').filter({ has: page.getByRole('navigation', { name: 'breadcrumb' }) });
}

async function expectFrameHeight(page: Page, panel: Locator) {
  await expect(async () => {
    const frame = await routeHeader(page)
      .locator('..')
      .evaluate(element => {
        const box = element.getBoundingClientRect();
        return { top: box.y + element.clientTop, bottom: box.y + element.clientTop + element.clientHeight };
      });
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeCloseTo(frame.top, 0);
    expect(box!.y + box!.height).toBeCloseTo(frame.bottom, 0);
  }).toPass({ timeout: 3000 });
}

async function expectCardInset(panel: Locator) {
  await expect(async () => {
    const panelBox = await panel.boundingBox();
    const cardBox = await panel.locator('section').first().boundingBox();
    expect(cardBox!.y).toBeCloseTo(panelBox!.y + 12, 0);
    expect(cardBox!.y + cardBox!.height).toBeCloseTo(panelBox!.y + panelBox!.height - 12, 0);
    expect(cardBox!.x).toBeCloseTo(panelBox!.x + 12, 0);
    expect(cardBox!.x + cardBox!.width).toBeCloseTo(panelBox!.x + panelBox!.width - 12, 0);
  }).toPass({ timeout: 3000 });
}

/**
 * Item details should cover the route header, not Studio navigation, so their
 * controls stay usable while inspecting data. Fixtures cross only the network
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

        test('covers the route header with a full-height inset card that can be closed', async ({ page }, testInfo) => {
          await page.goto(url);
          const panel = page.getByRole('dialog', { name: label });
          const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
          await expect(close).toBeVisible();
          await expectFrameHeight(page, panel);
          await expectCardInset(panel);
          const headerBox = await routeHeader(page).boundingBox();
          const cardBox = await panel.locator('section').first().boundingBox();
          const headerPoint = { x: cardBox!.x + cardBox!.width / 2, y: headerBox!.y + headerBox!.height - 2 };
          expect(
            await panel.evaluate(
              (element, point) => element.contains(document.elementFromPoint(point.x, point.y)),
              headerPoint,
            ),
          ).toBe(true);
          const screenshot = testInfo.outputPath(`${surface.replaceAll(' ', '-')}-${device}.png`);
          await page.screenshot({ path: screenshot });
          await testInfo.attach(`${surface}-${device}`, { path: screenshot, contentType: 'image/png' });
          await close.click();
          await expect(panel).not.toBeVisible();
        });
      });
    }
  }

  test.describe('when deletion is requested from an open dataset item', () => {
    test('allows cancelling deletion above the item overlay', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const panel = page.getByRole('dialog', { name: 'Dataset item item-a' });
      await panel.getByRole('button', { name: 'Actions menu' }).click();
      await page.getByRole('menuitem', { name: 'Delete Item' }).click();
      const confirmation = page.getByRole('alertdialog', { name: 'Delete Item' });
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(confirmation).not.toBeVisible();
      await expect(panel).toBeVisible();
      await expect(panel.getByText('alpha', { exact: false })).toBeVisible();
    });
  });

  test.describe('when another item is selected from the unobscured list', () => {
    test('restores the previous selection with browser back', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      await expect(page.getByRole('dialog', { name: 'Dataset item item-a' })).toBeVisible();
      await page.getByText('item-b', { exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Dataset item item-b' })).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('dialog', { name: 'Dataset item item-a' })).toBeVisible();
      await expect(page).toHaveURL(/\/datasets\/ds-1\/items\/item-a$/);
    });
  });

  test.describe('when a dataset item has long content', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/datasets/ds-1/items?*', route => route.fulfill({ json: longPanelItems }));
    });

    test('scrolls inside the card without moving its navigation controls', async ({ page }) => {
      await page.goto('/datasets/ds-1/items/item-a');
      const panel = page.getByRole('dialog', { name: 'Dataset item item-a' });
      const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
      await expect(close).toBeVisible();
      const card = panel.locator('section').first();
      const panelBox = await panel.boundingBox();
      const cardBox = await card.boundingBox();
      expect(cardBox!.y + cardBox!.height).toBeCloseTo(panelBox!.y + panelBox!.height - 12, 0);
      const closeBox = await close.boundingBox();
      const content = card.locator(':scope > div').last();
      await content.hover({ position: { x: 8, y: 8 } });
      await page.mouse.wheel(0, 1000);
      await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
      expect((await close.boundingBox())!.y).toBeCloseTo(closeBox!.y, 0);
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

      test('keeps the close control fixed while scrolling within the card', async ({ page }) => {
        await page.goto(url);
        const panel = page.getByRole('dialog', { name: label });
        const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
        await expect(close).toBeVisible();
        await expectCardInset(panel);
        const closeBox = await close.boundingBox();
        const content = panel.locator('section').first().locator(':scope > div').last();
        await content.hover({ position: { x: 8, y: 8 } });
        await page.mouse.wheel(0, 1000);
        await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
        expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
        expect((await close.boundingBox())!.y).toBeCloseTo(closeBox!.y, 0);
        await close.click();
        await expect(panel).not.toBeVisible();
      });
    });
  }

  test.describe('when an experiment result is opened directly', () => {
    test('fills the Studio frame including the route header', async ({ page }) => {
      await page.goto('/experiments/exp-1/items/item-1');
      const panel = page.getByRole('dialog', { name: 'Experiment item item-1' });
      await expect(panel.getByRole('button', { name: 'Close Panel', exact: true })).toBeVisible();
      await expectFrameHeight(page, panel);
    });
  });

  test.describe('when a result trace span is inspected', () => {
    test('restores the full-height result card after closing the expanded trace', async ({ page }) => {
      await page.goto('/experiments/exp-1/items/item-1');
      const panel = page.getByRole('dialog', { name: 'Experiment item item-1' });
      await expect(panel.getByText('first question', { exact: false })).toBeVisible();
      const initialBox = await panel.boundingBox();
      await panel.getByRole('button', { name: 'Trace', exact: true }).click();
      await panel.getByText('Experiment tool call', { exact: true }).click();
      const span = panel
        .locator('section')
        .filter({ has: page.getByText(/# span-child/) })
        .last();
      await expect(span).toBeVisible();
      await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(initialBox!.width * 1.5);
      await expectFrameHeight(page, panel);
      await span.getByRole('button', { name: 'Close Panel', exact: true }).click();
      const trace = panel.locator('section').filter({ has: page.getByText('Experiment agent run', { exact: true }) });
      await trace.getByRole('button', { name: 'Close Panel', exact: true }).click();
      await expect(panel.getByText('first question', { exact: false })).toBeVisible();
      await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(initialBox!.width, 0);
      await expectCardInset(panel);
    });
  });

  test.describe('when a review result is opened directly', () => {
    test('fills the Studio frame with the same card inset as trace details', async ({ page }) => {
      await page.goto('/experiments/review-queue?experiment=exp-1&review=res-3');
      const panel = page.getByRole('dialog', { name: 'Review item res-3' });
      await expect(panel.getByRole('button', { name: 'Close Panel', exact: true })).toBeVisible();
      await expectFrameHeight(page, panel);
      await expectCardInset(panel);
    });

    test('closes from the control over the route header', async ({ page }) => {
      await page.goto('/experiments/review-queue?experiment=exp-1&review=res-3');
      const panel = page.getByRole('dialog', { name: 'Review item res-3' });
      const close = panel.getByRole('button', { name: 'Close Panel', exact: true });
      await expect(close).toBeVisible();
      const header = page.locator('header').filter({ has: page.getByRole('navigation', { name: 'breadcrumb' }) });
      const headerBox = await header.boundingBox();
      const closeBox = await close.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(closeBox).not.toBeNull();
      expect(closeBox!.y).toBeLessThan(headerBox!.y + headerBox!.height);
      await close.click({ timeout: 3000 });
      await expect(panel).toHaveCount(0);
    });
  });
});
