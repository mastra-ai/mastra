import { expect, test } from '@playwright/test';
import { traceQueryPage } from '../../../src/pages/traces/__tests__/fixtures/trace-query';
import { traceList } from '../../../src/pages/traces/__tests__/fixtures/traces';

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

  test.describe('when filtering by service name', () => {
    test('falls back to the list endpoint', async ({ page }) => {
      let queries = 0;
      await page.route('**/api/observability/traces/query', route => {
        queries++;
        return route.fulfill({ json: traceQueryPage });
      });
      await page.route('**/api/observability/traces/light?*', route => {
        expect(new URL(route.request().url()).searchParams.get('serviceName')).toBe('preview-service');
        return route.fulfill({ json: traceList });
      });
      await page.goto('/traces?filterServiceName=preview-service');
      await expect(page.getByText('Studio preview agent', { exact: true })).toBeVisible();
      expect(queries).toBe(0);
    });
  });
});
