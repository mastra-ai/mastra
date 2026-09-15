import type { Locator } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Composer ring
 * USER STORY: As a user typing a message, I want the coloured arc on the
 * composer edge to react to my cursor, not to follow it around the border for
 * the rest of the session because I once clicked into the input.
 * BEHAVIOR UNDER TEST: the arc points at the pointer, so only hover lights it.
 * Focus alone leaves it dark — the focused edge is carried by the plain border
 * colour instead.
 */

const arcStrength = (ring: Locator) =>
  ring.evaluate(element => getComputedStyle(element).getPropertyValue('--composer-ring-strength').trim());

test.describe('Composer ring', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the composer is focused with the pointer away from it', () => {
    test('keeps the arc dark until the pointer comes back over the composer', async ({ page }) => {
      await page.goto('/agents/weather-agent/chat/new');

      const ring = page.locator('[data-slot="composer-ring"]');
      await expect(ring).toBeVisible();

      await page.getByPlaceholder('Enter your message...').focus();
      await page.mouse.move(0, 0);
      await expect.poll(() => arcStrength(ring)).toBe('0');

      await ring.hover();
      await expect.poll(() => arcStrength(ring)).toBe('0.4');
    });
  });
});
