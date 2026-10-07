import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

function cardByTitle(page: Page, title: string): Locator {
  return page.locator('div.border-border1', {
    has: page.getByRole('heading', { name: title, exact: true }),
  });
}

async function gotoMetricsOrSkip(page: Page, url = '/metrics') {
  await page.goto(url);

  const unsupportedStorageNotice = page.getByRole('heading', {
    name: 'Metrics are not available with your current storage',
  });
  await page
    .getByRole('heading', { name: /^(Latency|Metrics are not available with your current storage)$/ })
    .first()
    .waitFor();
  test.skip(
    await unsupportedStorageNotice.isVisible(),
    'Metrics are not available with the current kitchen-sink storage',
  );
}

test.describe('Metrics dashboard drilldown buttons', () => {
  test.describe('when the Latency card is shown on the agents tab', () => {
    test('opens traces filtered to the active tab rootEntityType', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      await cardByTitle(page, 'Latency').getByRole('button', { name: 'View in Traces' }).click();

      await expect(page).toHaveURL(/\/traces\?/);
      expect(page.url()).toContain('datePreset=last-24h');
      expect(page.url()).toContain('rootEntityType=agent');
    });
  });

  test.describe('when the Latency card Workflows tab is active', () => {
    test('honors the active tab in the drilldown', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      const latencyCard = cardByTitle(page, 'Latency');
      await latencyCard.getByRole('tab', { name: 'Workflows' }).click();
      await latencyCard.getByRole('button', { name: 'View in Traces' }).click();

      await expect(page).toHaveURL(/rootEntityType=workflow_run/);
    });
  });

  test.describe('when the Trace Volume card is shown', () => {
    test('opens errors in logs from the logs drilldown button', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      const card = cardByTitle(page, 'Trace Volume');
      await expect(card.getByRole('button', { name: 'View in Traces' })).toBeVisible();
      await card.getByRole('button', { name: 'View errors in Logs' }).click();

      await expect(page).toHaveURL(/\/logs\?/);
      expect(page.url()).toContain('filterLevel=error');
      expect(page.url()).toContain('rootEntityType=agent');
    });
  });

  test.describe('when the dashboard has a dimensional filter applied', () => {
    test('preserves the dashboard dimensional filters in the drilldown', async ({ page }) => {
      await gotoMetricsOrSkip(page, '/metrics?filterEnvironment=prod');

      await cardByTitle(page, 'Latency').getByRole('button', { name: 'View in Traces' }).click();

      await expect(page).toHaveURL(/filterEnvironment=prod/);
    });
  });

  test.describe('when the dashboard uses a 7-day metrics preset', () => {
    test('propagates the preset to the drilldown as last-7d', async ({ page }) => {
      await gotoMetricsOrSkip(page, '/metrics?period=7d');

      await cardByTitle(page, 'Latency').getByRole('button', { name: 'View in Traces' }).click();

      await expect(page).toHaveURL(/datePreset=last-7d/);
    });
  });

  test.describe('when the Model Usage card is shown', () => {
    test('exposes a traces drilldown button', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      await expect(
        cardByTitle(page, 'Model Usage & Cost').getByRole('button', { name: 'View in Traces' }),
      ).toBeAttached();
    });
  });
});
