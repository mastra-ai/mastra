import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

const UNSUPPORTED_STORAGE = 'Metrics are not available with your current storage';

/**
 * The Metrics page's card titled `title`, once it shows. Skips the test on storage without metrics, or
 * when the page shows `otherLayout` instead (a card of the layout for storage without aggregates).
 */
async function metricsCard(page: Page, title: string, otherLayout?: string) {
  await page.goto('/metrics');
  const names = [title, UNSUPPORTED_STORAGE, ...(otherLayout ? [otherLayout] : [])];
  await page
    .getByRole('heading', { name: new RegExp(`^(${names.join('|')})$`) })
    .first()
    .waitFor();
  test.skip(
    await page.getByRole('heading', { name: UNSUPPORTED_STORAGE }).isVisible(),
    'Metrics are not available with the current kitchen-sink storage',
  );
  if (otherLayout) {
    test.skip(
      await page.getByRole('heading', { name: otherLayout, exact: true }).isVisible(),
      `The kitchen-sink storage shows ${otherLayout} instead`,
    );
  }
  return page
    .locator('[class*="group/metrics-card"]')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

test.describe('Metrics dashboard page', () => {
  test.describe('when the metrics page is opened', () => {
    test('renders the dashboard with title and date preset', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Metrics');
      await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
    });
  });

  test.describe('when the dashboard loads', () => {
    test('shows the Scores card and no Memory card, like Platform', async ({ page }) => {
      await page.goto('/metrics');

      const unsupportedStorageNotice = page.getByRole('heading', {
        name: 'Metrics are not available with your current storage',
      });
      await page
        .getByRole('heading', { name: /^(Scores|Metrics are not available with your current storage)$/ })
        .first()
        .waitFor();
      test.skip(
        await unsupportedStorageNotice.isVisible(),
        'Metrics are not available with the current kitchen-sink storage',
      );

      await expect(page.getByRole('heading', { name: 'Scores' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Memory' })).toHaveCount(0);
    });
  });

  test.describe('when a card has several views', () => {
    test('shows every view as a tab under the title', async ({ page }) => {
      const card = await metricsCard(page, 'Token usage');

      await expect(card.getByRole('tab', { name: 'Model cost' })).toBeVisible();
    });

    test('switches the view from its tab', async ({ page }) => {
      const card = await metricsCard(page, 'Token usage');

      await card.getByRole('tab', { name: 'Model cost' }).click();

      await expect(card.getByRole('tab', { name: 'Model cost' })).toHaveAttribute('aria-selected', 'true');
    });

    // Every card keeps its tabs while its view swaps, so the tab picked keeps the focus, and the pill slides to it.
    for (const [title, tab, otherLayout] of [
      ['Token usage', 'Model cost'],
      ['Agent runs', 'Failure rate'],
      ['Latency', 'Workflow latency'],
      ['Breakdown', 'Tools', 'Trace volume'],
    ] as const) {
      test(`keeps the ${title} tab just picked focused`, async ({ page }) => {
        const card = await metricsCard(page, title, otherLayout);
        const picked = card.getByRole('tab', { name: tab, exact: true });

        await picked.click();

        await expect(picked).toHaveAttribute('aria-selected', 'true');
        await expect(picked).toBeFocused();
      });
    }
  });

  test.describe('when a card is too narrow for all its tabs', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('keeps the tab just picked in view', async ({ page }) => {
      const card = await metricsCard(page, 'Breakdown', 'Trace volume');
      const environments = card.getByRole('tab', { name: 'Environments' });

      await environments.click();

      await expect(environments).toHaveAttribute('aria-selected', 'true');
      await expect(environments).toBeInViewport({ ratio: 1 });
    });
  });

  test.describe('when a dimensional filter is present in the URL', () => {
    test('persists the dimensional filter as a URL param', async ({ page }) => {
      await page.goto('/metrics?filterEnvironment=production');

      await expect(page).toHaveURL(/filterEnvironment=production/);
      // The filter bar should show the active filter chip
      await expect(page.getByText('production')).toBeVisible();
    });
  });

  test.describe('when the date preset is changed', () => {
    test('updates the URL with the new period', async ({ page }) => {
      await page.goto('/metrics');

      await page.getByRole('button', { name: 'Last 24 hours' }).click();
      await page.getByRole('menuitemradio', { name: 'Last 7 days' }).click();

      await expect(page).toHaveURL(/period=7d/);
    });
  });
});
