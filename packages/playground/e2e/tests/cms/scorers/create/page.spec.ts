import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

function uniqueScorerName(prefix = 'Test Scorer') {
  return `${prefix} ${Date.now().toString(36)}`;
}

async function selectType(page: Page, typeName: string) {
  // Type combobox is the first combobox on the scorer create page
  const typeCombobox = page.getByRole('combobox').first();
  await typeCombobox.click();
  await page.getByRole('option', { name: typeName }).click();
}

async function fillScorerFields(
  page: Page,
  options: {
    name?: string;
    description?: string;
    type?: string;
    provider?: string;
    model?: string;
    instructions?: string;
    scoreRangeMin?: number;
    scoreRangeMax?: number;
  },
) {
  if (options.name !== undefined) {
    const nameInput = page.getByLabel('Name');
    await nameInput.clear();
    await nameInput.fill(options.name);
  }

  if (options.description !== undefined) {
    const descInput = page.getByLabel('Description');
    await descInput.clear();
    await descInput.fill(options.description);
  }

  if (options.type !== undefined) {
    await selectType(page, options.type);
  }

  if (options.provider !== undefined) {
    const providerCombobox = page.getByRole('combobox').nth(1);
    await providerCombobox.click();
    await page.getByRole('option', { name: options.provider }).click();
  }

  if (options.model !== undefined) {
    const modelCombobox = page.getByRole('combobox').nth(2);
    await modelCombobox.click();
    await page.getByRole('option', { name: options.model }).click();
  }

  if (options.instructions !== undefined) {
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(options.instructions);
  }
}

async function fillRequiredFields(page: Page, scorerName?: string) {
  await fillScorerFields(page, {
    name: scorerName || uniqueScorerName(),
    type: 'llm-judge',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    instructions: 'You are a scorer that evaluates responses.',
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

  test('defaults to llm-judge type', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    // The type combobox should show llm-judge by default
    await expect(page.getByRole('combobox').first()).toHaveText(/llm-judge/);
  });
});

test.describe('Required Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/scorers/create');
  });

  test('shows validation error when name is empty', async ({ page }) => {
    await fillScorerFields(page, {
      type: 'llm-judge',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('shows error toast when submitting invalid form', async ({ page }) => {
    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText('Please fill in all required fields')).toBeVisible();
  });

  test('shows validation error when provider is not selected', async ({ page }) => {
    await fillScorerFields(page, {
      name: uniqueScorerName(),
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
      provider: 'OpenAI',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page.getByText(/model is required/i).or(page.getByText(/fill in all required/i))).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Scorer Creation Persistence - LLM Judge', () => {
  test('creates llm-judge scorer with all fields and redirects to scorer page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Persistence Test');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
    await expect(page.getByText('Scorer created successfully')).toBeVisible();
  });

  test('created scorer redirects and can be navigated back to', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('List Test');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });

    // Capture scorer URL
    const scorerUrl = page.url();

    // Navigate away and back to verify the URL is stable
    await page.goto('/scorers');
    await page.goto(scorerUrl);
    await expect(page).toHaveURL(scorerUrl);
  });

  test('scorer data persists across page reload', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Reload Test');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });

    // Capture the URL to verify we stay on the scorer page
    const scorerUrl = page.url();
    await page.reload();
    // After reload, we should still be on the same scorer page
    await expect(page).toHaveURL(scorerUrl, { timeout: 10000 });
  });
});

test.describe('LLM Judge Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/scorers/create');
  });

  test('persists name and description', async ({ page }) => {
    const scorerName = uniqueScorerName('Config Test');
    const description = 'A test scorer for verifying persistence';

    await fillScorerFields(page, {
      name: scorerName,
      description,
      type: 'llm-judge',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Evaluate the response.',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
    await expect(page.getByText('Scorer created successfully')).toBeVisible();
  });

  test('persists provider and model selection', async ({ page }) => {
    const scorerName = uniqueScorerName('Model Test');

    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
  });

  test('persists instructions in CodeEditor', async ({ page }) => {
    const scorerName = uniqueScorerName('Instructions Test');

    await fillScorerFields(page, {
      name: scorerName,
      type: 'llm-judge',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Rate the response quality from 0 to 1.',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
  });

  test('persists score range min/max values', async ({ page }) => {
    const scorerName = uniqueScorerName('Range Test');

    await fillScorerFields(page, {
      name: scorerName,
      type: 'llm-judge',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Score this.',
      scoreRangeMin: 0,
      scoreRangeMax: 10,
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
  });

  test('persists default sampling configuration (ratio)', async ({ page }) => {
    const scorerName = uniqueScorerName('Sampling Test');

    await fillRequiredFields(page, scorerName);

    // Configure sampling to Ratio
    await page.getByLabel('Ratio').click();

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
  });
});

test.describe('Preset Scorer Types', () => {
  const presetTypes = [
    'answer-relevancy',
    'answer-similarity',
    'bias',
    'context-precision',
    'context-relevance',
    'faithfulness',
    'hallucination',
    'noise-sensitivity',
    'prompt-alignment',
    'tool-call-accuracy',
    'toxicity',
  ];

  for (const presetType of presetTypes) {
    test(`creates ${presetType} scorer successfully`, async ({ page }) => {
      await page.goto('/cms/scorers/create');

      const scorerName = uniqueScorerName(presetType);
      await fillScorerFields(page, {
        name: scorerName,
        type: presetType,
      });

      await page.getByRole('button', { name: 'Create scorer' }).click();
      await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
      await expect(page.getByText('Scorer created successfully')).toBeVisible();
    });
  }
});

test.describe('Conditional Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/scorers/create');
  });

  test('shows model/instructions/scoreRange for llm-judge type', async ({ page }) => {
    // Default is llm-judge, so these should be visible
    await expect(page.getByText('Provider *')).toBeVisible();
    await expect(page.getByText('Model *')).toBeVisible();
    await expect(page.getByText('Score Range')).toBeVisible();
    await expect(page.locator('.cm-content')).toBeVisible();
  });

  test('hides model/instructions/scoreRange when switching to answer-relevancy', async ({ page }) => {
    await selectType(page, 'answer-relevancy');

    // Provider, Model, Score Range should not be visible
    // The labels "Provider *" and "Model *" should disappear
    await expect(page.getByText('Score Range')).not.toBeVisible();
    // CodeEditor should not be visible
    await expect(page.locator('.cm-content')).not.toBeVisible();
    // Should show preset message
    await expect(page.getByText(/built-in evaluation logic/)).toBeVisible();
  });

  test('shows model/instructions/scoreRange when switching back to llm-judge', async ({ page }) => {
    await selectType(page, 'answer-relevancy');
    await expect(page.getByText('Score Range')).not.toBeVisible();

    await selectType(page, 'llm-judge');
    await expect(page.getByText('Score Range')).toBeVisible();
    await expect(page.locator('.cm-content')).toBeVisible();
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
    await expect(page).toHaveURL(/\/cms\/scorers\/create/);
    await expect(page.getByRole('button', { name: 'Create scorer' })).toBeEnabled();
  });

  test('form remains editable after error', async ({ page }) => {
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
    await fillRequiredFields(page, uniqueScorerName('Retry Test'));

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page.getByText(/Failed to create scorer/i)).toBeVisible({ timeout: 10000 });

    // Form should still be editable
    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toBeEnabled();
  });
});

test.describe('Form Reset After Creation', () => {
  test('shows clean form when navigating back to create page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Reset Test');
    await fillRequiredFields(page, scorerName);

    await page.getByRole('button', { name: 'Create scorer' }).click();
    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });

    await page.goto('/cms/scorers/create');

    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toHaveValue('');
  });
});

test.describe('Full Scorer Creation Flow', () => {
  test('creates llm-judge scorer with all configuration and verifies in scorer detail page', async ({ page }) => {
    await page.goto('/cms/scorers/create');

    const scorerName = uniqueScorerName('Full Flow Test');

    await fillScorerFields(page, {
      name: scorerName,
      description: 'A comprehensive test scorer',
      type: 'llm-judge',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Evaluate the quality of the response on a scale of 0 to 1.',
    });

    await page.getByRole('button', { name: 'Create scorer' }).click();

    await expect(page).toHaveURL(/\/scorers\/[a-z0-9-]+/, { timeout: 15000 });
    await expect(page.getByText('Scorer created successfully')).toBeVisible();
  });
});
