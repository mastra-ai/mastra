import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Scheduled workflows in Studio
 * USER STORY: As a developer using Mastra, I want to see all my workflow schedules
 *   in Studio so I can verify my declarative cron config is wired correctly and
 *   inspect the trigger audit history.
 * BEHAVIOR UNDER TEST:
 *   - Schedules declared on workflows show up in the Schedules tab on /workflows
 *   - Per-workflow Schedules sub-route filters to that workflow only
 *   - Workflow header link is shown only when the workflow has schedules
 *   - Tab state is reflected in ?tab=schedules query param and survives reload
 */

test.afterEach(async () => {
  await resetStorage();
});

test('schedules tab on /workflows lists every declared schedule across workflows', async ({ page }) => {
  await page.goto('/workflows');

  // Switch to the Schedules tab.
  await page.getByRole('tab', { name: 'Schedules' }).click();

  // URL reflects the active tab so the view is shareable.
  await expect(page).toHaveURL(/\/workflows\?tab=schedules$/);

  // Both single-form and array-form schedules from kitchen-sink should be listed.
  // scheduledWorkflow contributes 1 row, multiScheduledWorkflow contributes 2.
  await expect(page.locator('text=scheduledWorkflow').first()).toBeVisible();
  await expect(page.locator('text=multiScheduledWorkflow').first()).toBeVisible();

  // Array-form schedule ids (morning / evening) must each render a row.
  await expect(page.locator('text=morning').first()).toBeVisible();
  await expect(page.locator('text=evening').first()).toBeVisible();

  // Cron expressions render so the user can confirm the schedule.
  await expect(page.locator('text=0 9 * * *').first()).toBeVisible();
  await expect(page.locator('text=0 8 * * *').first()).toBeVisible();
  await expect(page.locator('text=0 20 * * *').first()).toBeVisible();
});

test('schedules tab survives page reload via ?tab query param', async ({ page }) => {
  await page.goto('/workflows?tab=schedules');

  // Tab is selected on initial load from the URL alone.
  await expect(page.getByRole('tab', { name: 'Schedules' })).toHaveAttribute('data-state', 'active');
  await expect(page.locator('text=scheduledWorkflow').first()).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/workflows\?tab=schedules$/);
  await expect(page.getByRole('tab', { name: 'Schedules' })).toHaveAttribute('data-state', 'active');
  await expect(page.locator('text=scheduledWorkflow').first()).toBeVisible();
});

test('per-workflow schedules sub-route filters rows to that workflow', async ({ page }) => {
  await page.goto('/workflows/multiScheduledWorkflow/schedules');

  // The two schedules declared by multiScheduledWorkflow are shown.
  await expect(page.locator('text=morning').first()).toBeVisible();
  await expect(page.locator('text=evening').first()).toBeVisible();

  // The unrelated single-form schedule is filtered out.
  await expect(page.locator('text=scheduledWorkflow__default')).toHaveCount(0);
});

test('workflow header shows Schedules link only when the workflow has schedules', async ({ page }) => {
  await page.goto('/workflows/scheduledWorkflow/graph');

  const scheduledHeaderLink = page.getByRole('link', { name: /Schedules/ });
  await expect(scheduledHeaderLink).toBeVisible();

  // Clicking the link navigates to the per-workflow schedules sub-route.
  await scheduledHeaderLink.click();
  await expect(page).toHaveURL(/\/workflows\/scheduledWorkflow\/schedules$/);

  // A workflow without any declared schedules should NOT render the link.
  await page.goto('/workflows/complexWorkflow/graph');
  await expect(page.getByRole('link', { name: /Schedules/ })).toHaveCount(0);
});
