import type { Page, BrowserContext } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { selectFixture } from '../../__utils__/select-fixture';

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
 * killing Enter. The current implementation delegates IME handling to
 * `@assistant-ui/react`'s ComposerPrimitive.Input, which reads the
 * browser-owned `event.isComposing` flag directly on each keydown and only
 * tracks composition state via the live `compositionstart` / `compositionend`
 * events — so there is no ref state that can get stuck.
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

test.describe('Chat input IME composition', () => {
  test.describe('when Enter is pressed during an active IME composition', () => {
    test('does not submit, then submits after the composition ends', async () => {
      await selectFixture(page, 'text-stream');
      await page.goto(`/agents/weather-agent/chat/new`);
      await page.getByTestId('composer-model-settings-trigger').click();
      await page.click('text=Stream');
      await page.keyboard.press('Escape');

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
      // not flag isComposing on its own). The composer's IME guard short-circuits
      // before any submit logic runs, so it does NOT call preventDefault — it just
      // returns early. That's the behavior we care about: no submission.
      const defaultPreventedDuringComposition = await page.evaluate(() => {
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

      // Guard returns early during composition without calling preventDefault.
      expect(defaultPreventedDuringComposition).toBe(false);

      // The real user-facing check: the URL should still be /chat/new because no
      // submit happened, and the textarea should still hold the in-progress text.
      await expect(page).toHaveURL(/\/chat\/new$/);
      await expect(chatInput).toHaveValue('hello');

      // End the composition session, mirroring the user confirming an IME candidate.
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) throw new Error('No active element to dispatch composition events on');
        el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'hello' }));
      });

      // Now Enter should submit the message normally, navigating away from /chat/new.
      // Wait for the composer to be idle (Send enabled) so the Enter is not dropped
      // by the handler's running-thread guard.
      await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 10000 });
      await chatInput.focus();
      await page.keyboard.press('Enter');

      await expect(page).not.toHaveURL(/\/chat\/new/, { timeout: 20000 });
      await expect(page.getByTestId('pending-signal-message')).not.toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('thread-wrapper').getByText('hello')).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('when the IME is switched mid-composition without a compositionend', () => {
    test('still submits on the next Enter — #16464 regression', async () => {
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
      await page.getByTestId('composer-model-settings-trigger').click();
      await page.click('text=Stream');
      await page.keyboard.press('Escape');

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

      // Wait until the composer is idle with text queued (Send enabled). The
      // assistant-ui keydown handler short-circuits before preventDefault when the
      // thread is still running, so without this the synthetic Enter below can
      // racily observe a running composer and leave defaultPrevented false.
      await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 10000 });

      // A subsequent Enter with isComposing=false (the IME is no longer active) should
      // submit, because the guard reads from the live event, not a stale ref. The
      // composer calls preventDefault() before requesting the form submit.
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

      // Guard let this Enter through to the submit path — preventDefault was
      // called as part of requesting the form submit (not as a way to block it).
      expect(defaultPrevented).toBe(true);

      // And the submit should go through end-to-end.
      await chatInput.focus();
      await page.keyboard.press('Enter');

      await expect(page).not.toHaveURL(/\/chat\/new/, { timeout: 20000 });
      await expect(page.getByTestId('pending-signal-message')).not.toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('thread-wrapper').getByText('hello')).toBeVisible({ timeout: 20000 });
    });
  });
});
