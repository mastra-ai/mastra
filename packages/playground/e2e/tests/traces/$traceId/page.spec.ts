import { test, expect, type Page } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

const FAKE_TRACE_ID = 'trace-does-not-exist';

async function mockTraceResponse(page: Page, status: number, body: unknown = { error: 'mock' }) {
  // Match the lightweight trace endpoint (traces/:traceId/light) used by the trace detail page,
  // and the legacy single-segment trace-by-id endpoint. Leaves sibling endpoints (scores, etc.) untouched.
  await page.route('**/api/observability/traces/*/light', async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.route('**/api/observability/traces/*', async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.afterEach(async () => {
  await resetStorage();
});

test('shows page title with trace id', async ({ page }) => {
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  await expect(page).toHaveTitle(/Mastra Studio/);
  const title = page.locator('h1').first();
  await expect(title).toContainText('Trace');
  await expect(title).toContainText(FAKE_TRACE_ID);
});

test('has Back to Traces link pointing to observability', async ({ page }) => {
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  const backLink = page.getByRole('link', { name: 'Back to Traces' });
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute('href', '/observability');
});

test('clicking Back to Traces navigates to observability', async ({ page }) => {
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  await page.getByRole('link', { name: 'Back to Traces' }).click();
  await expect(page).toHaveURL(/\/observability$/);
  await expect(page.locator('h1').first()).toHaveText('Traces');
});

test('has Traces documentation link', async ({ page }) => {
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  await expect(page.getByRole('link', { name: 'Traces documentation' })).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/observability/tracing/overview',
  );
});

test('renders without crashing when spanId, tab and scoreId query params are provided on mount', async ({ page }) => {
  await page.goto(`/traces/${FAKE_TRACE_ID}?spanId=span-x&tab=scoring&scoreId=score-y`);

  // Page shell still renders - the panels themselves depend on server data that may not exist.
  await expect(page.locator('h1').first()).toContainText('Trace');
  await expect(page.getByRole('link', { name: 'Back to Traces' })).toBeVisible();
});

test('shows session-expired state when the trace request returns 401', async ({ page }) => {
  await mockTraceResponse(page, 401, { error: 'Unauthorized' });
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  await expect(page.getByText('Session Expired')).toBeVisible();
  // Shared top area still renders in the error state.
  await expect(page.getByRole('link', { name: 'Back to Traces' })).toBeVisible();
});

test('shows permission-denied state when the trace request returns 403', async ({ page }) => {
  await mockTraceResponse(page, 403, { error: 'Forbidden' });
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  await expect(page.getByText('Permission Denied')).toBeVisible();
  await expect(page.getByText(/You don't have permission to access traces/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Traces' })).toBeVisible();
});

test('shows generic error state when the trace request fails (non-auth error)', async ({ page }) => {
  // 404 is non-retryable (per `shouldRetryQuery`/`isNonRetryableError`) and neither 401 nor 403,
  // so it hits the generic-error branch without waiting on retry backoffs.
  await mockTraceResponse(page, 404, { error: 'Not found' });
  await page.goto(`/traces/${FAKE_TRACE_ID}`);

  await expect(page.getByText('Failed to load trace')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Traces' })).toBeVisible();
});
