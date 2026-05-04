import { test, expect, Page, BrowserContext } from '@playwright/test';
import { selectFixture } from '../../__utils__/select-fixture';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Chat input IME composition handling
 * USER STORY: As a user typing CJK text via an IME (e.g. Chinese pinyin),
 * I want pressing Enter to confirm an in-progress composition without
 * accidentally submitting my message, and Enter outside of composition
 * should still submit normally.
 * BEHAVIOR UNDER TEST: When the textarea is in an active IME composition
 * session, an Enter keydown must NOT trigger the agent submit. After the
 * composition ends, an Enter keydown must trigger submit as usual.
 *
 * Background: Issue #16109 — pressing Enter to commit a Chinese pinyin
 * candidate was incorrectly submitting the chat. The fix tracks composition
 * state via onCompositionStart/onCompositionEnd plus nativeEvent.isComposing,
 * and calls preventDefault()/stopPropagation() on Enter during composition.
 */

let page: Page;
let context: BrowserContext;

test.beforeEach(async ({ browser }) => {
  await resetStorage();
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterEach(async () => {
  await context.close();
  await resetStorage();
});

test('Enter during IME composition does not submit, Enter after composition does submit', async () => {
  await selectFixture(page, 'text-stream');
  await page.goto(`/agents/weather-agent/chat/new`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  const chatInput = page.getByPlaceholder('Enter your message...');
  await chatInput.click();
  await chatInput.pressSequentially('hello', { delay: 10 });

  // Simulate the start of an IME composition session on the focused textarea.
  // Real IMEs dispatch compositionstart before the user confirms a candidate;
  // we replicate that here so the Thread's isComposingRef flips to true.
  await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) throw new Error('No active element to dispatch composition events on');
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
  });

  // Press Enter while composing. We use dispatchEvent with isComposing: true
  // to mirror what browsers send during IME (Playwright's keyboard.press does
  // not flag isComposing on its own).
  const submitsDuringComposition = await page.evaluate(() => {
    const el = document.activeElement as HTMLTextAreaElement | null;
    if (!el) throw new Error('No active textarea');
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });

  // The fix calls preventDefault() during composition — assert that.
  expect(submitsDuringComposition).toBe(true);

  // The URL should still be /chat/new because no submit happened, and the
  // textarea should still hold the in-progress text.
  await expect(page).toHaveURL(/\/chat\/new$/);
  await expect(chatInput).toHaveValue('hello');

  // End the composition session, mirroring the user confirming an IME candidate.
  await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) throw new Error('No active element to dispatch composition events on');
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'hello' }));
  });

  // Now Enter should submit the message normally, navigating away from /chat/new.
  await chatInput.focus();
  await page.keyboard.press('Enter');

  await expect(page).not.toHaveURL(/\/chat\/new/, { timeout: 20000 });
  await expect(page.getByTestId('thread-wrapper').getByText('hello')).toBeVisible({ timeout: 20000 });
});
