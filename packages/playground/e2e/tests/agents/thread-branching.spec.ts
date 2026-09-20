import type { Page, BrowserContext } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';

/**
 * FEATURE: Shared-history thread branching
 * USER STORY: As a user, I want to branch a conversation from a message so I can
 * explore a different continuation while the original thread stays intact, and I
 * want both threads to show where the branch happened with navigation between them.
 * BEHAVIOR UNDER TEST: the per-message branch action creates a child thread that
 * shares history up to the fork point; the branch view links back to the parent at
 * the fork point; the parent view marks the fork and lists the branch in the
 * memory sidebar; the lineage survives a reload.
 */

let page: Page;
let context: BrowserContext;

const USER_MESSAGE = 'Give me the Lorem Ipsum thing';
const ASSISTANT_RESPONSE_SNIPPET = 'I can help you get accurate weather forecasts';

/** Matches only the rendered reply paragraph, not the "Branched from <auto title>" marker. */
function assistantReply(page: Page) {
  return page
    .getByTestId('thread-wrapper')
    .getByRole('paragraph')
    .filter({ hasText: ASSISTANT_RESPONSE_SNIPPET })
    .first();
}

async function sendMessage(page: Page, message: string) {
  const chatInput = page.getByPlaceholder('Enter your message...');
  await chatInput.click();
  await chatInput.pressSequentially(message, { delay: 10 });
  await page.getByRole('button', { name: 'Send' }).click();
}

/**
 * Sends one message on a fresh thread, waits for the persisted reply, then
 * branches from the assistant reply. Returns the source and branch thread ids
 * read from the URL before and after the branch navigation.
 */
async function branchFromFirstReply(page: Page) {
  await page.goto('/agents/weather-agent/chat/new');
  await sendMessage(page, USER_MESSAGE);
  await expect(assistantReply(page)).toBeVisible({ timeout: 20000 });
  await expect(page).toHaveURL(/\/agents\/weather-agent\/threads\/[^/]+$/, { timeout: 10000 });
  const sourceThreadId = page.url().split('/').pop()!;

  // Wait until the reply is persisted server-side — reloading while the stream
  // is still live makes the thread subscription replay it into synthetic
  // in-memory messages whose ids never exist in storage.
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/memory/threads/${sourceThreadId}/messages?agentId=weather-agent`);
        const data = await res.json();
        return (data.messages ?? []).filter((m: { role: string }) => m.role === 'assistant').length;
      },
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);

  // Reload so every rendered message carries its persisted id — the live
  // stream tail keeps an in-memory-only id until the next history load.
  await page.reload();
  await expect(assistantReply(page)).toBeVisible({ timeout: 20000 });

  // A re-subscribed stream can replay a synthetic in-memory copy (id prefixed
  // `start-`/`text-`) whose id is never persisted server-side. Wait until the
  // reply paragraph belongs to the persisted message row before branching.
  const replyMessage = assistantReply(page).locator('xpath=ancestor::*[@data-message-id][1]');
  await expect.poll(() => replyMessage.getAttribute('data-message-id'), { timeout: 20000 }).toMatch(/^[0-9a-f-]{36}$/);
  await replyMessage.getByRole('button', { name: 'Branch from here' }).click();
  await expect(page).not.toHaveURL(new RegExp(`/threads/${sourceThreadId}$`), { timeout: 30000 });
  const branchThreadId = page.url().split('/').pop()!;
  expect(branchThreadId).not.toBe(sourceThreadId);

  return { sourceThreadId, branchThreadId };
}

test.describe('Thread branching', () => {
  test.beforeEach(async ({ browser }) => {
    await resetStorage();
    context = await browser.newContext();
    page = await context.newPage();
    await selectFixture(page, 'text-stream');
  });

  test.afterEach(async () => {
    await context.close();
    await resetStorage();
  });

  test.describe('when a conversation is branched from an assistant reply', () => {
    test('creates a branch thread that inherits the conversation up to the fork point', async () => {
      await branchFromFirstReply(page);

      // The inherited user message and reply are rendered on the branch thread.
      await expect(page.getByTestId('thread-wrapper').getByText(USER_MESSAGE).first()).toBeVisible();
      await expect(assistantReply(page)).toBeVisible();
    });

    test('marks the fork point on the branch view with a link back to the parent', async () => {
      const { sourceThreadId } = await branchFromFirstReply(page);

      const originMarker = page.getByTestId('branch-marker-origin');
      await expect(originMarker).toBeVisible();
      await expect(originMarker.getByText(/Branched from/)).toBeVisible();
      await expect(originMarker.getByRole('link', { name: 'View parent' })).toHaveAttribute(
        'href',
        new RegExp(`/threads/${sourceThreadId}$`),
      );
    });

    test('marks the fork point on the source thread with a link to the branch', async () => {
      const { sourceThreadId, branchThreadId } = await branchFromFirstReply(page);

      await page.getByTestId('branch-marker-origin').getByRole('link', { name: 'View parent' }).click();
      await expect(page).toHaveURL(new RegExp(`/threads/${sourceThreadId}$`));

      const childMarker = page.getByTestId('branch-marker-child');
      await expect(childMarker).toBeVisible();
      await expect(childMarker.getByText(/forked here/)).toBeVisible();
      await expect(childMarker.getByRole('link', { name: 'View branch' })).toHaveAttribute(
        'href',
        new RegExp(`/threads/${branchThreadId}$`),
      );
    });

    test('lists the branch in the parent thread memory sidebar after a reload', async () => {
      // branchFromFirstReply plus a fresh page load and sidebar open can
      // approach the default 30s budget; give the whole flow headroom.
      test.setTimeout(90000);
      const { sourceThreadId, branchThreadId } = await branchFromFirstReply(page);

      // Lineage persists server-side; a fresh page load on the parent must show it.
      await page.goto(`/agents/weather-agent/threads/${sourceThreadId}`);

      const memoryCard = page.getByTestId('memory-sidebar-card');
      await expect(memoryCard).toBeVisible({ timeout: 10000 });
      if ((await memoryCard.getAttribute('aria-pressed')) !== 'true') {
        await memoryCard.click();
      }
      await expect(memoryCard).toHaveAttribute('aria-pressed', 'true');

      await expect(page.getByRole('heading', { name: 'Branches' })).toBeVisible();
      const branchesSection = page.getByRole('heading', { name: 'Branches' }).locator('xpath=..');
      const branchLink = branchesSection.locator(`a[href$="/threads/${branchThreadId}"]`);
      await expect(branchLink).toBeVisible();
      await branchLink.click();
      await expect(page).toHaveURL(new RegExp(`/threads/${branchThreadId}$`));
    });
  });

  test.describe('when the streamed reply is still rendered under a synthetic client id', () => {
    test('does not offer branching on the synthetic message block', async () => {
      await page.goto('/agents/weather-agent/chat/new');
      await sendMessage(page, USER_MESSAGE);
      await expect(assistantReply(page)).toBeVisible({ timeout: 20000 });

      // Streamed blocks keep accumulator ids (text-*/start-*) that the server
      // cannot fork at; the branch action must stay hidden on any message block
      // whose id is not a persisted UUID.
      const branchActionOnSyntheticBlock = await page.evaluate(() => {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return Array.from(document.querySelectorAll('[data-message-id]'))
          .filter(element => !uuid.test(element.getAttribute('data-message-id') ?? ''))
          .some(element =>
            Array.from(element.querySelectorAll('button')).some(
              button => button.getAttribute('aria-label') === 'Branch from here',
            ),
          );
      });
      expect(branchActionOnSyntheticBlock).toBe(false);
    });
  });
});
