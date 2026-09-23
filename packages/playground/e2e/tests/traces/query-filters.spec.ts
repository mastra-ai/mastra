import { expect, test } from '@playwright/test';
import { traceQueryPage } from '../../../src/pages/traces/__tests__/fixtures/trace-query';

// URL filters must reach the appropriate endpoint and retain their meaning after reload.
test.describe('Trace query filtering', () => {
  test.describe('when filtering traces by entity name', () => {
    test('sends the predicate to /observability/traces/query and shows only matching rows', async ({ page }) => {
      await page.route('**/api/observability/traces/query', route => {
        expect(route.request().postDataJSON()).toMatchObject({
          where: { op: 'and', args: [{ op: 'eq', left: { path: 'entityName' }, right: { literal: 'preview' } }] },
        });
        return route.fulfill({ json: traceQueryPage });
      });
      await page.goto('/traces?filterEntityName=preview');
      await expect(page.getByText('Studio preview agent', { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText('Studio preview agent', { exact: true })).toBeVisible();
    });
  });

  test.describe('when opening an obsolete service-name filter URL', () => {
    test('uses trace queries without requesting a legacy list', async ({ page }) => {
      let legacyRequests = 0;
      await page.route('**/api/observability/traces/query', route => {
        expect(route.request().postDataJSON().where).toBeUndefined();
        return route.fulfill({ json: traceQueryPage });
      });
      page.on('request', request => {
        if (
          request.method() === 'GET' &&
          /\/observability\/(traces(?:\/light)?|branches)$/.test(new URL(request.url()).pathname)
        )
          legacyRequests++;
      });
      await page.goto('/traces?filterServiceName=preview-service');
      await expect(page.getByText('Studio preview agent', { exact: true })).toBeVisible();
      expect(legacyRequests).toBe(0);
    });
  });
});
