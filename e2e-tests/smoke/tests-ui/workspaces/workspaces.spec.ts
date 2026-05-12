import { test, expect } from '@playwright/test';

test.describe('Workspaces', () => {
  // Seed fixture files via the workspace filesystem API before tests
  test.beforeAll(async ({ request }) => {
    const base = '/api/workspaces/test-workspace/fs';

    // Create a subdirectory
    await request.post(`${base}/mkdir`, {
      data: { path: 'smoke-fixtures', recursive: true },
    });

    // Write test files
    await request.post(`${base}/write`, {
      data: { path: 'smoke-fixtures/hello.txt', content: 'Hello from smoke test' },
    });
    await request.post(`${base}/write`, {
      data: {
        path: 'smoke-fixtures/config.json',
        content: JSON.stringify({ name: 'smoke', version: '1.0' }, null, 2),
      },
    });
    await request.post(`${base}/write`, {
      data: { path: 'smoke-fixtures/nested/deep.md', content: '# Deep file\n\nNested content here.', recursive: true },
    });
  });

  // Clean up fixture files after all tests
  test.afterAll(async ({ request }) => {
    await request.delete(
      `/api/workspaces/test-workspace/fs/delete?path=smoke-fixtures&recursive=true&force=true`,
    );
  });

  // Helper: locate a file/directory entry button (not the Delete button).
  // Each list item has two buttons: the entry button and "Delete <name>".
  // We scope to the listitem containing the target text, then pick the first button.
  function fileEntry(page: import('@playwright/test').Page, name: string | RegExp) {
    if (typeof name === 'string') {
      return page.getByRole('button', { name, exact: true });
    }
    // For regex, scope to the listitem to avoid matching "Delete ..." buttons
    return page.getByRole('listitem').filter({ hasText: name }).getByRole('button').first();
  }

  test('workspace page shows file browser with workspace name', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page.getByRole('heading', { name: 'Workspace', level: 1 }).first()).toBeVisible();
    await expect(page.getByText('Test Workspace')).toBeVisible();

    // Files tab should be active by default
    await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Skills/ })).toBeVisible();

    // Toolbar buttons
    await expect(page.getByRole('button', { name: 'Refresh files' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create directory' })).toBeVisible();

    // Our fixture directory should appear in the file list
    await expect(fileEntry(page, 'smoke-fixtures')).toBeVisible();
  });

  test('file browser: navigate into directory, view file, and close viewer', async ({ page }) => {
    await page.goto('/workspaces');

    // Navigate into smoke-fixtures directory
    await fileEntry(page, 'smoke-fixtures').click();

    // Should show fixture files
    await expect(fileEntry(page, /hello\.txt/i)).toBeVisible();
    await expect(fileEntry(page, /config\.json/i)).toBeVisible();
    await expect(fileEntry(page, 'nested')).toBeVisible();

    // Click a file to open the file viewer
    await fileEntry(page, /hello\.txt/i).click();

    // File viewer should appear with the file content
    await expect(page.getByText('Hello from smoke test')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible();

    // Close the file viewer
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Hello from smoke test')).not.toBeVisible();

    // Navigate deeper into nested/
    await fileEntry(page, 'nested').click();
    await expect(fileEntry(page, /deep\.md/i)).toBeVisible();

    // View the markdown file
    await fileEntry(page, /deep\.md/i).click();
    await expect(page.getByText('Nested content here.')).toBeVisible();
  });

  test('file browser: create and delete directory', async ({ page }) => {
    await page.goto('/workspaces');

    // Handle the native prompt dialog for directory creation
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('e2e-temp-dir');
    });

    await page.getByRole('button', { name: 'Create directory' }).click();

    // Wait for the new directory to appear
    await expect(fileEntry(page, 'e2e-temp-dir')).toBeVisible({ timeout: 5_000 });

    // Delete it via the UI delete button
    await page.getByRole('button', { name: 'Delete e2e-temp-dir' }).click();

    // Confirm deletion in alert dialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText('e2e-temp-dir')).toBeVisible();
    await alertDialog.getByRole('button', { name: 'Delete' }).click();

    // Directory should disappear
    await expect(fileEntry(page, 'e2e-temp-dir')).toHaveCount(0, { timeout: 5_000 });
  });

  test('skills tab: shows empty state with add skill button', async ({ page }) => {
    await page.goto('/workspaces');

    // Switch to Skills tab
    await page.getByRole('tab', { name: /Skills/ }).click();

    // Should show Add Skill button
    await expect(page.getByRole('button', { name: 'Add Skill' })).toBeVisible();

    // Empty-state message should be visible
    await expect(page.getByText(/no skills discovered/i)).toBeVisible();
  });

  test('skills tab: install skill from registry and remove it', async ({ page, request }) => {
    // Increase timeout — network calls to skills.sh can be slow
    test.setTimeout(60_000);

    // ── Mock the registry discovery endpoints so the test doesn't depend on
    //    what is trending on skills.sh. The install & remove endpoints still
    //    hit the real server (and the real skills.sh files API) so we validate
    //    the actual install/remove flow end-to-end.
    const SKILL_NAME = 'find-skills';
    const SKILL_OWNER = 'vercel-labs';
    const SKILL_REPO = 'skills';
    const SKILL_SOURCE = `${SKILL_OWNER}/${SKILL_REPO}`;

    const popularPayload = {
      skills: [
        { id: 'fixture-1', name: SKILL_NAME, installs: 100, topSource: SKILL_SOURCE },
      ],
      count: 1,
      limit: 10,
      offset: 0,
    };

    const previewPayload = {
      content: `# ${SKILL_NAME}\n\nA test skill fixture for the smoke suite.`,
    };

    await page.route('**/api/workspaces/*/skills-sh/popular*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(popularPayload) }),
    );
    await page.route('**/api/workspaces/*/skills-sh/preview*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(previewPayload) }),
    );

    await page.goto('/workspaces');
    await page.getByRole('tab', { name: /Skills/ }).click();

    // Open Add Skill dialog
    await page.getByRole('button', { name: 'Add Skill' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Add Skill')).toBeVisible();

    // Popular list should show our fixture skill
    await expect(dialog.getByText('Popular Skills')).toBeVisible();
    const skillButton = dialog.getByRole('button', { name: new RegExp(SKILL_NAME, 'i') }).first();
    await expect(skillButton).toBeVisible({ timeout: 5_000 });
    await skillButton.click();

    // Preview panel should show the skill name
    await expect(dialog.locator('h3').filter({ hasText: SKILL_NAME })).toBeVisible({ timeout: 10_000 });

    // Click Install
    await dialog.getByTestId('install-skill-button').click();

    // Wait for success toast
    await expect(page.getByText(/installed successfully/i)).toBeVisible({ timeout: 20_000 });

    // Dialog should close and the skill should appear in the skills table
    await expect(dialog).not.toBeVisible();
    // Scope to main to avoid matching toast notifications
    const main = page.locator('main');
    const skillRow = main.getByRole('listitem').filter({ hasText: SKILL_NAME });
    await expect(skillRow).toBeVisible({ timeout: 5_000 });
    await expect(skillRow.getByText(`.agents/skills/${SKILL_NAME}`)).toBeVisible();

    // Now remove the skill — target the icon button by aria-label to avoid matching the row button
    await skillRow.locator(`button[aria-label="Remove ${SKILL_NAME}"]`).click();

    // Confirm in alert dialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText(SKILL_NAME)).toBeVisible();
    await alertDialog.getByRole('button', { name: 'Remove' }).click();

    // Wait for removal success toast
    await expect(page.getByText(/removed successfully/i)).toBeVisible({ timeout: 10_000 });

    // Skill row should disappear from the list
    await expect(skillRow).toHaveCount(0, { timeout: 5_000 });

    // Clean up .agents directory from workspace filesystem (in case of leftover)
    await request.delete(
      `/api/workspaces/test-workspace/fs/delete?path=.agents&recursive=true&force=true`,
    );
  });
});
