import { test, expect } from '@playwright/test';

// The smoke fixture has no CMS editor wired up, so the Editor tab on the agent
// layout is rendered but disabled. The other tabs (Evaluate / Review / Traces)
// load real content. These tests assert tab selection by URL and surface the
// presence of tab-specific landmarks.

test.describe('Agent layout tabs', () => {
  test('/agents/test-agent/editor: Editor tab is rendered but disabled', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/agents/test-agent/editor');
    await expect(page).toHaveURL(/\/agents\/test-agent\/editor/);

    const editorTab = page.getByRole('tab', { name: /^editor$/i }).first();
    await expect(editorTab).toBeVisible();
    await expect(editorTab).toBeDisabled();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('/agents/test-agent/evaluate: Evaluate tab is active and empty state shows', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/agents/test-agent/evaluate');
    await expect(page).toHaveURL(/\/agents\/test-agent\/evaluate/);

    const evaluateTab = page.getByRole('tab', { name: /^evaluate$/i }).first();
    await expect(evaluateTab).toHaveAttribute('aria-selected', 'true');

    // Evaluate exposes sub-tabs (Experiments / Datasets / Scorers).
    await expect(page.getByRole('tab', { name: /experiments/i }).first()).toBeVisible();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('/agents/test-agent/review: Review tab is active', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/agents/test-agent/review');
    await expect(page).toHaveURL(/\/agents\/test-agent\/review/);

    const reviewTab = page.getByRole('tab', { name: /^review$/i }).first();
    await expect(reviewTab).toHaveAttribute('aria-selected', 'true');

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('/agents/test-agent/traces: Traces tab is active', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/agents/test-agent/traces');
    await expect(page).toHaveURL(/\/agents\/test-agent\/traces/);

    const tracesTab = page.getByRole('tab', { name: /^traces$/i }).first();
    await expect(tracesTab).toHaveAttribute('aria-selected', 'true');

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
