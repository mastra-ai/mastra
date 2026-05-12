import { test, expect, type Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Observability list-mode switcher (Top-level traces only / All traces, nested too)
 *
 * USER STORY:
 *   As a user looking at observability, I want to flip between "one row per top-level run"
 *   and "every run including nested invocations" so I can find every invocation of a given
 *   agent / workflow / tool regardless of how it was triggered.
 *
 * BEHAVIORS UNDER TEST:
 *   1. The page defaults to traces mode (`/observability` clean URL → /api/observability/traces).
 *   2. Selecting "All traces, nested too" writes `?listMode=branches` and the backend call
 *      flips to /api/observability/branches.
 *   3. Switching back to "Top-level traces only" removes the URL param AND issues a fresh
 *      /api/observability/traces call. This pins the cache-evict fix in
 *      `pages/traces/index.tsx`: an earlier version of the page kept showing the previous
 *      mode's rows because `useTraces` returned stale cached data on the second switch.
 *   4. Switching modes clears any selection params (`traceId` / `spanId`) so a row selected
 *      in the previous mode doesn't get stuck in the URL.
 *   5. The detail panel for a branch (subtree from /traces/:traceId/branches/:spanId) renders
 *      without requiring a `parentSpanId == null` root — the anchor span's parent lives
 *      outside the returned subtree, and the panel must still surface a root.
 */

const ROOT_A = {
  traceId: 'trace-A',
  spanId: 'root-A',
  parentSpanId: null,
  name: 'agent run: weather-agent',
  spanType: 'AGENT_RUN',
  entityType: 'AGENT',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  startedAt: '2026-05-12T10:00:00.000Z',
  endedAt: '2026-05-12T10:00:01.000Z',
  createdAt: '2026-05-12T10:00:00.000Z',
};

const ROOT_B = {
  traceId: 'trace-B',
  spanId: 'root-B',
  parentSpanId: null,
  name: 'workflow run: data-pipeline',
  spanType: 'WORKFLOW_RUN',
  entityType: 'WORKFLOW_RUN',
  entityId: 'data-pipeline',
  entityName: 'data-pipeline',
  startedAt: '2026-05-12T09:00:00.000Z',
  endedAt: '2026-05-12T09:00:01.000Z',
  createdAt: '2026-05-12T09:00:00.000Z',
};

// A tool invocation nested inside trace-A. In traces mode this is hidden inside the root row;
// in branches mode it surfaces as its own listable anchor.
const NESTED_TOOL = {
  traceId: 'trace-A',
  spanId: 'tool-call-1',
  parentSpanId: 'root-A',
  name: 'tool: weatherInfo',
  spanType: 'TOOL_CALL',
  entityType: 'TOOL_CALL',
  startedAt: '2026-05-12T10:00:00.500Z',
  endedAt: '2026-05-12T10:00:00.800Z',
  createdAt: '2026-05-12T10:00:00.500Z',
};

// Another nested branch — a workflow run nested inside trace-B's agent (would not appear
// in traces mode at all).
const NESTED_WORKFLOW = {
  traceId: 'trace-B',
  spanId: 'nested-workflow',
  parentSpanId: 'root-B',
  name: 'workflow run: recipe-maker',
  spanType: 'WORKFLOW_RUN',
  entityType: 'WORKFLOW_RUN',
  entityId: 'recipe-maker',
  entityName: 'recipe-maker',
  startedAt: '2026-05-12T09:00:00.300Z',
  endedAt: '2026-05-12T09:00:00.700Z',
  createdAt: '2026-05-12T09:00:00.300Z',
};

const TRACES_RESPONSE = {
  pagination: { total: 2, page: 0, perPage: 25, hasMore: false },
  spans: [ROOT_A, ROOT_B],
};

const BRANCHES_RESPONSE = {
  pagination: { total: 4, page: 0, perPage: 25, hasMore: false },
  branches: [ROOT_A, NESTED_TOOL, ROOT_B, NESTED_WORKFLOW],
};

// Subtree returned for getBranch when the user clicks NESTED_TOOL. Note the anchor has a
// non-null parentSpanId pointing to root-A which is intentionally NOT in this response —
// the detail panel has to render anyway.
const BRANCH_SUBTREE_NESTED_TOOL = {
  traceId: 'trace-A',
  spans: [
    {
      ...NESTED_TOOL,
      input: {},
      output: {},
      attributes: {},
    },
  ],
};

type CallCounter = { count: number };

async function mockObservabilityEndpoints(
  page: Page,
  opts: { tracesCalls?: CallCounter; branchesCalls?: CallCounter; branchSubtreeCalls?: CallCounter } = {},
) {
  // Anything under /api/observability/traces/:traceId/branches/:spanId — the per-branch subtree.
  await page.route(/\/api\/observability\/traces\/[^/]+\/branches\/[^/]+/, async route => {
    if (opts.branchSubtreeCalls) opts.branchSubtreeCalls.count++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BRANCH_SUBTREE_NESTED_TOOL),
    });
  });

  // The list-branches endpoint. Match path-then-(query-or-end) so /traces/X doesn't slip in.
  await page.route(/\/api\/observability\/branches(\?|$)/, async route => {
    if (opts.branchesCalls) opts.branchesCalls.count++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BRANCHES_RESPONSE),
    });
  });

  // The list-traces endpoint. Same path-anchored pattern.
  await page.route(/\/api\/observability\/traces(\?|$)/, async route => {
    if (opts.tracesCalls) opts.tracesCalls.count++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TRACES_RESPONSE),
    });
  });
}

test.describe('Observability list-mode switcher', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('defaults to traces mode — URL has no listMode and the page calls /api/observability/traces', async ({
    page,
  }) => {
    const tracesCalls: CallCounter = { count: 0 };
    const branchesCalls: CallCounter = { count: 0 };
    await mockObservabilityEndpoints(page, { tracesCalls, branchesCalls });

    await page.goto('/observability');

    // URL has no listMode param.
    await expect(page).toHaveURL(/\/observability(\/?)$/);

    // Verify the page hit /traces and NOT /branches on initial load.
    await expect.poll(() => tracesCalls.count).toBeGreaterThan(0);
    expect(branchesCalls.count).toBe(0);

    // Sanity: top-level rows from TRACES_RESPONSE render.
    await expect(page.getByText('agent run: weather-agent')).toBeVisible();
    await expect(page.getByText('workflow run: data-pipeline')).toBeVisible();
  });

  test('selecting "All traces, nested too" flips the endpoint to /api/observability/branches and surfaces nested rows', async ({
    page,
  }) => {
    const tracesCalls: CallCounter = { count: 0 };
    const branchesCalls: CallCounter = { count: 0 };
    await mockObservabilityEndpoints(page, { tracesCalls, branchesCalls });

    await page.goto('/observability');
    // Wait for the initial traces load to settle before toggling.
    await expect.poll(() => tracesCalls.count).toBeGreaterThan(0);
    await expect(page.getByText('agent run: weather-agent')).toBeVisible();

    // Open the dropdown (trigger displays the current mode label).
    await page.getByRole('button', { name: /Top-level traces only/ }).click();
    await page.getByRole('menuitemradio', { name: 'All traces, nested too' }).click();

    // URL updated.
    await expect(page).toHaveURL(/[?&]listMode=branches\b/);

    // Backend now called /branches.
    await expect.poll(() => branchesCalls.count).toBeGreaterThan(0);

    // The nested rows from BRANCHES_RESPONSE now appear — they could NOT appear in traces mode
    // because their parentSpanId is non-null (they aren't trace roots).
    await expect(page.getByText('tool: weatherInfo')).toBeVisible();
    await expect(page.getByText('workflow run: recipe-maker')).toBeVisible();
  });

  test('switching back to "Top-level traces only" drops the nested rows (regression guard for the virtualizer-reset fix)', async ({
    page,
  }) => {
    await mockObservabilityEndpoints(page);

    await page.goto('/observability');
    await expect(page.getByText('agent run: weather-agent')).toBeVisible();

    // Go branches. Nested rows that don't exist in traces mode appear.
    await page.getByRole('button', { name: /Top-level traces only/ }).click();
    await page.getByRole('menuitemradio', { name: 'All traces, nested too' }).click();
    await expect(page.getByText('tool: weatherInfo')).toBeVisible();
    await expect(page.getByText('workflow run: recipe-maker')).toBeVisible();

    // Go back to traces.
    await page.getByRole('button', { name: /All traces, nested too/ }).click();
    await page.getByRole('menuitemradio', { name: 'Top-level traces only' }).click();

    // URL is back to clean (no listMode).
    await expect(page).toHaveURL(/\/observability(\/?)$/);

    // CRITICAL: the nested-only rows are gone — only the top-level rows remain. An earlier
    // implementation left the previous mode's rows rendered because the virtualizer kept
    // stale measurement state when both modes were cached. The fix remounts the list via
    // `key={listMode}` so a fresh virtualizer instance renders the current row count.
    await expect(page.getByText('tool: weatherInfo')).toHaveCount(0);
    await expect(page.getByText('workflow run: recipe-maker')).toHaveCount(0);
    await expect(page.getByText('agent run: weather-agent')).toBeVisible();
    await expect(page.getByText('workflow run: data-pipeline')).toBeVisible();
  });

  test('switching modes clears the branch anchor, selected span, and trace selection from the URL', async ({
    page,
  }) => {
    await mockObservabilityEndpoints(page);

    // Land on /observability already pointing at a specific branch (simulates "user had a row
    // selected when they toggle"). In branches mode the branch identity lives in
    // `anchorSpanId`; `spanId` is the currently selected span within the subtree.
    await page.goto('/observability?listMode=branches&traceId=trace-A&anchorSpanId=tool-call-1&spanId=tool-call-1');
    await expect(page).toHaveURL(/listMode=branches/);
    await expect(page).toHaveURL(/traceId=trace-A/);
    await expect(page).toHaveURL(/anchorSpanId=tool-call-1/);
    await expect(page).toHaveURL(/spanId=tool-call-1/);

    // Toggle back to traces mode.
    await page.getByRole('button', { name: /All traces, nested too/ }).click();
    await page.getByRole('menuitemradio', { name: 'Top-level traces only' }).click();

    // URL is fully clean — no listMode, no selection or anchor params.
    await expect(page).toHaveURL(/\/observability(\/?)$/);
    const url = new URL(page.url());
    expect(url.searchParams.get('listMode')).toBeNull();
    expect(url.searchParams.get('traceId')).toBeNull();
    expect(url.searchParams.get('spanId')).toBeNull();
    expect(url.searchParams.get('anchorSpanId')).toBeNull();
  });

  test('branch detail panel renders a subtree whose anchor has a non-null parentSpanId', async ({ page }) => {
    const branchSubtreeCalls: CallCounter = { count: 0 };
    await mockObservabilityEndpoints(page, { branchSubtreeCalls });

    // Open directly on the nested branch — exercises the URL → useBranch → detail-panel path
    // without depending on a clickable-row selector (those rows are virtualized).
    await page.goto('/observability?listMode=branches&traceId=trace-A&anchorSpanId=tool-call-1&spanId=tool-call-1');

    // The page issued a getBranch request for the (traceId, anchorSpanId) pair.
    await expect.poll(() => branchSubtreeCalls.count).toBeGreaterThan(0);

    // The anchor span renders inside the detail panel even though its parentSpanId === 'root-A'
    // (which is NOT in the subtree response) — this is the "must not require a trace root"
    // requirement from the ticket.
    await expect(page.getByText('tool: weatherInfo').first()).toBeVisible();
  });

  test('intra-panel span navigation in branches mode changes spanId but keeps anchorSpanId stable (no subtree refetch)', async ({
    page,
  }) => {
    const branchSubtreeCalls: CallCounter = { count: 0 };
    await mockObservabilityEndpoints(page, { branchSubtreeCalls });

    await page.goto('/observability?listMode=branches&traceId=trace-A&anchorSpanId=tool-call-1&spanId=tool-call-1');
    await expect.poll(() => branchSubtreeCalls.count).toBeGreaterThan(0);
    const subtreeCallsAfterInitialLoad = branchSubtreeCalls.count;

    // Simulate intra-panel span selection (e.g. user picks a different span in the timeline)
    // by directly mutating just the `spanId` URL param. The previous bug: changing spanId
    // re-anchored useBranch, refetching getBranch(trace-A, some-other-span) and giving a
    // different subtree. The fix routes the anchor through its own URL param so this no
    // longer triggers a refetch.
    await page.evaluate(() => {
      const u = new URL(window.location.href);
      u.searchParams.set('spanId', 'tool-call-1-descendant');
      window.history.replaceState(null, '', u.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Give react-query a beat to react (it would normally fire a new fetch immediately if
    // the queryKey for useBranch changed).
    await page.waitForTimeout(500);

    // The branch identity (anchorSpanId) is still in the URL.
    await expect(page).toHaveURL(/anchorSpanId=tool-call-1\b/);
    // And NO additional getBranch call fired — the subtree is stable.
    expect(branchSubtreeCalls.count).toBe(subtreeCallsAfterInitialLoad);
  });
});
