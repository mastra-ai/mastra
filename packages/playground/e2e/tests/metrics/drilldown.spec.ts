import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

function cardByTitle(page: Page, title: string): Locator {
  return page.locator('div.group\\/metrics-card', {
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

async function clickAndReadUrl(page: Page, button: Locator, pathname: string): Promise<URL> {
  await button.click();
  await page.waitForURL(url => url.pathname.endsWith(pathname));
  return new URL(page.url());
}

test.describe('Metrics dashboard drilldown buttons', () => {
  test.describe('when the Latency card is shown on the agents tab', () => {
    test('opens traces filtered to the active tab rootEntityType', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      const button = cardByTitle(page, 'Latency').getByRole('button', { name: 'View in Traces' });
      const url = await clickAndReadUrl(page, button, '/traces');

      expect(url.searchParams.get('datePreset')).toBe('last-24h');
      expect(url.searchParams.get('rootEntityType')).toBe('agent');
    });
  });

  test.describe('when the Latency card Workflows tab is active', () => {
    test('opens traces for workflow runs', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      const latencyCard = cardByTitle(page, 'Latency');
      await latencyCard.getByRole('tab', { name: 'Workflows' }).click();
      const url = await clickAndReadUrl(page, latencyCard.getByRole('button', { name: 'View in Traces' }), '/traces');

      expect(url.searchParams.get('rootEntityType')).toBe('workflow_run');
    });
  });

  test.describe('when the Trace volume card is shown', () => {
    test('opens agent errors in logs', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      const button = cardByTitle(page, 'Trace volume').getByRole('button', { name: 'View errors in Logs' });
      const url = await clickAndReadUrl(page, button, '/logs');

      expect(url.searchParams.get('filterLevel')).toBe('error');
      expect(url.searchParams.get('rootEntityType')).toBe('agent');
    });
  });

  test.describe('when the dashboard has a dimensional filter applied', () => {
    test('keeps the filter in the traces URL', async ({ page }) => {
      await gotoMetricsOrSkip(page, '/metrics?filterEnvironment=prod');

      const button = cardByTitle(page, 'Latency').getByRole('button', { name: 'View in Traces' });
      const url = await clickAndReadUrl(page, button, '/traces');

      expect(url.searchParams.get('filterEnvironment')).toBe('prod');
    });
  });

  test.describe('when the dashboard uses a 7-day metrics preset', () => {
    test('opens traces with the last-7d preset', async ({ page }) => {
      await gotoMetricsOrSkip(page, '/metrics?period=7d');

      const button = cardByTitle(page, 'Latency').getByRole('button', { name: 'View in Traces' });
      const url = await clickAndReadUrl(page, button, '/traces');

      expect(url.searchParams.get('datePreset')).toBe('last-7d');
    });
  });

  test.describe('when the Usage card is shown', () => {
    test('opens traces', async ({ page }) => {
      await gotoMetricsOrSkip(page);

      const button = cardByTitle(page, 'Usage').getByRole('button', { name: 'View in Traces' });
      const url = await clickAndReadUrl(page, button, '/traces');

      expect(url.pathname).toMatch(/\/traces$/);
    });
  });
});
