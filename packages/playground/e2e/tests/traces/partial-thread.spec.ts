import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

const TRACE_ID = 'partial-thread-trace';
const USER_INPUT = 'Find the weather in Paris';
const ASSISTANT_OUTPUT = 'Paris will be sunny today.';
const COMMENT = 'Verified against the tool result.';

const rootSpan = {
  traceId: TRACE_ID,
  spanId: 'agent-root',
  parentSpanId: null,
  name: 'Weather agent run',
  spanType: 'agent_run',
  isEvent: false,
  threadId: 'partial-thread-id',
  entityType: 'agent',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  startedAt: '2026-08-30T12:00:00.000Z',
  endedAt: '2026-08-30T12:00:01.000Z',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: null,
  input: {
    __isCreatedSignal: true,
    id: 'user-signal-1',
    type: 'user',
    tagName: 'user',
    contents: [{ type: 'text', text: USER_INPUT }],
    createdAt: '2026-08-30T12:00:00.000Z',
  },
  output: { text: ASSISTANT_OUTPUT },
};

const toolSpan = {
  ...rootSpan,
  spanId: 'weather-tool',
  parentSpanId: 'agent-root',
  name: 'Weather lookup',
  spanType: 'tool_call',
  entityType: 'tool',
  entityId: 'weatherInfo',
  entityName: 'weatherInfo',
  startedAt: '2026-08-30T12:00:00.200Z',
  input: { location: 'Paris' },
  output: { temperature: 19, conditions: 'sunny' },
  attributes: { toolCallId: 'weather-call' },
};

async function mockPartialThread(page: Page) {
  let comments: Array<Record<string, unknown>> = [];

  await page.route('**/api/observability/traces/light?**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ spans: [], pagination: { page: 0, perPage: 25, total: 0, hasMore: false } }),
    }),
  );
  await page.route(`**/api/observability/traces/${TRACE_ID}`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ traceId: TRACE_ID, spans: [rootSpan, toolSpan] }),
    }),
  );
  await page.route('**/api/mcp/v0/servers', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ servers: [], totalCount: 0 }),
    }),
  );
  await page.route('**/api/observability/feedback?**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        feedback: comments,
        pagination: { page: 0, perPage: 10, total: comments.length, hasMore: false },
      }),
    }),
  );
  await page.route('**/api/observability/feedback', route => {
    const body = route.request().postDataJSON();
    comments = [
      {
        feedbackId: 'comment-1',
        timestamp: '2026-08-30T12:01:00.000Z',
        traceId: TRACE_ID,
        feedbackSource: 'user',
        feedbackType: 'comment',
        value: body.feedback.value,
      },
    ];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
}

async function openPartialThread(page: Page) {
  await mockPartialThread(page);
  await page.goto(`/traces?traceId=${TRACE_ID}`);
  await page.getByRole('tab', { name: 'Messages' }).click();
}

/**
 * FEATURE: Messages trace view
 * USER STORY: A trace reviewer can inspect an agent turn with its chat presentation and leave a trace comment.
 * BEHAVIOR UNDER TEST: Stored spans become a read-only chat turn, while feedback stays in its dedicated tab.
 */
test.describe('Messages trace view', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an agent trace with a thread is selected', () => {
    test('renders the user input, assistant response, and tool execution', async ({ page }) => {
      await openPartialThread(page);

      await expect(page.getByText(USER_INPUT)).toBeVisible();
      await expect(page.getByText(ASSISTANT_OUTPUT)).toBeVisible();
      await expect(page.getByRole('button', { name: 'weatherInfo' })).toBeVisible();
    });

    test('keeps feedback submission in the dedicated Feedback tab', async ({ page }) => {
      await openPartialThread(page);

      await expect(page.getByPlaceholder('Leave feedback...')).toHaveCount(0);
      await page.getByRole('tab', { name: /^Feedback/ }).click();
      await page.getByPlaceholder('Leave feedback...').fill(COMMENT);
      await page.getByRole('button', { name: 'Send feedback' }).click();

      await expect(page.getByText(COMMENT)).toBeVisible();
    });
  });
});
