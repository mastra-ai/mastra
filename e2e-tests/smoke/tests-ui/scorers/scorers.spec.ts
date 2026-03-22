import { test, expect } from '@playwright/test';

test.describe('Scorers', () => {
  test('scorers list page shows registered scorers', async ({ page }) => {
    await page.goto('/scorers');

    await expect(page.locator('h1')).toHaveText('Scorers');

    // Both registered scorers should appear with name and description.
    // Scope to main to avoid matching sidebar nav links.
    const main = page.locator('main');
    await expect(main.getByRole('link', { name: 'Completeness Scorer' }).first()).toBeVisible();
    await expect(
      main.getByRole('cell').filter({ hasText: 'Checks whether the output contains non-empty content' }).first(),
    ).toBeVisible();

    await expect(main.getByRole('link', { name: 'Length Check Scorer' }).first()).toBeVisible();
    await expect(
      main.getByRole('cell').filter({ hasText: 'Scores output based on character length' }).first(),
    ).toBeVisible();
  });

  test('scorer detail view shows score produced by workflow', async ({ page, request }) => {
    // Run a workflow that has the completeness scorer attached to its step.
    // The scorer fires asynchronously after the step completes.
    const runId = crypto.randomUUID();
    const resp = await request.post(`/api/workflows/scored-workflow/start-async?runId=${runId}`, {
      data: { inputData: { topic: 'testing' } },
    });
    expect(resp.ok()).toBeTruthy();

    // The scorer hook is fire-and-forget — poll the API until the score is persisted
    await expect(async () => {
      const scoresResp = await request.get('/api/scores/scorer/completeness');
      const body = await scoresResp.json();
      expect(body.scores?.some((s: { runId: string }) => s.runId === runId)).toBeTruthy();
    }).toPass({ timeout: 10_000, intervals: [500] });

    await page.goto('/scorers/completeness');

    // Heading and description
    await expect(page.locator('h1')).toHaveText('Completeness Scorer');
    await expect(page.getByText('Checks whether the output contains non-empty content')).toBeVisible();

    // Score row produced by the workflow should appear
    await expect(page.getByText('No scores for this scorer yet')).not.toBeVisible();
    // Find a score row button containing the workflow entity and verify its content
    const scoreRow = page.getByRole('button', { name: /scored-workflow/ }).first();
    await expect(scoreRow).toBeVisible();
    await expect(scoreRow.getByText('Today')).toBeVisible();
    await expect(scoreRow.getByText('scored-workflow')).toBeVisible();

    // Click the score row to open the score detail dialog
    await scoreRow.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Dialog shows score metadata
    await expect(dialog.getByText('Score: 1')).toBeVisible();
    await expect(dialog.getByText('code-based scorer does not generate a reason')).toBeVisible();

    // Dialog shows input/output JSON
    await expect(dialog.getByText('"topic"')).toBeVisible();
    await expect(dialog.getByText('"Here is some content about testing."')).toBeVisible();

    // Close dialog
    await dialog.locator('button[aria-label="Close"]').click();
    await expect(dialog).not.toBeVisible();

    // Scorer combobox shows current scorer and can switch to another
    const scorerCombobox = page.getByRole('combobox').filter({ hasText: 'Completeness Scorer' });
    await scorerCombobox.click();
    await expect(page.getByRole('option', { name: 'Length Check Scorer' })).toBeVisible();
    await page.getByRole('option', { name: 'Length Check Scorer' }).click();

    // Page navigates to the other scorer (which has no scores)
    await expect(page).toHaveURL(/\/scorers\/length-check/, { timeout: 5_000 });
    await expect(page.locator('h1')).toHaveText('Length Check Scorer');
    await expect(page.getByText('No scores for this scorer yet')).toBeVisible();
  });
});
