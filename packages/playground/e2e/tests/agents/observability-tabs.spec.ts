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
  await expect(page.getByRole('tab', { name: 'Evaluate' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Review' })).toBeVisible();
  await page.getByRole('tab', { name: 'Traces' }).click();

  // The traces tab navigates to /agents/:id/traces; the page then enriches the URL
  // with scope filter params, so we assert the path without anchoring on $.
  await expect(page).toHaveURL(/\/agents\/weather-agent\/traces(\?|$)/);
  // With the scope filters pre-applied the empty-state copy comes from the list
  // view ("filters applied" variant), not the standalone NoTracesInfo screen.
  await expect(page.getByText(/No traces found for applied filters/i)).toBeVisible();
  expect(tracesUrl?.searchParams.get('entityId')).toBe('weather-agent');
  expect(tracesUrl?.searchParams.get('entityType')).toBe('agent');
});

test('keeps agent observability tabs disabled when runtime observability is unavailable', async ({ page }) => {
  await mockSystemPackages(page, false);

  await page.goto('/agents/weather-agent/chat/new');
  await page.getByRole('main').getByText('Traces').hover();

  await expect(page.getByRole('tooltip').getByText('Add @mastra/observability to enable this tab.')).toBeVisible();
});

test('agent traces tab pre-fills the agent filter as URL params on first visit', async ({ page }) => {
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

  await page.goto('/agents/weather-agent/traces');

  // URL should be enriched with the scope filter params so the existing filter
  // pills render naturally.
  await expect(page).toHaveURL(/rootEntityType=agent/);
  await expect(page).toHaveURL(/filterEntityId=weather-agent/);

  // The API call should reflect those filter params (driven by URL state).
  expect(tracesUrl?.searchParams.get('entityType')).toBe('agent');
  expect(tracesUrl?.searchParams.get('entityId')).toBe('weather-agent');
});

test('agent traces tab locks the scope filter pills and hides them from the creator dropdown', async ({ page }) => {
  await mockSystemPackages(page, true);

  await page.route('**/api/observability/traces?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        spans: [],
        pagination: { page: 0, perPage: 25, total: 0, hasMore: false },
      }),
    });
  });

  await page.goto('/agents/weather-agent/traces');

  // Scope pills render as locked — read-only, no Remove (×) affordance.
  const rootTypePill = page.locator('[data-property-filter-pill="locked"][data-locked-field-id="rootEntityType"]');
  const entityIdPill = page.locator('[data-property-filter-pill="locked"][data-locked-field-id="entityId"]');
  await expect(rootTypePill).toBeVisible();
  await expect(entityIdPill).toBeVisible();
  await expect(rootTypePill.locator('text="Agent"')).toBeVisible();
  await expect(entityIdPill.locator('text="weather-agent"')).toBeVisible();
  await expect(page.getByRole('button', { name: /Remove Primitive Type filter/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Remove Primitive ID filter/i })).toHaveCount(0);

  // Opening the Add Filter dropdown must not expose the scope-controlled fields,
  // so users cannot recreate the filter and conflict with the scoped view.
  await page.getByRole('button', { name: /Add Filter/i }).click();
  await expect(page.getByRole('menuitem', { name: /Primitive Type/i })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /Primitive ID/i })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /Primitive Name/i })).toHaveCount(0);
  // A non-scope field is still listed so the filter dropdown remains useful.
  await expect(page.getByRole('menuitem', { name: /Trace ID/i })).toBeVisible();
});

test('global /observability traces page keeps the filter pills editable', async ({ page }) => {
  await mockSystemPackages(page, true);

  await page.route('**/api/observability/traces?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        spans: [],
        pagination: { page: 0, perPage: 25, total: 0, hasMore: false },
      }),
    });
  });

  await page.goto('/observability');

  // The Add Filter dropdown surfaces the entity-type field that the agent
  // scope hides — guards against accidentally hiding it everywhere.
  await page.getByRole('button', { name: /Add Filter/i }).click();
  await expect(page.getByRole('menuitem', { name: /Primitive Type/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Primitive ID/i })).toBeVisible();

  // No locked pills should ever render in the global view.
  await expect(page.locator('[data-property-filter-pill="locked"]')).toHaveCount(0);
});
