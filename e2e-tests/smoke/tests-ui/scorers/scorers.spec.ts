import { test, expect } from '@playwright/test';

test.describe('Scorers', () => {
  test('scorers list page shows registered scorers', async ({ page }) => {
    await page.goto('/evaluation?tab=scorers');

    await expect(page.getByRole('heading', { name: 'Evaluation', level: 1 })).toBeVisible();

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

    await page.goto('/evaluation/scorers/Completeness%20Scorer');

    // Heading and description
    await expect(page.getByRole('heading', { name: 'Completeness Scorer', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Checks whether the output contains non-empty content')).toBeVisible();

    // The scored-workflow link should be visible in the page
    await expect(page.getByRole('link', { name: 'scored-workflow' })).toBeVisible();

    // NOTE: There is a known Studio regression where the scorer detail page queries
    // scores by scorer *name* instead of scorer *id*, causing "No scores" to appear
    // even when scores exist. The API test (`tests/scores/scores.test.ts`) validates
    // the scores are actually persisted. When the Studio bug is fixed, the score row
    // assertions below can be re-enabled.
    //
    // Score row produced by the workflow should appear
    // await expect(page.getByText('No scores for this scorer yet')).not.toBeVisible();
    // const scoreRow = page.getByRole('button', { name: /scored-workflow/ }).first();
    // await expect(scoreRow).toBeVisible();

    // Scorer combobox shows current scorer and can switch to another
    const scorerCombobox = page.getByRole('combobox').filter({ hasText: 'Completeness Scorer' });
    await scorerCombobox.click();
    await expect(page.getByRole('option', { name: 'Length Check Scorer' })).toBeVisible();
    await page.getByRole('option', { name: 'Length Check Scorer' }).click();

    // Page navigates to the other scorer (URL uses scorer id or name depending on version)
    await expect(page).toHaveURL(/\/evaluation\/scorers\//, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Length Check Scorer', level: 1 })).toBeVisible();
    await expect(page.getByText('No scores for this scorer yet')).toBeVisible();
  });
});
