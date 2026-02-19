import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

// Helper to generate unique scorer names
function uniqueScorerName(prefix = 'Test Scorer') {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Helper to fill scorer form fields
async function fillScorerFields(
  page: Page,
  options: {
    name?: string;
    description?: string;
    provider?: string;
    model?: string;
    scoreRangeMin?: string;
    scoreRangeMax?: string;
    samplingType?: 'ratio' | 'none';
    samplingRate?: string;
    instructions?: string;
  },
) {
  if (options.name !== undefined) {
    const nameInput = page.locator('#scorer-name');
    await nameInput.clear();
    await nameInput.fill(options.name);
  }

  if (options.description !== undefined) {
    const descInput = page.locator('#scorer-description');
    await descInput.clear();
    await descInput.fill(options.description);
  }

  if (options.provider !== undefined) {
    const providerCombobox = page.getByRole('combobox').nth(0);
    await providerCombobox.click();
    await page.getByRole('option', { name: options.provider }).click();
  }

  if (options.model !== undefined) {
    const modelCombobox = page.getByRole('combobox').nth(1);
    await modelCombobox.click();
    await page.getByRole('option', { name: options.model }).click();
  }

  if (options.scoreRangeMin !== undefined) {
    const minInput = page.getByPlaceholder('Min');
    await minInput.clear();
    await minInput.fill(options.scoreRangeMin);
  }

  if (options.scoreRangeMax !== undefined) {
    const maxInput = page.getByPlaceholder('Max');
    await maxInput.clear();
    await maxInput.fill(options.scoreRangeMax);
  }

  if (options.samplingType !== undefined) {
    if (options.samplingType === 'ratio') {
      await page.getByLabel('Ratio').click();
    } else {
      await page.getByLabel('None').click();
    }
  }

  if (options.samplingRate !== undefined) {
    const rateInput = page.getByPlaceholder('Rate (0-1)');
    await rateInput.clear();
    await rateInput.fill(options.samplingRate);
  }

  if (options.instructions !== undefined) {
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(options.instructions);
  }
}

// Create a scorer via the create page and return its ID
async function createScorerAndGetId(
  page: Page,
  scorerName: string,
  options?: {
    description?: string;
    provider?: string;
    model?: string;
    scoreRangeMin?: string;
    scoreRangeMax?: string;
    samplingType?: 'ratio' | 'none';
    samplingRate?: string;
    instructions?: string;
  },
): Promise<string> {
  await page.goto('/cms/scorers/create');
  // Wait for the create form to be ready
  await page.locator('#scorer-name').waitFor({ state: 'visible', timeout: 15000 });

  await fillScorerFields(page, {
    name: scorerName,
    description: options?.description ?? 'Default test description',
    instructions: options?.instructions ?? 'Default test instructions',
    provider: options?.provider ?? 'OpenAI',
    model: options?.model ?? 'gpt-4o-mini',
    ...options,
  });

  await page.getByRole('button', { name: 'Create scorer' }).click();

  // Wait for redirect to detail page at /scorers/:scorerId
  await expect(page).toHaveURL(/\/scorers\/(?!create\b)[a-z0-9-]+$/, { timeout: 15000 });

  const url = page.url();
  const scorerId = url.split('/scorers/')[1]?.split(/[/?#]/)[0];
  if (!scorerId) throw new Error('Could not extract scorer ID from URL');
  return scorerId;
}

// Navigate directly to edit page for a given scorer ID
async function goToEditPage(page: Page, scorerId: string) {
  await page.goto(`/cms/scorers/${scorerId}/edit`);
  await expect(page).toHaveURL(/\/cms\/scorers\/[a-z0-9-]+\/edit/, { timeout: 15000 });
  // Wait for the form to load (data fetch completes and form renders)
  await page.locator('#scorer-name').waitFor({ state: 'visible', timeout: 15000 });
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Page Structure & Initial State', () => {
  test('displays correct page title and header with scorer name', async ({ page }) => {
    const scorerName = uniqueScorerName('Header Test');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    await expect(page).toHaveTitle(/Mastra Studio/);
    await expect(page.locator('h1')).toContainText(`Edit scorer: ${scorerName}`);
  });

  test('displays Update scorer button', async ({ page }) => {
    const scorerName = uniqueScorerName('Button Test');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const updateButton = page.getByRole('button', { name: 'Publish' });
    await expect(updateButton).toBeVisible();
    await expect(updateButton).toBeEnabled();
  });

  test('pre-populates form with existing scorer data on load', async ({ page }) => {
    const scorerName = uniqueScorerName('Prepopulate Test');
    const description = 'Pre-populated description';
    const instructions = 'Pre-populated instructions for testing.';

    const scorerId = await createScorerAndGetId(page, scorerName, {
      description,
      scoreRangeMin: '1',
      scoreRangeMax: '5',
      samplingType: 'ratio',
      samplingRate: '0.7',
      instructions,
    });

    await goToEditPage(page, scorerId);

    await expect(page.locator('#scorer-name')).toHaveValue(scorerName);
    await expect(page.locator('#scorer-description')).toHaveValue(description);
    await expect(page.getByRole('combobox').nth(1)).toContainText('OpenAI');
    await expect(page.getByRole('combobox').nth(2)).toContainText('gpt-4o-mini');
    await expect(page.getByPlaceholder('Min')).toHaveValue('1');
    await expect(page.getByPlaceholder('Max')).toHaveValue('5');
    await expect(page.locator('#sampling-ratio')).toBeChecked();
    await expect(page.getByPlaceholder('Rate (0-1)')).toHaveValue('0.7');
    await expect(page.locator('.cm-content')).toContainText(instructions);
  });
});

test.describe('Edit Persistence', () => {
  test('updates scorer and redirects to detail page with success toast', async ({ page }) => {
    const scorerName = uniqueScorerName('Update Redirect');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const updatedName = uniqueScorerName('Updated');
    await fillScorerFields(page, { name: updatedName });

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });
    await expect(page.getByText('Scorer published')).toBeVisible();
  });

  test('persists all edited fields when returning to edit page', async ({ page }) => {
    const scorerName = uniqueScorerName('Full Edit');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const updatedName = uniqueScorerName('Fully Updated');
    const updatedDescription = 'Updated description for full edit test';
    const updatedInstructions = 'Updated instructions with new scoring criteria.';

    await fillScorerFields(page, {
      name: updatedName,
      description: updatedDescription,
      scoreRangeMin: '2',
      scoreRangeMax: '8',
      samplingType: 'ratio',
      samplingRate: '0.3',
      instructions: updatedInstructions,
    });

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });
    await expect(page.getByText('Scorer published')).toBeVisible();

    // Navigate back to edit page
    await goToEditPage(page, scorerId);

    await expect(page.locator('#scorer-name')).toHaveValue(updatedName);
    await expect(page.locator('#scorer-description')).toHaveValue(updatedDescription);
    await expect(page.getByRole('combobox').nth(1)).toContainText('OpenAI');
    await expect(page.getByRole('combobox').nth(2)).toContainText('gpt-4o-mini');
    await expect(page.getByPlaceholder('Min')).toHaveValue('2');
    await expect(page.getByPlaceholder('Max')).toHaveValue('8');
    await expect(page.locator('#sampling-ratio')).toBeChecked();
    await expect(page.getByPlaceholder('Rate (0-1)')).toHaveValue('0.3');
    await expect(page.locator('.cm-content')).toContainText(updatedInstructions);
  });

  test('persists partial field updates', async ({ page }) => {
    const scorerName = uniqueScorerName('Partial Edit');
    const scorerId = await createScorerAndGetId(page, scorerName, {
      description: 'Original description',
      scoreRangeMin: '0',
      scoreRangeMax: '10',
    });

    await goToEditPage(page, scorerId);

    // Only update description and score range max
    await fillScorerFields(page, {
      description: 'Partially updated description',
      scoreRangeMax: '20',
    });

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);

    // Changed fields should be updated
    await expect(page.locator('#scorer-description')).toHaveValue('Partially updated description');
    await expect(page.getByPlaceholder('Max')).toHaveValue('20');

    // Unchanged fields should remain the same
    await expect(page.locator('#scorer-name')).toHaveValue(scorerName);
    await expect(page.getByPlaceholder('Min')).toHaveValue('0');
    await expect(page.getByRole('combobox').nth(1)).toContainText('OpenAI');
    await expect(page.getByRole('combobox').nth(2)).toContainText('gpt-4o-mini');
  });

  test('data persists after page reload on edit page', async ({ page }) => {
    const scorerName = uniqueScorerName('Reload Edit');
    const updatedName = uniqueScorerName('After Reload');
    const updatedInstructions = 'Instructions that should survive reload.';

    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    await fillScorerFields(page, {
      name: updatedName,
      instructions: updatedInstructions,
    });

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);

    // Reload the page
    await page.reload();

    await expect(page.locator('#scorer-name')).toHaveValue(updatedName, { timeout: 10000 });
    await expect(page.locator('.cm-content')).toContainText(updatedInstructions, { timeout: 10000 });
  });
});

test.describe('Field-by-Field Update Verification', () => {
  test('updating name persists correctly', async ({ page }) => {
    const scorerName = uniqueScorerName('Name Field');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const updatedName = uniqueScorerName('Name Updated');
    await fillScorerFields(page, { name: updatedName });

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);
    await expect(page.locator('#scorer-name')).toHaveValue(updatedName);
    await expect(page.locator('h1')).toContainText(`Edit scorer: ${updatedName}`);
  });

  test('updating description persists correctly', async ({ page }) => {
    const scorerName = uniqueScorerName('Desc Field');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    await fillScorerFields(page, { description: 'A newly added description' });

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);
    await expect(page.locator('#scorer-description')).toHaveValue('A newly added description');
  });

  test('updating score range persists correctly', async ({ page }) => {
    const scorerName = uniqueScorerName('Range Field');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    await fillScorerFields(page, { scoreRangeMin: '5', scoreRangeMax: '100' });

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);
    await expect(page.getByPlaceholder('Min')).toHaveValue('5');
    await expect(page.getByPlaceholder('Max')).toHaveValue('100');
  });

  test('changing sampling type from none to ratio persists correctly', async ({ page }) => {
    const scorerName = uniqueScorerName('Sampling None-Ratio');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    await fillScorerFields(page, { samplingType: 'ratio', samplingRate: '0.6' });

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);
    await expect(page.locator('#sampling-ratio')).toBeChecked();
    await expect(page.getByPlaceholder('Rate (0-1)')).toHaveValue('0.6');
  });

  test('changing sampling type from ratio to none persists correctly', async ({ page }) => {
    const scorerName = uniqueScorerName('Sampling Ratio-None');
    const scorerId = await createScorerAndGetId(page, scorerName, {
      samplingType: 'ratio',
      samplingRate: '0.5',
    });

    await goToEditPage(page, scorerId);

    await fillScorerFields(page, { samplingType: 'none' });

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);
    await expect(page.locator('#sampling-none')).toBeChecked();
    await expect(page.getByPlaceholder('Rate (0-1)')).not.toBeVisible();
  });

  test('updating instructions persists correctly', async ({ page }) => {
    const scorerName = uniqueScorerName('Instructions Field');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const newInstructions = 'Brand new scoring instructions for this test.';
    await fillScorerFields(page, { instructions: newInstructions });

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    await goToEditPage(page, scorerId);
    await expect(page.locator('.cm-content')).toContainText(newInstructions);
  });
});

test.describe('Validation on Edit', () => {
  test('shows validation error when name is cleared', async ({ page }) => {
    const scorerName = uniqueScorerName('Validation Name');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const nameInput = page.locator('#scorer-name');
    await nameInput.clear();

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('shows error toast when form has validation errors', async ({ page }) => {
    const scorerName = uniqueScorerName('Validation Toast');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    const nameInput = page.locator('#scorer-name');
    await nameInput.clear();

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Please fill in all required fields')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('shows error toast and allows retry on update failure', async ({ page }) => {
    const scorerName = uniqueScorerName('Error Handling');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    // Intercept PATCH requests to simulate server error (set up after page loads)
    await page.route(`**/stored/scorers/${scorerId}**`, route => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    await fillScorerFields(page, { name: uniqueScorerName('Should Fail') });

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText(/Failed to publish scorer/i)).toBeVisible({ timeout: 15000 });

    // Should stay on edit page with button still enabled
    await expect(page).toHaveURL(/\/cms\/scorers\/[a-z0-9-]+\/edit/);
    await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled();
  });

  test('stays on edit page when update fails and preserves form data', async ({ page }) => {
    const scorerName = uniqueScorerName('Preserve Data');
    const scorerId = await createScorerAndGetId(page, scorerName);

    await goToEditPage(page, scorerId);

    // Intercept PATCH requests to simulate server error (set up after page loads)
    await page.route(`**/stored/scorers/${scorerId}**`, route => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    const updatedName = uniqueScorerName('Not Lost');
    const updatedDescription = 'This description should not be lost';
    await fillScorerFields(page, { name: updatedName, description: updatedDescription });

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText(/Failed to publish scorer/i)).toBeVisible({ timeout: 15000 });

    // Form data should still be present
    await expect(page.locator('#scorer-name')).toHaveValue(updatedName);
    await expect(page.locator('#scorer-description')).toHaveValue(updatedDescription);
  });
});

test.describe('Navigation & State', () => {
  test('navigating away and back to edit page shows persisted data', async ({ page }) => {
    const scorerName = uniqueScorerName('Nav Away');
    const description = 'Description for nav test';
    const scorerId = await createScorerAndGetId(page, scorerName, { description });

    await goToEditPage(page, scorerId);

    // Verify initial data
    await expect(page.locator('#scorer-name')).toHaveValue(scorerName);

    // Navigate away
    await page.goto('/cms/scorers/create');
    await expect(page).toHaveURL(/\/cms\/scorers\/create/);

    // Navigate back to edit page
    await goToEditPage(page, scorerId);

    await expect(page.locator('#scorer-name')).toHaveValue(scorerName);
    await expect(page.locator('#scorer-description')).toHaveValue(description);
  });

  test('form reflects latest server data after re-navigation', async ({ page }) => {
    const scorerName = uniqueScorerName('Latest Data');
    const scorerId = await createScorerAndGetId(page, scorerName);

    // First edit: update the name
    await goToEditPage(page, scorerId);
    const firstUpdate = uniqueScorerName('First Update');
    await fillScorerFields(page, { name: firstUpdate });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    // Second edit: update again
    await goToEditPage(page, scorerId);
    const secondUpdate = uniqueScorerName('Second Update');
    await fillScorerFields(page, { name: secondUpdate });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+$/, { timeout: 15000 });

    // Navigate back to edit - should show second update, not first
    await goToEditPage(page, scorerId);
    await expect(page.locator('#scorer-name')).toHaveValue(secondUpdate);
  });
});
