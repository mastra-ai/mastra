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
    description: string;
    provider?: string;
    model?: string;
    scoreRangeMin?: string;
    scoreRangeMax?: string;
    samplingType?: 'ratio' | 'none';
    samplingRate?: string;
    instructions: string;
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

// Helper to fill all required fields with valid data
async function fillRequiredFields(page: Page, scorerName?: string) {
  await fillScorerFields(page, {
    name: scorerName || uniqueScorerName(),
    description: 'Test scorer description',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    instructions: 'Test instructions',
  });
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Page Structure & Initial State', () => {
  test('displays page title and header correctly', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    await expect(page).toHaveTitle(/Mastra Studio/);
    await expect(page.locator('h1')).toHaveText('Create a scorer');
  });

  test('displays Create scorer button', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const createButton = page.getByRole('button', { name: 'Create scorer' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
  });
});

test.describe('Required Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/scorers/create');
  });

  test('shows validation error when name is empty', async ({ page }) => {
    await fillScorerFields(page, {
      description: 'Test description',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('shows validation error when provider is not selected', async ({ page }) => {
    await fillScorerFields(page, {
      name: uniqueScorerName(),
      description: 'Test description',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText(/provider is required/i).or(page.getByText(/fill in all required/i))).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows validation error when model is not selected', async ({ page }) => {
    await fillScorerFields(page, {
      name: uniqueScorerName(),
      description: 'Test description',
      provider: 'OpenAI',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText(/model is required/i).or(page.getByText(/fill in all required/i))).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows error toast when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText('Please fill in all required fields')).toBeVisible();
  });
});

test.describe('Scorer Creation Persistence', () => {
  test('creates scorer and redirects to detail page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Persistence Test');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-zA-Z0-9-]+/, { timeout: 15000 });
    await expect(page.getByText('Scorer created successfully')).toBeVisible();
  });

  test('persists all fields and verifies them on edit page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Full Persist');
    const description = 'A comprehensive test scorer';
    const instructions = 'Score the response based on accuracy and completeness.';

    await fillScorerFields(page, {
      name: scorerName,
      description,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      scoreRangeMin: '0',
      scoreRangeMax: '10',
      samplingType: 'ratio',
      samplingRate: '0.5',
      instructions,
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // Click the Edit button on the detail page
    const editLink = page.getByRole('link', { name: 'Edit' });
    await expect(editLink).toBeVisible({ timeout: 10000 });
    await editLink.click();

    // Wait for the edit page to load
    await expect(page).toHaveURL(/\/cms\/scorers\/[a-zA-Z0-9-]+\/edit/, { timeout: 15000 });

    // Verify h1 contains the scorer name
    await expect(page.locator('h1')).toContainText(`Edit scorer: ${scorerName}`);

    // Verify Publish button is visible
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();

    // Verify name
    await expect(page.locator('#scorer-name')).toHaveValue(scorerName);

    // Verify description
    await expect(page.locator('#scorer-description')).toHaveValue(description);

    // Verify provider combobox contains OpenAI (nth(1) because version combobox is nth(0) on edit page)
    await expect(page.getByRole('combobox').nth(1)).toContainText('OpenAI');

    // Verify model combobox contains gpt-4o-mini
    await expect(page.getByRole('combobox').nth(2)).toContainText('gpt-4o-mini');

    // Verify score range
    await expect(page.getByPlaceholder('Min')).toHaveValue('0');
    await expect(page.getByPlaceholder('Max')).toHaveValue('10');

    // Verify sampling type is ratio
    await expect(page.locator('#sampling-ratio')).toBeChecked();

    // Verify sampling rate
    await expect(page.getByPlaceholder('Rate (0-1)')).toHaveValue('0.5');

    // Verify instructions
    await expect(page.locator('.cm-content')).toContainText(instructions);
  });

  test('persists minimal fields with correct defaults on edit page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Minimal Persist');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // Wait for Edit link to be visible before clicking
    const editLink = page.getByRole('link', { name: 'Edit' });
    await expect(editLink).toBeVisible({ timeout: 10000 });
    await editLink.click();

    await expect(page).toHaveURL(/\/cms\/scorers\/[a-zA-Z0-9-]+\/edit/, { timeout: 15000 });

    // Verify name is set
    await expect(page.locator('#scorer-name')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#scorer-name')).toHaveValue(scorerName);

    // Verify description has the value set by fillRequiredFields
    await expect(page.locator('#scorer-description')).toHaveValue('Test scorer description');

    // Verify default score range (0-1)
    await expect(page.getByPlaceholder('Min')).toHaveValue('0');
    await expect(page.getByPlaceholder('Max')).toHaveValue('1');

    // Verify ratio rate input is not visible (sampling type is none by default)
    await expect(page.getByPlaceholder('Rate (0-1)')).not.toBeVisible();
  });

  test('data persists after page reload on edit page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Reload Persist');
    const instructions = 'Evaluate response quality on a scale.';

    await fillScorerFields(page, {
      name: scorerName,
      description: 'Test description for reload',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions,
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // Navigate to edit page
    const editLink = page.getByRole('link', { name: 'Edit' });
    await expect(editLink).toBeVisible({ timeout: 10000 });
    await editLink.click();

    await expect(page).toHaveURL(/\/cms\/scorers\/[a-zA-Z0-9-]+\/edit/, { timeout: 15000 });

    // Reload the page
    await page.reload();

    // Verify name persists after reload
    await expect(page.locator('#scorer-name')).toHaveValue(scorerName, { timeout: 10000 });

    // Verify instructions persist after reload
    await expect(page.locator('.cm-content')).toContainText(instructions, { timeout: 10000 });
  });
});

test.describe('Error Handling', () => {
  test('shows error toast and allows retry on creation failure', async ({ page }) => {
    await page.route('**/stored/scorers', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/cms/scorers/create');

    await fillRequiredFields(page, uniqueScorerName('Error Test'));

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText(/Failed to create scorer/i)).toBeVisible({ timeout: 10000 });

    // Should stay on create page with button still enabled
    await expect(page).toHaveURL(/\/cms\/scorers\/create/);
    await expect(page.getByRole('button', { name: 'Create scorer' })).toBeEnabled();
  });
});

test.describe('Form Reset After Creation', () => {
  test('shows clean form when navigating back to create page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Reset Test');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // Navigate back to create page
    await page.goto('/cms/scorers/create');

    // Form should be empty
    await expect(page.locator('#scorer-name')).toHaveValue('');
    await expect(page.locator('#scorer-description')).toHaveValue('');
  });
});

test.describe('Provider-Model Interaction', () => {
  test('provider selection updates available models', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    // Select OpenAI provider
    const providerCombobox = page.getByRole('combobox').nth(0);
    await providerCombobox.click();
    await page.getByRole('option', { name: 'OpenAI' }).click();

    // Open model dropdown
    const modelCombobox = page.getByRole('combobox').nth(1);
    await modelCombobox.click();

    // Should have GPT models
    await expect(page.getByRole('option', { name: /gpt-4/i }).first()).toBeVisible();
  });
});
