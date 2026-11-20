import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: One-line composer
 * USER STORY: As a user reading a conversation, I want the idle composer to take one line,
 * and to open into a full box when I start writing, without the Send button jumping away.
 * BEHAVIOR UNDER TEST: focus opens the composer upward, leaving focus with nothing typed
 * closes it, a draft keeps it open, and Send keeps its place throughout.
 * Studio focuses the input once it can be used, so each test waits for that and blurs it to reach the idle line.
 */

const box = (page: Page) => page.locator('[data-slot="composer-box"]');
const height = async (page: Page) => (await box(page).boundingBox())?.height ?? 0;
const settledHeight = async (page: Page) => {
  await expect
    .poll(() =>
      page
        .locator('[data-slot="composer"]')
        .evaluate(
          root =>
            root
              .getAnimations({ subtree: true })
              .filter(
                animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity,
              ).length,
        ),
    )
    .toBe(0);
  return height(page);
};
const gotoIdleComposer = async (page: Page) => {
  await page.goto('/agents/weather-agent/chat/new');
  const input = page.getByPlaceholder('Enter your message');
  await expect(input).toBeFocused();
  await input.blur();
  return { input, idleHeight: await settledHeight(page) };
};
const sendPosition = async (page: Page) => {
  const rect = await page.getByRole('button', { name: 'Send' }).boundingBox();
  return { x: rect?.x ?? 0, y: rect?.y ?? 0 };
};
const expectSamePlace = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(1);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(1);
};

test.describe('One-line composer', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the user focuses the input and leaves it', () => {
    test('opens upward without moving Send, then closes back to one line', async ({ page }) => {
      const { input, idleHeight } = await gotoIdleComposer(page);
      const idleSend = await sendPosition(page);

      await input.click();
      await expect.poll(() => height(page)).toBeGreaterThan(idleHeight);
      await settledHeight(page);
      expectSamePlace(await sendPosition(page), idleSend);

      await input.blur();
      await expect.poll(() => height(page)).toBe(idleHeight);
    });
  });

  test.describe('when the user leaves a draft behind', () => {
    test('keeps the composer open', async ({ page }) => {
      const { input, idleHeight } = await gotoIdleComposer(page);

      await input.fill('What is the weather in Paris?');
      const openHeight = await settledHeight(page);
      expect(openHeight).toBeGreaterThan(idleHeight);

      await input.blur();
      expect(await settledHeight(page)).toBe(openHeight);
    });
  });
});
