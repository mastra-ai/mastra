import type { Page } from '@playwright/test';
import { traceQueryCapabilities } from '../../../src/pages/traces/__tests__/fixtures/trace-query';

/**
 * The kitchen-sink server stores observability in LibSQL, which does not support
 * trace queries. Specs that mock `/observability/traces/query` (or feedback) must
 * advertise the capability so Studio takes the trace-query path.
 */
export async function mockTraceQueryCapabilities(page: Page) {
  await page.route('**/api/observability/capabilities', route => route.fulfill({ json: traceQueryCapabilities }));
}
