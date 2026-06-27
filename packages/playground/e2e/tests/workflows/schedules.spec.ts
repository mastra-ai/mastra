import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Scheduled workflows in Studio
 * USER STORY: As a developer using Mastra, I want to see all my workflow schedules
 *   in Studio so I can verify my declarative cron config is wired correctly and
 *   inspect the trigger audit history.
 * BEHAVIOR UNDER TEST:
 *   - /workflows has a Schedules link that navigates to a dedicated /workflows/schedules route
 *   - /workflows/schedules lists every declared schedule across workflows
 *   - Per-workflow Schedules sub-route filters to that workflow only
 *   - Workflow header link is shown only when the workflow has schedules
 *   - /workflows/schedules is directly addressable (deep-linkable, survives reload)
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Workflow schedules', () => {
  test.describe('when the Schedules link on /workflows is clicked', () => {
    test('navigates to the dedicated /workflows/schedules route', async ({ page }) => {
      await page.goto('/workflows');

      // The Schedules entry point is rendered next to the docs button on the workflows index.
      const schedulesLink = page.getByRole('link', { name: /Schedules/ });
      await expect(schedulesLink.first()).toBeVisible();

      await schedulesLink.first().click();

      await expect(page).toHaveURL(/\/workflows\/schedules$/);
    });
  });

  test.describe('when the /workflows/schedules route is visited', () => {
    test('lists every declared schedule across workflows', async ({ page }) => {
      await page.goto('/workflows/schedules');

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
  });

  test.describe('when the /workflows/schedules route is reloaded', () => {
    test('is deep-linkable and survives reload', async ({ page }) => {
      await page.goto('/workflows/schedules');
      await expect(page.locator('text=scheduledWorkflow').first()).toBeVisible();

      await page.reload();

      await expect(page).toHaveURL(/\/workflows\/schedules$/);
      await expect(page.locator('text=scheduledWorkflow').first()).toBeVisible();
    });
  });

  test.describe('when a per-workflow schedules sub-route is visited', () => {
    test('filters rows to that workflow', async ({ page }) => {
      await page.goto('/workflows/schedules?workflowId=multiScheduledWorkflow');

      // The two schedules declared by multiScheduledWorkflow are shown.
      await expect(page.locator('text=morning').first()).toBeVisible();
      await expect(page.locator('text=evening').first()).toBeVisible();

      // The unrelated single-form schedule is filtered out.
      await expect(page.locator('text=scheduledWorkflow__default')).toHaveCount(0);
    });
  });

  test.describe('when a schedule row is clicked', () => {
    test('navigates to the dedicated schedule detail page', async ({ page }) => {
      await page.goto('/workflows/schedules');

      // Click the row for the single-form schedule (whose id contains scheduledWorkflow).
      await page.locator('text=scheduledWorkflow').first().click();

      await expect(page).toHaveURL(/\/workflows\/schedules\/[^/]+$/);

      // Detail page renders trigger history panel + a back link to the schedules list.
      await expect(page.getByTestId('schedule-triggers-panel')).toBeVisible();
      await expect(page.getByRole('link', { name: /Back to schedules/ })).toBeVisible();
    });
  });

  test.describe('when a schedule is paused from the detail page', () => {
    test('persists the paused state across reload', async ({ page }) => {
      await page.goto('/workflows/schedules');

      // Open the detail page for the single-form schedule.
      await page.locator('text=scheduledWorkflow').first().click();
      await expect(page).toHaveURL(/\/workflows\/schedules\/[^/]+$/);

      const toggle = page.getByTestId('schedule-toggle-button');
      await expect(toggle).toContainText(/Pause/);

      await toggle.click();

      // After pausing the button label flips to Resume and stays that way after reload —
      // proves the status was actually persisted to storage, not just toggled in UI state.
      await expect(toggle).toContainText(/Resume/);
      await page.reload();
      await expect(page.getByTestId('schedule-toggle-button')).toContainText(/Resume/);

      // Resume the schedule. Button label flips back, persists across reload.
      await page.getByTestId('schedule-toggle-button').click();
      await expect(page.getByTestId('schedule-toggle-button')).toContainText(/Pause/);
      await page.reload();
      await expect(page.getByTestId('schedule-toggle-button')).toContainText(/Pause/);
    });
  });

  test.describe('when a workflow graph has one schedule', () => {
    test('routes the Schedules link to the schedule detail page', async ({ page }) => {
      await page.goto('/workflows/scheduledWorkflow/graph');

      // scheduledWorkflow has exactly one schedule, so the header link goes straight
      // to that schedule's detail page (smart routing: 1 schedule → detail page).
      const scheduledHeaderLink = page.getByRole('link', { name: /Schedules/ });
      await expect(scheduledHeaderLink).toBeVisible();

      await scheduledHeaderLink.click();
      await expect(page).toHaveURL(/\/workflows\/schedules\/[^/]+$/);
    });
  });

  test.describe('when a workflow graph has multiple schedules', () => {
    test('routes the Schedules link to the filtered schedules list', async ({ page }) => {
      await page.goto('/workflows/multiScheduledWorkflow/graph');
      const multiHeaderLink = page.getByRole('link', { name: /Schedules/ });
      await expect(multiHeaderLink).toBeVisible();

      await multiHeaderLink.click();
      await expect(page).toHaveURL(/\/workflows\/schedules\?workflowId=multiScheduledWorkflow$/);
    });
  });

  test.describe('when a workflow graph has no schedules', () => {
    test('does not render the Schedules link', async ({ page }) => {
      await page.goto('/workflows/complexWorkflow/graph');
      await expect(page.getByRole('link', { name: /Schedules/ })).toHaveCount(0);
    });
  });
});
