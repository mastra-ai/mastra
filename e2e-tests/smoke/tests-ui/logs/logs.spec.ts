import { test, expect } from '@playwright/test';

test.describe('Logs', () => {
  test('/logs renders header, controls and real log rows from the fixture', async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    // Trigger a workflow that throws on purpose so we know there is a log row to show.
    await request.post('/api/workflows/failure-workflow/start-async', {
      data: { inputData: { input: 'logs-ui-smoke' } },
    }).catch(() => {});

    await page.goto('/logs');
    await expect(page).toHaveURL(/\/logs/);
    await expect(page.getByRole('heading', { name: /^logs$/i }).first()).toBeVisible();

    // Filter controls.
    await expect(page.getByRole('button', { name: /last 24 hours/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /add filter/i }).first()).toBeVisible();

    // Real content: at least one log row from the fixture (failure-workflow + the editor-not-configured
    // probes both write logs). We assert the "error" severity badge is rendered for at least one row.
    const errorBadge = page.getByText(/^error$/i).first();
    await expect(errorBadge).toBeVisible({ timeout: 10_000 });

    // And we should see at least one log row with concrete content from the fixture
    // (e.g. an orchestrator error or a "no memory configured" warning from agent runs).
    const logRow = page.getByRole('button', { name: /ERROR|WARN/ }).first();
    await expect(logRow).toBeVisible({ timeout: 10_000 });

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
