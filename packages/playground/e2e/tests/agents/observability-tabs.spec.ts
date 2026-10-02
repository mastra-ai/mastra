import type { MastraClient } from '@mastra/client-js';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { mockTraceQueryCapabilities } from '../__utils__/mock-trace-query-capabilities';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Agent observability tabs
 * USER STORY: Platform Studio users should inspect traces when observability is injected.
 * BEHAVIOR UNDER TEST: Runtime observability capability unlocks agent observability workflows without package metadata.
 *
 * Data flow: /api/system/packages reports the server observability capability, AgentLayout enables tabs,
 * and the Traces tab requests agent-scoped traces from the observability API.
 * This capability is runtime state from the Mastra instance and does not need to persist in browser storage.
 */

const SAVED_FILTERS_KEYS = [
  'mastra:traces:saved-filters',
  'mastra:traces:saved-filters:agent:weather-agent',
  'mastra:traces:saved-filters:agent:om-agent',
];

test.afterEach(async ({ page }) => {
  await page
    .evaluate(keys => keys.forEach(key => localStorage.removeItem(key)), SAVED_FILTERS_KEYS)
    .catch(() => undefined);
  await resetStorage();
});

async function mockSystemPackages(page: Page, observabilityEnabled: boolean) {
  await mockTraceQueryCapabilities(page);
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

async function mockTraceLists(page: Page, onRequest?: (query: Parameters<MastraClient['queryTraces']>[0]) => void) {
  await page.route('**/api/observability/traces/query', async route => {
    expect(route.request().method()).toBe('POST');
    onRequest?.(route.request().postDataJSON());
    const response: Awaited<ReturnType<MastraClient['queryTraces']>> = { traces: [], page: { next: null } };
    await route.fulfill({ json: response });
  });
}

test.describe('Agent observability tabs', () => {
  test.describe('when runtime observability is available without package metadata', () => {
    test('requests agent-scoped traces from the Traces tab', async ({ page }) => {
      await mockSystemPackages(page, true);

      let traceQuery: Parameters<MastraClient['queryTraces']>[0] | undefined;
      await mockTraceLists(page, query => (traceQuery = query));

      await page.goto('/agents/weather-agent/overview');
      await page.getByRole('tab', { name: 'Traces' }).click();

      // The traces tab navigates to /agents/:id/traces; the page then enriches the URL
      // with scope filter params, so we assert the path without anchoring on $.
      await expect(page).toHaveURL(/\/agents\/weather-agent\/traces(\?|$)/);
      // With the scope filters pre-applied the empty-state copy comes from the list
      // view ("filters applied" variant), not the standalone NoTracesInfo screen.
      await expect(page.getByText(/No traces found for applied filters/i)).toBeVisible();
      await expect
        .poll(() => traceQuery?.where, { message: 'trace query is scoped to agent' })
        .toEqual({
          op: 'and',
          args: expect.arrayContaining([
            { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } },
            { spans: { some: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'weather-agent' } } } },
          ]),
        });
    });
  });

  test.describe('when runtime observability is unavailable', () => {
    test('keeps the agent observability tabs disabled', async ({ page }) => {
      await mockSystemPackages(page, false);

      await page.goto('/agents/weather-agent/overview');

      const tracesButton = page.getByRole('button', { name: 'Traces' });
      await expect(tracesButton).toBeDisabled();
      await expect(page.getByRole('tab', { name: 'Traces' })).toHaveCount(0);

      await tracesButton.hover();
      await expect(page.getByRole('tooltip')).toContainText('Add @mastra/observability to enable Traces.');
    });
  });

  test.describe('when the agent traces tab is visited for the first time', () => {
    test('pre-fills the agent filter as URL params', async ({ page }) => {
      await mockSystemPackages(page, true);

      let traceQuery: Parameters<MastraClient['queryTraces']>[0] | undefined;
      await mockTraceLists(page, query => (traceQuery = query));

      await page.goto('/agents/weather-agent/traces');

      // URL should be enriched with the scope filter params so the existing filter
      // pills render naturally.
      await expect(page).toHaveURL(/rootEntityType=agent/);
      await expect(page).toHaveURL(/filterEntityId=weather-agent/);

      // The API call should reflect those filter params (driven by URL state).
      await expect
        .poll(() => traceQuery?.where, { message: 'trace query is scoped to agent' })
        .toEqual({
          op: 'and',
          args: expect.arrayContaining([
            { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } },
            { spans: { some: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'weather-agent' } } } },
          ]),
        });
    });
  });

  test.describe('when the agent traces tab renders the scope filter', () => {
    test('hides the scope fields from the chips and the creator dropdown', async ({ page }) => {
      await mockSystemPackages(page, true);

      await mockTraceLists(page);

      await page.goto('/agents/weather-agent/traces');

      // The scope is applied through the URL but never surfaces as chips.
      await expect(page).toHaveURL(/filterEntityId=weather-agent/);
      await expect(page.getByRole('group', { name: /^Primitive Type/ })).toHaveCount(0);
      await expect(page.getByRole('group', { name: /^Primitive ID/ })).toHaveCount(0);

      // The filter input's field step must not expose the scope-controlled fields,
      // so users cannot recreate the filter and conflict with the scoped view.
      await page.getByRole('combobox', { name: 'Add filter' }).click();
      await expect(page.getByRole('option', { name: /Primitive Type/i })).toHaveCount(0);
      await expect(page.getByRole('option', { name: /Primitive ID/i })).toHaveCount(0);
      await expect(page.getByRole('option', { name: /Primitive Name/i })).toHaveCount(0);
      // A non-scope field is still listed so the filter input remains useful.
      await expect(page.getByRole('option', { name: /Trace ID/i })).toBeVisible();
    });
  });

  test.describe('when filters are saved in an agent-scoped traces tab', () => {
    test('does not leak the saved filters to other agents or the global view', async ({ page }) => {
      // Why this matters: TracesPage passes a per-agent localStorage key
      // (`mastra:traces:saved-filters:agent:<id>`) so that filter preferences saved
      // while reviewing weather-agent traces never bleed into another agent's tab
      // or the global /traces view. If someone reverts the scoped key (or
      // hardcodes the default), this test fails — the regression is otherwise
      // silent and only surfaces when two users blame each other for "ghost"
      // filters.
      await mockSystemPackages(page, true);
      await mockTraceLists(page);

      // Land on a page first so we have an origin to seed localStorage against.
      await page.goto('/traces');
      await page.evaluate(() => {
        localStorage.setItem('mastra:traces:saved-filters:agent:weather-agent', 'filterEnvironment=weather-prod');
      });

      // Weather-agent should hydrate its own saved filter alongside the scope.
      await page.goto('/agents/weather-agent/traces');
      await expect(page).toHaveURL(/filterEnvironment=weather-prod/);
      await expect(page).toHaveURL(/filterEntityId=weather-agent/);

      // Another agent must NOT see weather-agent's saved filter.
      await page.goto('/agents/om-agent/traces');
      await expect(page).toHaveURL(/filterEntityId=om-agent/);
      await expect(page).not.toHaveURL(/filterEnvironment=weather-prod/);

      // The global view uses the default (unscoped) key, so it must not read the
      // agent-scoped saved set either.
      await page.goto('/traces');
      await expect(page).not.toHaveURL(/filterEnvironment=weather-prod/);
    });
  });

  test.describe('when the global /traces page is visited', () => {
    test('keeps the filter pills editable', async ({ page }) => {
      await mockSystemPackages(page, true);

      await mockTraceLists(page);

      await page.goto('/traces');

      // The filter input's field step surfaces the entity-type field that the
      // agent scope hides — guards against accidentally hiding it everywhere.
      await page.getByRole('combobox', { name: 'Add filter' }).click();
      await expect(page.getByRole('option', { name: /Primitive Type/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Primitive ID/i })).toBeVisible();

      // No locked chips should ever render in the global view.
      await expect(page.locator('[data-slot="filter-bar-chip"][data-readonly]')).toHaveCount(0);
    });
  });
});
