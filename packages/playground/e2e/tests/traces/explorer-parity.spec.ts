import { test, expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

// Characterization spec for the traces page: it runs against a real server
// with recorded traces (for example `examples/agent` seeded with
// `seed-traces.mjs`, via E2E_PORT=4112). It reads whatever traces exist, so it
// does not depend on specific seeded content. Servers without recorded traces
// (the kitchen-sink fixture records none) skip it.

type RecordedTrace = { traceId: string; entityId: string | null; entityType: string | null };

const listRecordedTraces = async (request: APIRequestContext): Promise<RecordedTrace[]> => {
  const now = Date.now();
  const response = await request.post('/api/observability/traces/query', {
    data: {
      timeRange: {
        from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date(now).toISOString(),
      },
    },
  });
  if (!response.ok()) return [];
  const body: { traces?: RecordedTrace[] } = await response.json();
  return body.traces ?? [];
};

const findAgentId = async (request: APIRequestContext) => {
  const traces = await listRecordedTraces(request);
  return traces.find(trace => trace.entityType === 'agent' && trace.entityId)?.entityId ?? undefined;
};

const traceRows = (page: Page) =>
  page
    .getByRole('main')
    .first()
    .getByRole('button', { name: / Trace / });

const openTracesPage = async (page: Page, path = '/traces') => {
  await page.goto(path);
  await expect(traceRows(page).first()).toBeVisible();
};

test.describe('Traces explorer', () => {
  test.beforeEach(async ({ request }) => {
    const traces = await listRecordedTraces(request);
    test.skip(traces.length === 0, 'Needs a server with recorded traces (for example examples/agent, seeded).');
  });

  test.describe('when a trace row is clicked', () => {
    test('opens the trace panel and keeps it open on the same trace after a reload', async ({ page }) => {
      await openTracesPage(page);

      await traceRows(page).first().click();

      await expect(page.getByRole('button', { name: 'Close trace' })).toBeVisible();
      await expect(page).toHaveURL(/[?&]traceId=[^&]+/);
      const traceId = new URL(page.url()).searchParams.get('traceId');

      await page.reload();

      await expect(page.getByRole('button', { name: 'Close trace' })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('traceId')).toBe(traceId);
    });

    test('closes the panel and drops the trace from the URL when the panel is closed', async ({ page }) => {
      await openTracesPage(page);
      await traceRows(page).first().click();
      await expect(page.getByRole('button', { name: 'Close trace' })).toBeVisible();

      await page.getByRole('button', { name: 'Close trace' }).click();

      await expect(page.getByRole('button', { name: 'Close trace' })).toBeHidden();
      expect(new URL(page.url()).searchParams.has('traceId')).toBe(false);
    });
  });

  test.describe('when a date preset is applied and the user navigates away and back', () => {
    test('restores the preset from storage and queries the matching time window', async ({ page }) => {
      await openTracesPage(page);
      await page.getByRole('button', { name: 'Value: Last 7 days' }).click();
      await page.getByRole('menuitemradio', { name: 'Last 24 hours' }).click();
      await expect(page).toHaveURL(/datePreset=last-24h/);

      await page.goto('/agents');
      const restoredQuery = page.waitForRequest(
        req => req.url().includes('/api/observability/traces/query') && req.method() === 'POST',
      );
      await page.goto('/traces');
      const request = await restoredQuery;

      await expect(page).toHaveURL(/datePreset=last-24h/);
      await expect(page.getByRole('button', { name: 'Value: Last 24 hours' })).toBeVisible();
      const { timeRange }: { timeRange: { from: string; to: string } } = request.postDataJSON();
      const windowMs = new Date(timeRange.to).getTime() - new Date(timeRange.from).getTime();
      expect(Math.round(windowMs / (60 * 60 * 1000))).toBe(24);
    });
  });

  test.describe('when the filters are cleared on an agent Traces tab', () => {
    test('keeps the agent scope in the URL and in the query', async ({ page, request }) => {
      const agentId = await findAgentId(request);
      test.skip(!agentId, 'Needs a recorded agent trace.');

      await openTracesPage(page, `/agents/${agentId}/traces`);
      await page.getByRole('combobox', { name: 'Add filter' }).click();
      await page.getByRole('option', { name: 'Status', exact: true }).click();
      await page.getByRole('option', { name: 'is', exact: true }).click();
      await page.getByRole('option', { name: 'Success' }).click();
      await expect(page).toHaveURL(/status=success/);
      await page.keyboard.press('Escape');

      const clearedQuery = page.waitForRequest(
        req => req.url().includes('/api/observability/traces/query') && req.method() === 'POST',
      );
      await page.getByRole('button', { name: 'Clear filters' }).click();
      const cleared = await clearedQuery;

      const url = new URL(page.url());
      expect(url.searchParams.get('filterEntityId')).toBe(agentId);
      expect(url.searchParams.get('rootEntityType')).toBe('agent');
      expect(url.searchParams.has('status')).toBe(false);
      expect(JSON.stringify(cleared.postDataJSON().where)).toContain(JSON.stringify({ literal: agentId }));
    });
  });

  test.describe('when auto refresh is on and a new trace is recorded', () => {
    test('shows the new trace without a reload', async ({ page, request }) => {
      const agentId = await findAgentId(request);
      test.skip(!agentId, 'Needs a recorded agent trace to know which agent to call.');
      test.setTimeout(120_000);

      await openTracesPage(page);
      await expect(page.getByRole('checkbox', { name: 'Auto refresh' })).toBeChecked();

      const prompt = `Reply with the single word ok (e2e ${Date.now()})`;
      const generated = await request.post(`/api/agents/${agentId}/generate`, {
        data: { messages: [{ role: 'user', content: prompt }] },
        timeout: 90_000,
      });
      expect(generated.ok()).toBe(true);

      await expect(traceRows(page).filter({ hasText: prompt })).toBeVisible({ timeout: 30_000 });
    });
  });

  test.describe('when the sort direction is toggled', () => {
    test('reverses the rows, keeps the order on reload and does not restore it on a fresh visit', async ({ page }) => {
      await openTracesPage(page);
      const sortButton = page.getByRole('button', { name: /^Start, sorted/ });
      await expect(sortButton).toHaveAccessibleName(/sorted descending/);
      test.skip((await traceRows(page).count()) < 2, 'Needs at least two traces to compare orders.');
      const firstDescending = (await traceRows(page).first().textContent()) ?? '';

      await sortButton.click();

      await expect(page).toHaveURL(/sort=startedAt&dir=asc/);
      await expect(sortButton).toHaveAccessibleName(/sorted ascending/);
      await expect(traceRows(page).first()).not.toHaveText(firstDescending);

      await page.reload();
      await expect(page.getByRole('button', { name: /^Start, sorted ascending/ })).toBeVisible();

      await openTracesPage(page);
      await expect(page.getByRole('button', { name: /^Start, sorted descending/ })).toBeVisible();
    });
  });
});
