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
 * candidate was incorrectly submitting the chat. Issue #16464 — the original
 * fix tracked composition state in a ref that got stuck `true` when users
 * switched input methods mid-composition (Caps Lock / Cmd+Space), permanently
 * killing Enter. Current fix reads the browser-owned `event.isComposing` flag
 * directly (plus legacy `keyCode === 229`) so there is no state to get stuck.
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
  // Real IMEs dispatch compositionstart before the user confirms a candidate.
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

test('Enter after IME switch (no compositionend) still submits — #16464 regression', async () => {
  // Repro for the stuck-state bug introduced by the previous fix:
  // 1. User starts composing (compositionstart fires).
  // 2. User switches input methods (Caps Lock / Cmd+Space) WITHOUT confirming —
  //    in many browser/OS combinations `compositionend` is never dispatched.
  // 3. With the previous ref-based approach, isComposingRef was stuck `true`
  //    and every subsequent Enter was preventDefaulted, making the chat input
  //    appear permanently disabled. Reading native `isComposing` instead means
  //    the next Enter (with isComposing=false) submits normally.
  await selectFixture(page, 'text-stream');
  await page.goto(`/agents/weather-agent/chat/new`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  const chatInput = page.getByPlaceholder('Enter your message...');
  await chatInput.click();
  await chatInput.pressSequentially('hello', { delay: 10 });

  // Start composition…
  await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) throw new Error('No active element to dispatch composition events on');
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
  });
  // …and deliberately DO NOT fire compositionend, mimicking the IME-switch case.

  // A subsequent Enter with isComposing=false (the IME is no longer active) should
  // submit, because the guard now reads from the live event, not a stale ref.
  const defaultPrevented = await page.evaluate(() => {
    const el = document.activeElement as HTMLTextAreaElement | null;
    if (!el) throw new Error('No active textarea');
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: false,
    });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });

  // Guard should NOT have preventDefaulted this Enter — the IME is no longer composing.
  expect(defaultPrevented).toBe(false);

  // And the submit should go through end-to-end.
  await chatInput.focus();
  await page.keyboard.press('Enter');

  await expect(page).not.toHaveURL(/\/chat\/new/, { timeout: 20000 });
  await expect(page.getByTestId('thread-wrapper').getByText('hello')).toBeVisible({ timeout: 20000 });
});
