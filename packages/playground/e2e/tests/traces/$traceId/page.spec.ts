import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectBreadcrumbLink, expectCurrentBreadcrumb, expectRouteDocsLink } from '../../__utils__/route-header';

const FAKE_TRACE_ID = 'trace-does-not-exist';
const LONG_TRACE_ID = 'trace-with-many-spans';
const ROOT_SPAN_ID = 'root-span';
const SELECTED_SPAN_ID = 'span-60';
const TRACE_STARTED_AT_MS = Date.parse('2026-07-14T08:00:00.000Z');

type TraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;
type TraceLightSpan = TraceLightResponse['spans'][number];
type SpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

const rootSpan: TraceLightSpan = {
  traceId: LONG_TRACE_ID,
  spanId: ROOT_SPAN_ID,
  parentSpanId: null,
  name: 'agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-07-14T08:00:00.000Z'),
  endedAt: new Date('2026-07-14T08:01:00.000Z'),
  createdAt: new Date('2026-07-14T08:00:00.000Z'),
  updatedAt: new Date('2026-07-14T08:01:00.000Z'),
};

function createChildSpan(index: number): TraceLightSpan {
  const spanId = `span-${index}`;
  const startedAt = new Date(TRACE_STARTED_AT_MS + index * 500);

  return {
    traceId: LONG_TRACE_ID,
    spanId,
    parentSpanId: ROOT_SPAN_ID,
    name: `tool call ${index}`,
    spanType: SpanType.TOOL_CALL,
    isEvent: false,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 250),
    createdAt: new Date('2026-07-14T08:00:00.000Z'),
    updatedAt: new Date('2026-07-14T08:01:00.000Z'),
  };
}

const longTraceResponse: TraceLightResponse = {
  traceId: LONG_TRACE_ID,
  spans: [rootSpan, ...Array.from({ length: 60 }, (_, index) => createChildSpan(index + 1))],
};

const selectedSpanResponse: SpanResponse = {
  span: {
    traceId: LONG_TRACE_ID,
    spanId: SELECTED_SPAN_ID,
    parentSpanId: ROOT_SPAN_ID,
    name: 'tool call 60',
    spanType: SpanType.TOOL_CALL,
    isEvent: false,
    startedAt: new Date('2026-07-14T08:00:59.000Z'),
    endedAt: new Date('2026-07-14T08:00:59.500Z'),
    createdAt: new Date('2026-07-14T08:00:59.000Z'),
    updatedAt: new Date('2026-07-14T08:00:59.500Z'),
    input: {
      messages: Array.from({ length: 40 }, (_, index) => ({
        role: 'user',
        content: `Long trace input line ${index + 1}`,
      })),
    },
    output: {
      chunks: Array.from({ length: 40 }, (_, index) => `Long trace output line ${index + 1}`),
    },
    metadata: Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`metadata-${index + 1}`, `value-${index + 1}`]),
    ),
    attributes: Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`attribute-${index + 1}`, `value-${index + 1}`]),
    ),
  },
};

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

async function mockLongTrace(page: Page) {
  await page.route(`**/api/observability/traces/${LONG_TRACE_ID}/light`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(longTraceResponse),
    });
  });
  await page.route(`**/api/observability/traces/${LONG_TRACE_ID}/spans/${SELECTED_SPAN_ID}`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(selectedSpanResponse),
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

  test.describe('when a span near the end of a long trace is opened', () => {
    /**
     * FEATURE: Independent trace panel scrolling.
     * USER STORY: A user can inspect a deep span without scrolling the whole trace page back and forth.
     * BEHAVIOR UNDER TEST: Timeline and span details stay within the viewport and scroll independently.
     * DATA FLOW: Typed client responses are fulfilled at the network boundary and rendered by the real trace page.
     * PERSISTENCE: The selected span remains encoded in the URL; no additional state must persist.
     * DOWNSTREAM EFFECT: Scrolling span details does not move the selected timeline position.
     */
    test('keeps the timeline and span details independently scrollable within the page', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mockLongTrace(page);
      // Warm the mocked trace query, then remount the route with the final span selected through the URL.
      await page.goto(`/traces/${LONG_TRACE_ID}`);
      await expect(page.getByRole('button', { name: 'tool call 60', exact: true })).toBeAttached();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Traces' }).click();
      await expect(page).toHaveURL(/\/observability$/);
      await page.evaluate(url => {
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, `/traces/${LONG_TRACE_ID}?spanId=${SELECTED_SPAN_ID}`);
      await expect(page).toHaveURL(new RegExp(`spanId=${SELECTED_SPAN_ID}`));

      const timelinePanel = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'Trace Timeline', exact: true }),
      });
      const spanDetailsPanel = page.locator('section').filter({
        has: page.getByRole('heading', { name: `Span # ${SELECTED_SPAN_ID}`, exact: true }),
      });
      const pageLayout = page.locator('main').filter({ has: timelinePanel });
      const timelineContent = timelinePanel.locator(':scope > div').last();
      const spanDetailsContent = spanDetailsPanel.locator(':scope > div').last();

      await expect(timelinePanel).toBeVisible();
      await expect(spanDetailsPanel).toBeVisible();
      await timelinePanel.getByRole('button', { name: 'tool call 60', exact: true }).scrollIntoViewIfNeeded();
      await expect
        .poll(() => timelineContent.evaluate(element => element.scrollHeight > element.clientHeight))
        .toBe(true);
      await expect.poll(() => timelineContent.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect
        .poll(() => spanDetailsContent.evaluate(element => element.scrollHeight > element.clientHeight))
        .toBe(true);
      await expect.poll(() => pageLayout.evaluate(element => element.scrollHeight === element.clientHeight)).toBe(true);

      const [pageLayoutBox, timelinePanelBox, spanDetailsPanelBox] = await Promise.all([
        pageLayout.boundingBox(),
        timelinePanel.boundingBox(),
        spanDetailsPanel.boundingBox(),
      ]);
      if (!pageLayoutBox || !timelinePanelBox || !spanDetailsPanelBox) {
        throw new Error('Expected the trace page and both data panels to have measurable bounds');
      }

      const pageLayoutBottom = pageLayoutBox.y + pageLayoutBox.height;
      expect(timelinePanelBox.y + timelinePanelBox.height).toBeLessThanOrEqual(pageLayoutBottom);
      expect(spanDetailsPanelBox.y + spanDetailsPanelBox.height).toBeLessThanOrEqual(pageLayoutBottom);
      expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);

      const timelineScrollTop = await timelineContent.evaluate(element => element.scrollTop);
      await spanDetailsContent.evaluate(element => {
        element.scrollTop = element.scrollHeight;
      });

      await expect.poll(() => spanDetailsContent.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await timelineContent.evaluate(element => element.scrollTop)).toBe(timelineScrollTop);
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
