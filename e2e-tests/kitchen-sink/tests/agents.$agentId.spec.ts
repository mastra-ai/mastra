import { test, expect } from '@playwright/test';

test('verfied persistent model settings', async ({ page }) => {
  // Arrange
  await page.goto('http://localhost:4111/agents/weatherAgent/chat/new');
  await page.click('text=Model settings');
  await page.isVisible('text=Chat Method');
  await page.click('text=Generate');
  await page.click('text=Advanced Settings');
  await page.getByLabel('Top K').fill('9');
  await page.getByLabel('Frequency Penalty').fill('0.7');
  await page.getByLabel('Presence Penalty').fill('0.6');
  await page.getByLabel('Max Tokens').fill('44');
  await page.getByLabel('Max Steps').fill('3');
  await page.getByLabel('Max Retries').fill('2');

  // Act
  await page.reload();
  await page.click('text=Model settings');
  await page.click('text=Advanced Settings');

  // Assert
  await expect(page.getByLabel('Top K')).toHaveValue('9');
  await expect(page.getByLabel('Frequency Penalty')).toHaveValue('0.7');
  await expect(page.getByLabel('Presence Penalty')).toHaveValue('0.6');
  await expect(page.getByLabel('Max Tokens')).toHaveValue('44');
  await expect(page.getByLabel('Max Steps')).toHaveValue('3');
  await expect(page.getByLabel('Max Retries')).toHaveValue('2');
});

test('resets the form values when pressing "reset" button', async ({ page }) => {
  // Arrange
  await page.goto('http://localhost:4111/agents/weatherAgent/chat/new');
  await page.click('text=Model settings');
  await page.isVisible('text=Chat Method');
  await page.click('text=Generate');
  await page.click('text=Advanced Settings');
  await page.getByLabel('Top K').fill('9');
  await page.getByLabel('Frequency Penalty').fill('0.7');
  await page.getByLabel('Presence Penalty').fill('0.6');
  await page.getByLabel('Max Tokens').fill('44');
  await page.getByLabel('Max Steps').fill('3');
  await page.getByLabel('Max Retries').fill('2');

  // Act
  await page.click('text=Reset');

  // Assert
  await expect(page.getByLabel('Top K')).toHaveValue('');
  await expect(page.getByLabel('Frequency Penalty')).toHaveValue('');
  await expect(page.getByLabel('Presence Penalty')).toHaveValue('');
  await expect(page.getByLabel('Max Tokens')).toHaveValue('');
  await expect(page.getByLabel('Max Steps')).toHaveValue('5');
  await expect(page.getByLabel('Max Retries')).toHaveValue('2');
});
