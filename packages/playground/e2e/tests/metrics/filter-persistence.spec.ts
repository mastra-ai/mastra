import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

const METRICS_FILTERS_STORAGE_KEY = 'mastra:metrics:saved-filters';
const TRACE_FILTERS_STORAGE_KEY = 'mastra:traces:saved-filters';
const LOGS_FILTERS_STORAGE_KEY = 'mastra:logs:saved-filters';

const STORAGE_KEYS = [METRICS_FILTERS_STORAGE_KEY, TRACE_FILTERS_STORAGE_KEY, LOGS_FILTERS_STORAGE_KEY];

test.afterEach(async ({ page }) => {
  await page.evaluate(keys => keys.forEach(key => localStorage.removeItem(key)), STORAGE_KEYS).catch(() => undefined);
  await resetStorage();
});

/**
 * FEATURE: Observability filter persistence
 * USER STORY: As a user, I want Metrics, Traces, and Logs to each remember their own saved filters.
 * BEHAVIOR UNDER TEST: Each observability page hydrates only from its own localStorage key when the URL is clean.
 */
test('saved filters hydrate separately for metrics, traces, and logs pages', async ({ page }) => {
  await page.goto('/metrics');
  await page.evaluate(([metricsKey, tracesKey, logsKey]) => {
    localStorage.setItem(metricsKey, 'filterEnvironment=metrics-env&filterEntityName=MetricsAgent');
    localStorage.setItem(tracesKey, 'filterEnvironment=traces-env&filterEntityName=TracesAgent');
    localStorage.setItem(logsKey, 'filterEnvironment=logs-env&filterEntityName=LogsAgent');
  }, STORAGE_KEYS);

  await page.goto('/metrics');
  await expect(page).toHaveURL(/filterEnvironment=metrics-env/);
  await expect(page).toHaveURL(/filterEntityName=MetricsAgent/);

  await page.goto('/observability');
  await expect(page).toHaveURL(/filterEnvironment=traces-env/);
  await expect(page).toHaveURL(/filterEntityName=TracesAgent/);

  await page.goto('/logs');
  await expect(page).toHaveURL(/filterEnvironment=logs-env/);
  await expect(page).toHaveURL(/filterEntityName=LogsAgent/);
});
