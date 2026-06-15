import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Workflow Run Options dialog (tracing options JSON editor)
 * USER STORY: As a Studio user, I want to type tracing options JSON into the Run
 *   Options dialog — including making intermediate invalid edits and pressing
 *   backspace — without the dialog closing or losing my text.
 * BEHAVIOR UNDER TEST: Typing/editing in the CodeMirror editor keeps the dialog
 *   open and preserves the exact text the user entered.
 */

test.afterEach(async () => {
  await resetStorage();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/workflows/complexWorkflow/graph');
});

const openRunOptions = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Run Options' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
};

test('typing into the run options editor keeps the dialog open', async ({ page }) => {
  await openRunOptions(page);

  const editor = page.getByRole('dialog').locator('.cm-content');
  await editor.click();

  // Type a JSON object character by character; this triggers CodeMirror's
  // autocomplete/hover tooltips which previously dismissed the dialog.
  await page.keyboard.type('{"metadata": {"a": 1}}', { delay: 30 });

  // The dialog must still be open and the text must be present.
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(editor).toContainText('"metadata"');
});

test('backspacing in the run options editor keeps the dialog open and preserves text', async ({ page }) => {
  await openRunOptions(page);

  const editor = page.getByRole('dialog').locator('.cm-content');
  await editor.click();

  await page.keyboard.type('{"foo": "bar"}', { delay: 30 });

  // Backspace several times (this is the reported repro that closed the dialog).
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(40);
  }

  await expect(page.getByRole('dialog')).toBeVisible();
  // After removing the trailing 4 chars (`bar"}` -> `bar` minus closing) text is still there.
  await expect(editor).toContainText('"foo"');
});

test('valid tracing options persist after clicking Save', async ({ page }) => {
  await openRunOptions(page);

  const editor = page.getByRole('dialog').locator('.cm-content');
  await editor.fill('{"metadata": {"persisted": true}}');

  // Typing alone does not persist; the dialog stays open until the user saves.
  await expect(page.getByRole('dialog')).toBeVisible();

  // Saving persists the options and closes the dialog.
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Re-open the dialog and verify the value persisted.
  await openRunOptions(page);
  await expect(page.getByRole('dialog').locator('.cm-content')).toContainText('persisted');
});
