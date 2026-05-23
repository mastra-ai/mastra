import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

test('renders metrics dashboard with title and date preset', async ({ page }) => {
  await page.goto('/metrics');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expectCurrentBreadcrumb(page, 'Metrics');
  await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
});

test('renders Memory card with thread/resource tabs when metrics are available', async ({ page }) => {
  await page.goto('/metrics');

  const unsupportedStorageNotice = page.getByRole('heading', {
    name: 'Metrics are not available with your current storage',
  });
  await page
    .getByRole('heading', { name: /^(Memory|Metrics are not available with your current storage)$/ })
    .first()
    .waitFor();
  test.skip(
    await unsupportedStorageNotice.isVisible(),
    'Metrics are not available with the current kitchen-sink storage',
  );

  await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();

  await expect(page.getByRole('tab', { name: 'Threads' })).toBeVisible();
  const resourcesTab = page.getByRole('tab', { name: 'Resources' });
  await expect(resourcesTab).toBeVisible();

  await resourcesTab.click();
  await expect(resourcesTab).toHaveAttribute('aria-selected', 'true');
});

test('does not probe metrics endpoints when storage capabilities are unsupported', async ({ page }) => {
  await page.route('**/api/system/packages', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        packages: [],
        isDev: false,
        cmsEnabled: true,
        observabilityEnabled: true,
        storageType: 'LibSQLStore',
        observabilityStorageType: 'ObservabilityStorage',
        observabilityStorageCapabilities: {
          tracing: {
            preferredStrategy: 'batch-with-updates',
            supportedStrategies: ['batch-with-updates'],
            runtimeStrategy: 'batch-with-updates',
          },
          logs: {
            persist: false,
            list: false,
          },
          metrics: {
            persist: false,
            list: false,
            aggregate: false,
            breakdown: false,
            timeSeries: false,
            percentiles: false,
            discovery: false,
          },
          persistence: 'persistent',
        },
      }),
    });
  });

  const unexpectedRequests: string[] = [];
  await page.route('**/api/observability/metrics**', async route => {
    unexpectedRequests.push(route.request().url());
    await route.fulfill({ status: 500, body: 'unexpected metrics request' });
  });
  await page.route('**/api/observability/discovery/**', async route => {
    unexpectedRequests.push(route.request().url());
    await route.fulfill({ status: 500, body: 'unexpected discovery request' });
  });

  await page.goto('/metrics');

  await expect(
    page.getByRole('heading', { name: 'Metrics are not available with your current storage' }),
  ).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

test('persists dimensional filter as URL param', async ({ page }) => {
  await page.goto('/metrics?filterEnvironment=production');

  await expect(page).toHaveURL(/filterEnvironment=production/);
  // The toolbar should show the active filter pill
  await expect(page.getByText('production')).toBeVisible();
});

test('changing date preset updates URL', async ({ page }) => {
  await page.goto('/metrics');

  await page.getByRole('button', { name: 'Last 24 hours' }).click();
  await page.getByRole('menuitem', { name: 'Last 7 days' }).click();

  await expect(page).toHaveURL(/period=7d/);
});
