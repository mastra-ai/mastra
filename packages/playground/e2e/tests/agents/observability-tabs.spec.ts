import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Agent observability tabs
 * USER STORY: Platform Studio users should evaluate, review, and inspect traces when observability is injected.
 * BEHAVIOR UNDER TEST: Runtime observability capability unlocks agent observability workflows without package metadata.
 *
 * Data flow: /api/system/packages reports the server observability capability, AgentLayout enables tabs,
 * and the Traces tab requests agent-scoped traces from the observability API.
 * This capability is runtime state from the Mastra instance and does not need to persist in browser storage.
 */

test.afterEach(async () => {
  await resetStorage();
});

async function mockSystemPackages(page: Page, observabilityEnabled: boolean) {
  await page.route('**/api/system/packages', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        packages: [],
        isDev: false,
        cmsEnabled: true,
        observabilityEnabled,
        storageType: 'LibSQLStore',
      }),
    });
  });
}

test('requests agent traces when runtime observability is available without package metadata', async ({ page }) => {
  await mockSystemPackages(page, true);

  let tracesUrl: URL | undefined;
  await page.route('**/api/observability/traces?**', async route => {
    tracesUrl = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        spans: [],
        pagination: { page: 0, perPage: 25, total: 0, hasMore: false },
      }),
    });
  });

  await page.goto('/agents/weather-agent/chat/new');
  await expect(page.getByRole('button', { name: 'Evaluate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review' })).toBeVisible();
  await page.getByRole('button', { name: 'Traces' }).click();

  await expect(page).toHaveURL(/\/agents\/weather-agent\/traces$/);
  await expect(page.getByText('No traces yet.')).toBeVisible();
  expect(tracesUrl?.searchParams.get('entityId')).toBe('weather-agent');
  expect(tracesUrl?.searchParams.get('entityType')).toBe('agent');
});

test('keeps agent observability tabs disabled when runtime observability is unavailable', async ({ page }) => {
  await mockSystemPackages(page, false);

  await page.goto('/agents/weather-agent/chat/new');
  await page.getByRole('main').getByText('Traces').hover();

  await expect(page.getByRole('tooltip').getByText('Add @mastra/observability to enable this tab.')).toBeVisible();
});
