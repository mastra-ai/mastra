import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectBreadcrumbLink, expectCurrentBreadcrumb, expectRouteDocsLink } from '../../__utils__/route-header';

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

test.describe('Trace detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the trace detail page is opened', () => {
    test('shows page title with trace id', async ({ page }) => {
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'trace');
    });

    test('has breadcrumb link pointing back to observability', async ({ page }) => {
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await expectBreadcrumbLink(page, 'Traces', '/observability');
    });

    test('has Traces documentation link', async ({ page }) => {
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await expectRouteDocsLink(
        page,
        'Traces documentation',
        'https://mastra.ai/en/docs/observability/tracing/overview',
      );
    });
  });

  test.describe('when the Traces breadcrumb is clicked', () => {
    test('navigates to observability', async ({ page }) => {
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Traces' }).click();
      await expect(page).toHaveURL(/\/observability$/);
      await expectCurrentBreadcrumb(page, 'Traces');
    });
  });

  test.describe('when spanId, tab and scoreId query params are provided on mount', () => {
    test('renders the page shell without crashing', async ({ page }) => {
      await page.goto(`/traces/${FAKE_TRACE_ID}?spanId=span-x&tab=scoring&scoreId=score-y`);

      // Page shell still renders - the panels themselves depend on server data that may not exist.
      await expectCurrentBreadcrumb(page, 'trace');
      await expectBreadcrumbLink(page, 'Traces', '/observability');
    });
  });

  test.describe('when the trace request returns 401', () => {
    test('shows the session-expired state', async ({ page }) => {
      await mockTraceResponse(page, 401, { error: 'Unauthorized' });
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await expect(page.getByText('Session Expired')).toBeVisible();
      // Shared top area still renders in the error state.
      await expectBreadcrumbLink(page, 'Traces', '/observability');
    });
  });

  test.describe('when the trace request returns 403', () => {
    test('shows the permission-denied state', async ({ page }) => {
      await mockTraceResponse(page, 403, { error: 'Forbidden' });
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await expect(page.getByText('Permission Denied')).toBeVisible();
      await expect(page.getByText(/You don't have permission to access traces/)).toBeVisible();
      await expectBreadcrumbLink(page, 'Traces', '/observability');
    });
  });

  test.describe('when the trace request fails with a non-auth error', () => {
    test('shows the generic error state', async ({ page }) => {
      // 404 is non-retryable (per `shouldRetryQuery`/`isNonRetryableError`) and neither 401 nor 403,
      // so it hits the generic-error branch without waiting on retry backoffs.
      await mockTraceResponse(page, 404, { error: 'Not found' });
      await page.goto(`/traces/${FAKE_TRACE_ID}`);

      await expect(page.getByText('Failed to load trace')).toBeVisible();
      await expectBreadcrumbLink(page, 'Traces', '/observability');
    });
  });
});
