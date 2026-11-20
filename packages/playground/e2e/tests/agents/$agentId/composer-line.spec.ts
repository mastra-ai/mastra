import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: One-line composer
 * USER STORY: As a user reading a conversation, I want the idle composer to take one line,
 * and to open into a full box when I start writing, without the Send button jumping away.
 * BEHAVIOR UNDER TEST: focus opens the composer upward, leaving focus with nothing typed
 * closes it, a draft keeps it open, and Send keeps its place throughout.
 */

const box = (page: Page) => page.locator('[data-slot="composer-box"]');
const height = async (page: Page) => (await box(page).boundingBox())?.height ?? 0;
const sendPosition = async (page: Page) => {
  const rect = await page.getByRole('button', { name: 'Send' }).boundingBox();
  return { x: Math.round(rect?.x ?? 0), y: Math.round(rect?.y ?? 0) };
};

test.describe('One-line composer', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the user focuses the input and leaves it', () => {
    test('opens upward without moving Send, then closes back to one line', async ({ page }) => {
      await page.goto('/agents/weather-agent/chat/new');
      const input = page.getByPlaceholder('Enter your message');
      await expect(input).toBeVisible();

      const idleHeight = await height(page);
      const idleSend = await sendPosition(page);

      await input.click();
      await expect.poll(() => height(page)).toBeGreaterThan(idleHeight);
      expect(await sendPosition(page)).toEqual(idleSend);

      await input.blur();
      await expect.poll(() => height(page)).toBe(idleHeight);
    });
  });

  test.describe('when the user leaves a draft behind', () => {
    test('keeps the composer open', async ({ page }) => {
      await page.goto('/agents/weather-agent/chat/new');
      const input = page.getByPlaceholder('Enter your message');
      await expect(input).toBeVisible();
      const idleHeight = await height(page);

      await input.fill('What is the weather in Paris?');
      await input.blur();
      await expect.poll(() => height(page)).toBeGreaterThan(idleHeight);
    });
  });
});
