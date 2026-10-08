import { expect, test } from '@playwright/test';

test.describe('Primitive workspace drafts', () => {
  test.describe('when moving a prompt form into the mobile sidebar', () => {
    test('preserves an unfinished variable and prompt name', async ({ page }) => {
      await page.goto('/cms/prompts/create');
      const navigation = page.getByRole('complementary', { name: 'Prompt navigation', exact: true });
      const name = navigation.getByRole('textbox', { name: /Name/ });
      await name.fill('Travel checklist');
      await navigation.getByRole('button', { name: 'Add variable', exact: true }).click();
      const variable = navigation.getByPlaceholder('Variable name', { exact: true });
      await expect(variable).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Prompt navigation', exact: true }).click();
      await expect(name).toHaveValue('Travel checklist');
      await expect(variable).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(name).toHaveValue('Travel checklist');
      await expect(variable).toBeVisible();
    });
  });
  test.describe('when moving workflow controls into the mobile sidebar', () => {
    test('preserves the unsent workflow input', async ({ page }) => {
      await page.goto('/workflows/lessComplexWorkflow/graph');
      const navigation = page.getByRole('complementary', { name: 'Workflow navigation', exact: true });
      const input = navigation.getByRole('textbox', { name: /Text/ });
      await input.fill('Keep this draft');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Workflow navigation', exact: true }).click();
      await expect(input).toHaveValue('Keep this draft');
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(input).toHaveValue('Keep this draft');
      await expect(navigation.getByTestId('workflow-information-panel')).toHaveCount(1);
    });
  });
});
