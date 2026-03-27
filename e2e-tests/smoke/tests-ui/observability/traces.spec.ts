import { test, expect, Page } from '@playwright/test';
import { fillAndSend, waitForAssistantMessage } from '../helpers';

/**
 * Locate non-skeleton trace entries in the observability list.
 * Each trace is a <button> inside an <li> within the EntryList <ul>.
 * Skeleton rows have disabled buttons, so we exclude them.
 */
function traceEntries(page: Page) {
  return page.locator('ul.bg-surface3 > li button:not([disabled])');
}

/**
 * Open the entity type filter dropdown and select an option.
 * The new UI uses: Filter button → Entity Type sub-menu → radio items.
 */
async function selectEntityFilter(page: Page, name: string) {
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('menuitem', { name: 'Entity Type' }).click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
}

test.describe('Observability', () => {
  // Self-contained tests that generate their own traces go first,
  // so subsequent tests can rely on traces existing in the database.

  test('traces appear after workflow run', async ({ page }) => {
    // Run a workflow to generate a fresh trace
    await page.goto('/workflows/sequential-steps/graph');
    await page.getByRole('textbox', { name: 'Name' }).fill('observability-test');
    await page.getByRole('button', { name: 'Run' }).click();
    const lastNode = page.locator('[data-workflow-node]').last();
    await expect(lastNode).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 10_000 });

    // Navigate to observability and filter by this workflow
    await page.goto('/observability');
    await selectEntityFilter(page, 'sequential-steps');

    // Should show at least one trace containing the workflow name
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });
    await expect(traceEntries(page).first()).toContainText('sequential-steps');
  });

  test('traces appear after agent chat', async ({ page }) => {
    test.slow();

    // Send a message to generate an agent trace
    await page.goto('/agents/test-agent/chat/new');
    await fillAndSend(page, 'Say hi');
    await waitForAssistantMessage(page);

    // Navigate to observability and filter by this agent
    await page.goto('/observability');
    await selectEntityFilter(page, 'Test Agent');

    // Should show at least one trace for this agent
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });
  });

  // Tests below rely on traces already existing from the tests above
  // (and from any previous test suite runs).

  test('traces list page loads with trace entries', async ({ page }) => {
    await page.goto('/observability');

    await expect(page.locator('h1').first()).toHaveText('Observability');

    // Filter controls should be visible
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Group by thread' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();

    // At least one trace entry should exist (seeded by the tests above)
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });
  });

  test('filter traces by entity type', async ({ page }) => {
    await page.goto('/observability');
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });

    // Open the entity filter and verify "All" option exists
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('menuitem', { name: 'Entity Type' }).click();
    await expect(page.getByRole('menuitemradio', { name: 'All', exact: true })).toBeVisible();

    // Select a workflow entity
    await page.getByRole('menuitemradio', { name: 'sequential-steps' }).click();

    // URL should update with the entity filter
    await expect(page).toHaveURL(/entity=/, { timeout: 5_000 });

    // Filtered entries should contain the workflow name
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });
    await expect(traceEntries(page).first()).toContainText('sequential-steps');

    // Reset filter
    await page.getByRole('button', { name: 'Reset' }).click();
  });

  test('click trace to open detail dialog', async ({ page }) => {
    await page.goto('/observability');

    // Click the first trace entry
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });
    await traceEntries(page).first().click();

    // The trace detail dialog should open
    await expect(page.getByRole('heading', { name: 'Observability Trace' })).toBeVisible({ timeout: 5_000 });

    // Timeline section should be visible with span search
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByPlaceholder('Look for span name')).toBeVisible();

    // Close the dialog
    await page.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.getByRole('heading', { name: 'Observability Trace' })).not.toBeVisible();
  });

  test('span inspection within trace', async ({ page }) => {
    // Filter to a workflow trace that has multiple spans
    await page.goto('/observability');
    await selectEntityFilter(page, 'sequential-steps');

    // Click the first workflow trace
    await expect(traceEntries(page).first()).toBeVisible({ timeout: 10_000 });
    await traceEntries(page).first().click();
    await expect(page.getByRole('heading', { name: 'Observability Trace' })).toBeVisible({ timeout: 5_000 });

    // Click a step span in the timeline
    const stepSpan = page.getByRole('button', { name: /workflow step:/ });
    await expect(stepSpan.first()).toBeVisible({ timeout: 5_000 });
    await stepSpan.first().click();

    // The span detail dialog should open with Details tab
    await expect(page.getByRole('heading', { name: 'Observability Span' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');

    // Span detail sections should be visible
    await expect(page.getByRole('heading', { name: 'Input' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Output' })).toBeVisible();
  });
});
