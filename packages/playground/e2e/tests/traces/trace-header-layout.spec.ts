import type { MastraClient } from '@mastra/client-js';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { mockTraceQueryCapabilities } from '../__utils__/mock-trace-query-capabilities';
import { resetStorage } from '../__utils__/reset-storage';

const TRACE_ID = 'header-layout-trace';

const rootSpan = {
  traceId: TRACE_ID,
  spanId: 'agent-root',
  parentSpanId: null,
  name: 'Weather agent run',
  spanType: 'agent_run' as const,
  isEvent: false,
  threadId: 'header-layout-thread',
  entityType: 'agent',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  startedAt: '2026-08-30T12:00:00.000Z',
  endedAt: '2026-08-30T12:00:02.940Z',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: null,
  input: {
    __isCreatedSignal: true,
    id: 'user-signal-1',
    type: 'user',
    tagName: 'user',
    contents: [{ type: 'text', text: 'Find the weather in Paris' }],
    createdAt: '2026-08-30T12:00:00.000Z',
  },
  output: { text: 'Paris will be sunny today.' },
  attributes: { usage: { inputTokens: 418, outputTokens: 302 } },
};

async function openTrace(page: Page) {
  await mockTraceQueryCapabilities(page);
  await page.route('**/api/observability/traces/query', route => {
    const response: Awaited<ReturnType<MastraClient['queryTraces']>> = { traces: [], page: { next: null } };
    return route.fulfill({ json: response });
  });
  await page.route(`**/api/observability/traces/${TRACE_ID}`, route =>
    route.fulfill({ json: { traceId: TRACE_ID, spans: [rootSpan] } }),
  );
  // A second trace in the same thread is what makes "Open full thread" worth showing.
  await page.route('**/api/observability/traces/light?**', route => {
    const response: Awaited<ReturnType<MastraClient['listTracesLight']>> = {
      spans: [rootSpan, { ...rootSpan, traceId: 'earlier-trace' }].map(span => ({
        traceId: span.traceId,
        spanId: span.spanId,
        name: span.name,
        spanType: span.spanType,
        isEvent: false,
        threadId: span.threadId,
        startedAt: span.startedAt,
        endedAt: span.endedAt,
        createdAt: span.createdAt,
        updatedAt: null,
      })),
    };
    return route.fulfill({ json: response });
  });
  await page.route('**/api/mcp/v0/servers', route => route.fulfill({ json: { servers: [], totalCount: 0 } }));
  await page.route('**/api/observability/feedback?**', route =>
    route.fulfill({ json: { feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } } }),
  );
  await page.goto(`/traces?traceId=${TRACE_ID}`);
  await expect(page.getByRole('heading', { name: /^Trace/ })).toBeVisible();
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Element is not rendered');
  return { top: rect.y, bottom: rect.y + rect.height, left: rect.x, right: rect.x + rect.width };
}

function traceHeader(page: Page) {
  return page.locator('[data-slot="data-panel-header"]').filter({ has: page.getByRole('heading', { name: /^Trace/ }) });
}

/**
 * FEATURE: Trace panel header layout
 * USER STORY: A trace reviewer can read every trace detail and reach every action, whatever the panel width.
 * BEHAVIOR UNDER TEST: The trace header keeps title, details and actions on one row while they fit; when they
 * don't, the details move to a second row instead of being cut off under the actions. The side column keeps
 * its tabs and "Open full thread" on one row.
 */
test.describe('Trace panel header', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the panel is wide enough', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });

    test('shows the title, details and actions on one row', async ({ page }) => {
      await openTrace(page);
      const header = traceHeader(page);
      const heading = await box(header.getByRole('heading'));
      const details = await box(header.getByRole('list'));

      expect(details.top).toBe(heading.top);
    });
  });

  test.describe('when the panel is too narrow for one row', () => {
    test.use({ viewport: { width: 900, height: 700 } });

    test('moves the details to their own row, all of them inside the panel', async ({ page }) => {
      await openTrace(page);
      const header = traceHeader(page);
      const headerBox = await box(header);
      const heading = await box(header.getByRole('heading'));
      const addToDataset = await box(header.getByRole('button', { name: 'Add to dataset' }));
      const details = header.getByRole('listitem');

      // Title and actions share the first row, and the title stops before the actions.
      expect(addToDataset.top).toBeLessThan(heading.bottom);
      expect(heading.right).toBeLessThanOrEqual(addToDataset.left);
      // Every detail is below them and fully visible.
      await expect(details.filter({ hasText: 'Weather Agent' })).toBeVisible();
      for (const detail of await details.all()) {
        const detailBox = await box(detail);
        expect(detailBox.top).toBeGreaterThanOrEqual(heading.bottom);
        expect(detailBox.right).toBeLessThanOrEqual(headerBox.right);
      }
    });

    test('keeps the side column tabs and "Open full thread" on one row, with a centered icon', async ({ page }) => {
      await openTrace(page);
      const tabs = await box(page.getByRole('tablist').filter({ has: page.getByRole('tab', { name: 'Messages' }) }));
      const fullThread = page.getByRole('button', { name: 'Open full thread' });
      const button = await box(fullThread);
      const icon = await box(fullThread.locator('[data-slot="button-icon"]'));

      expect(button.top).toBeLessThan(tabs.bottom);
      expect(icon.left - button.left).toBeCloseTo(button.right - icon.right, 0);
    });
  });
});
