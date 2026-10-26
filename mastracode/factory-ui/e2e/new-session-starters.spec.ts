import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

import { workItem } from '../src/ui/__tests__/workBoardStubs';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from '../src/ui/pages/__tests__/fixtures/draftRoute';
import { server } from './ui/msw-server';
import { TEST_BASE_URL } from './ui/render';

const intake = Array.from({ length: 7 }, (_, index) => ({
  ...workItem(`intake-${index}`, `Intake card ${index}`, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
  stages: ['intake'],
}));

const drafts = [
  ['an empty composer', ''],
  ['a draft taller than the empty composer', Array.from({ length: 8 }, (_, line) => `my idea ${line}`).join('\n')],
];

/** The composer's text and where it and the suggestion sit, read in one go so a flickering preview cannot slip between them. */
async function snapshot(message: Locator, suggestion: Locator) {
  const row = await suggestion.elementHandle();
  return message.evaluate((input, other) => {
    const edges = (element: Element | null) => {
      const rect = element?.getBoundingClientRect();
      return rect ? [rect.top, rect.bottom] : [Number.NaN, Number.NaN];
    };
    return {
      value: input instanceof HTMLTextAreaElement ? input.value : undefined,
      edges: [...edges(input), ...edges(other)],
    };
  }, row);
}

function expectUnmoved(after: number[], before: number[]) {
  after.forEach((edge, index) => expect(edge).toBeCloseTo(before[index] ?? Number.NaN, 1));
}

// jsdom has no layout: a preview that resizes the composer moves the suggestions out
// from under the pointer, which swaps the preview, so hovering never settles.
test.describe('New session suggestions', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ context, baseURL }) => {
    stubDraftRoute({ workItems: intake });
    await context.route(
      url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
      async route => {
        const { pathname, search } = new URL(route.request().url());
        const response = await fetch(`${TEST_BASE_URL}${pathname}${search}`, { method: route.request().method() });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        });
      },
    );
  });

  for (const [name, draft] of drafts) {
    test(`previews a suggestion over ${name} without moving anything under the pointer`, async ({ page }) => {
      await page.goto(`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`);
      const message = page.getByRole('textbox', { name: 'Message' });
      await expect(message).toBeEnabled();
      await message.fill(draft);
      const suggestion = page.getByRole('button', { name: /^Triage 7 cards in Intake/ });
      await expect(suggestion).toBeVisible();
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => undefined)),
        ),
      );
      const before = await snapshot(message, suggestion);

      await suggestion.hover();
      await expect(message).toHaveValue(/Intake card 0/);

      const previewing = await snapshot(message, suggestion);
      expect(previewing.value).toMatch(/Intake card 0/);
      expectUnmoved(previewing.edges, before.edges);

      await page.mouse.move(0, 0);
      await expect(message).toHaveValue(draft);

      expectUnmoved((await snapshot(message, suggestion)).edges, before.edges);
    });
  }
});
