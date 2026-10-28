import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { workItem } from '../src/ui/__tests__/workBoardStubs';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from '../src/ui/pages/__tests__/fixtures/draftRoute';
import { server } from './ui/msw-server';
import { TEST_BASE_URL } from './ui/render';

const NEW_SESSION = `/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`;
const CREATED = '2026-10-01T00:00:00.000Z';

const intake = Array.from({ length: 7 }, (_, index) => ({
  ...workItem(`intake-${index}`, `Intake card ${index}`, CREATED, CREATED),
  stages: ['intake'],
}));

const fiveKinds = [
  ...intake,
  ...['leak', 'recall', 'threads'].map(id => ({
    ...workItem(`area-${id}`, `Area card ${id}`, CREATED, CREATED),
    triageType: 'feature request',
    metadata: { labels: ['Observability, tracing and evaluation scorers'] },
  })),
  { ...workItem('bug', 'Crash on save', CREATED, CREATED), triageType: 'bug' },
  { ...workItem('stuck', 'Stuck card', CREATED, CREATED), stages: ['execute'] },
];

const failedRun = {
  id: 'decision-stuck',
  evaluationId: 'evaluation-1',
  workItemId: 'stuck',
  type: 'startSession',
  role: 'work',
  source: null,
  status: 'failed',
  attempts: 3,
  failureOccurrence: 1,
  failureCode: null,
  canRetry: true,
  lastError: 'Sandbox quota exceeded',
  createdAt: CREATED,
  updatedAt: CREATED,
  completedAt: CREATED,
};

const drafts = [
  ['an empty composer', ''],
  ['a draft taller than the empty composer', Array.from({ length: 8 }, (_, line) => `my idea ${line}`).join('\n')],
];

function settle(page: Page) {
  return page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)),
    ),
  );
}

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

function cardLayout(list: Locator) {
  return list.evaluate(element => {
    const listBox = element.getBoundingClientRect();
    const rows = new Map<number, DOMRect[]>();
    const textOnArt: string[] = [];
    for (const item of element.children) {
      const box = item.getBoundingClientRect();
      rows.set(Math.round(box.top), [...(rows.get(Math.round(box.top)) ?? []), box]);
      const art = item.querySelector(':scope > svg');
      if (!art?.checkVisibility()) continue;
      const artBox = art.getBoundingClientRect();
      const texts = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      for (let text = texts.nextNode(); text; text = texts.nextNode()) {
        const parent = text.parentElement;
        if (!parent) continue;
        const outer = parent.getBoundingClientRect();
        const padding = getComputedStyle(parent);
        const clip = {
          left: outer.left + parseFloat(padding.paddingLeft),
          right: outer.right - parseFloat(padding.paddingRight),
          top: outer.top + parseFloat(padding.paddingTop),
          bottom: outer.bottom - parseFloat(padding.paddingBottom),
        };
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const glyphs of range.getClientRects()) {
          const left = Math.max(glyphs.left, clip.left, artBox.left);
          const right = Math.min(glyphs.right, clip.right, artBox.right);
          const top = Math.max(glyphs.top, clip.top, artBox.top);
          const bottom = Math.min(glyphs.bottom, clip.bottom, artBox.bottom);
          if (right > left && bottom > top) textOnArt.push(text.textContent ?? '');
        }
      }
    }
    return {
      rows: [...rows.values()].map(row => row.length),
      spanned: [...rows.values()].every(
        row =>
          Math.abs((row[0]?.left ?? Number.NaN) - listBox.left) < 1 &&
          Math.abs((row.at(-1)?.right ?? Number.NaN) - listBox.right) < 1,
      ),
      textOnArt,
    };
  });
}

// jsdom has no layout, so it cannot catch a preview that moves the suggestions out from under the pointer.
test.describe('New session page', () => {
  test.use({ timezoneId: 'UTC', locale: 'en-US' });
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
      await page.goto(NEW_SESSION);
      const message = page.getByRole('textbox', { name: 'Message' });
      await expect(message).toBeEnabled();
      await message.fill(draft);
      const suggestion = page.getByRole('button', { name: 'Triage the 5 newest' });
      await expect(suggestion).toBeVisible();
      await settle(page);
      const before = await snapshot(message, suggestion);

      await suggestion.hover();
      await expect(message).not.toHaveValue(draft);

      const previewing = await snapshot(message, suggestion);
      expect(previewing.value).not.toBe(draft);
      expectUnmoved(previewing.edges, before.edges);

      await page.mouse.move(0, 0);
      await expect(message).toHaveValue(draft);

      expectUnmoved((await snapshot(message, suggestion)).edges, before.edges);
    });
  }

  test('lays five cards out three over two, two by two on a phone, with no text drawn over the art', async ({
    page,
  }) => {
    stubDraftRoute({ workItems: fiveKinds });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
        HttpResponse.json({ decisions: [failedRun] }),
      ),
    );
    await page.clock.setFixedTime(new Date('2026-10-27T12:00:00Z'));
    await page.goto(NEW_SESSION);
    const list = page.getByRole('list', { name: 'Start from the board' });
    await expect(list.getByRole('listitem')).toHaveCount(5);
    await settle(page);

    expect(await cardLayout(list)).toEqual({ rows: [3, 2], spanned: true, textOnArt: [] });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await cardLayout(list)).toEqual({ rows: [2, 2, 1], spanned: true, textOnArt: [] });
  });

  test('expands the week into one bar per busy slot and names the slot under the pointer, its card kept inside the band', async ({
    page,
  }) => {
    const shownSlots = 43;
    const busySlot = 23;
    const arrived = '2026-10-24T09:00:00.000Z';
    stubDraftRoute({
      workItems: [
        ...intake,
        ...['a', 'b'].map(id => ({ ...workItem(`new-${id}`, `New card ${id}`, arrived, arrived), stages: ['intake'] })),
      ],
    });
    await page.clock.setFixedTime(new Date('2026-10-27T12:00:00Z'));
    await page.goto(NEW_SESSION);
    const band = page.getByRole('region', { name: 'This week' });
    const toggle = band.getByRole('button', { name: /shipped/ });
    await expect(toggle).toHaveAccessibleName(/^2 came in/);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const field = band.getByRole('img').locator('svg');
    await expect(field).toBeVisible();
    await settle(page);
    const fieldBox = await field.boundingBox();
    const bandBox = await band.boundingBox();
    if (!fieldBox || !bandBox) throw new Error('The chart did not lay out');

    const barStarts = await field.evaluate(svg => {
      const box = svg.getBoundingClientRect();
      const starts: number[] = [];
      let lit = false;
      for (let x = Math.ceil(box.left); x < box.right; x += 1) {
        const hit = Boolean(document.elementFromPoint(x, box.bottom - 3)?.closest('[clip-path]'));
        if (hit && !lit) starts.push(x);
        lit = hit;
      }
      return starts;
    });
    expect(barStarts).toHaveLength(1);
    expect(barStarts[0]).toBeGreaterThanOrEqual(fieldBox.x + (fieldBox.width * busySlot) / shownSlots);
    expect(barStarts[0]).toBeLessThan(fieldBox.x + (fieldBox.width * (busySlot + 1)) / shownSlots);

    for (const [slot, day, hours] of [
      [0, 'Tue, Oct 20', '12 PM – 4 PM'],
      [2, 'Tue, Oct 20', '8 PM – 12 AM'],
      [busySlot, 'Sat, Oct 24', '8 AM – 12 PM'],
      [42, 'Tue, Oct 27', '12 PM – 4 PM'],
    ] as const) {
      await page.mouse.move(
        fieldBox.x + (fieldBox.width * (slot + 0.5)) / shownSlots,
        fieldBox.y + fieldBox.height / 2,
      );
      const card = page.getByText(day, { exact: true }).locator('xpath=../..');
      await expect(card).toContainText(hours);
      await settle(page);
      const cardBox = await card.boundingBox();
      expect(cardBox?.x).toBeGreaterThanOrEqual(bandBox.x);
      expect((cardBox?.x ?? 0) + (cardBox?.width ?? 0)).toBeLessThanOrEqual(bandBox.x + bandBox.width);
    }
  });
});
