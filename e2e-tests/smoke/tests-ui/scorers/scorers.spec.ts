import { test, expect } from '@playwright/test';

test.describe('Scorers', () => {
  test('scorers list page shows registered scorers', async ({ page }) => {
    await page.goto('/scorers');

    await expect(page.getByRole('heading', { name: 'Scorers', level: 1 })).toBeVisible();

    // Both registered scorers should appear as links with name and description.
    // Use getByRole('link') to avoid matching sidebar nav links — list links have descriptions.
    await expect(
      page.getByRole('link', { name: /Completeness Scorer.*Checks whether the output contains non-empty content/ }).first(),
    ).toBeVisible();

    await expect(
      page.getByRole('link', { name: /Length Check Scorer.*Scores output based on character length/ }).first(),
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

    // URL segment is the scorer ID, not the human-readable name
    await page.goto('/scorers/completeness');

    // Heading and description
    await expect(page.getByRole('heading', { name: 'Completeness Scorer', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Checks whether the output contains non-empty content')).toBeVisible();

    // A score row referencing the scored workflow should be visible
    const scoreRow = page.getByRole('button').filter({ hasText: 'scored-workflow' }).first();
    await expect(scoreRow).toBeVisible({ timeout: 10_000 });

    // Scorer combobox shows current scorer and can switch to another
    const scorerCombobox = page.getByRole('combobox').filter({ hasText: 'Completeness Scorer' });
    await scorerCombobox.click();
    await expect(page.getByRole('option', { name: 'Length Check Scorer' })).toBeVisible();
    await page.getByRole('option', { name: 'Length Check Scorer' }).click();

    // Page navigates to the other scorer (URL uses scorer id)
    await expect(page).toHaveURL(/\/scorers\//, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Length Check Scorer', level: 1 })).toBeVisible();
    await expect(page.getByText('No scores yet')).toBeVisible();
  });
});
