import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { seedThread } from '../../__utils__/seed-thread';

/**
 * FEATURE: Chat history pagination
 * USER STORY: As a user opening a long conversation, I want the newest messages
 * first and the older ones to load as I scroll up, so that nothing is lost
 * and the page stays fast.
 * BEHAVIOR UNDER TEST: The thread page fetches history 40 messages at a time,
 * newest first, and reveals the previous page when the reader reaches the top.
 */

const THREAD_ID = 'history-pagination-thread';
const VIEWPORT = '[data-slot="message-scroller-viewport"]';

/** Scrolls back a little first so the scroller sees a genuine trip to the top, then reaches it. */
const scrollToTop = async (page: Page) => {
  const viewport = page.locator(VIEWPORT);
  await viewport.evaluate(el => {
    el.scrollTop -= 200;
  });
  await page.waitForTimeout(50);
  await viewport.evaluate(el => {
    el.scrollTop = 0;
  });
};
const MESSAGE_COUNT = 50;

test.describe('Agent thread history pagination', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a thread holds more messages than one page', () => {
    test.beforeEach(async ({ page }) => {
      await seedThread(THREAD_ID, MESSAGE_COUNT);
      await page.goto(`/agents/weather-agent/chat/${THREAD_ID}`);
      await expect(page.getByText(`seed message ${MESSAGE_COUNT - 1}`, { exact: true })).toBeVisible();
    });

    test('shows only the newest page on open', async ({ page }) => {
      const rendered = page.locator('[data-slot="message-scroller-item"][data-message-id^="seed-"]');
      await expect(rendered).toHaveCount(40);
      await expect(rendered.first()).toHaveAttribute('data-message-id', 'seed-10');
      await expect(page.getByText('seed message 0', { exact: true })).toHaveCount(0);
    });

    test('loads the older page above the thread when scrolled to the top', async ({ page }) => {
      await scrollToTop(page);

      await expect(page.getByText('seed message 0', { exact: true })).toBeVisible();
      await expect(page.locator('[data-slot="message-scroller-item"][data-message-id^="seed-"]')).toHaveCount(
        MESSAGE_COUNT,
      );
    });

    test('renders the full history in chronological order without duplicates', async ({ page }) => {
      await scrollToTop(page);
      await expect(page.locator('[data-slot="message-scroller-item"][data-message-id^="seed-"]')).toHaveCount(
        MESSAGE_COUNT,
      );

      const ids = await page
        .locator('[data-slot="message-scroller-item"][data-message-id^="seed-"]')
        .evaluateAll(els => els.map(el => el.getAttribute('data-message-id')));
      expect(ids).toEqual(Array.from({ length: MESSAGE_COUNT }, (_, i) => `seed-${i}`));
    });
  });
});
