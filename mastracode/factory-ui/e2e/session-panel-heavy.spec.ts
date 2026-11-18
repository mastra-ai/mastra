import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { DOCK_MIN_REM } from '../src/ui/domains/workspace-viewer/layout';
import { HEAVY, heavySessionHandlers } from './ui/heavy-session';
import { server } from './ui/msw-server';

const CHANGES = /^Changes(,|$)/;

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not on screen');
  return box;
}

async function openPanel(
  page: Page,
  path = `/factories/${HEAVY.factoryId}/workspaces/${HEAVY.sessionId}/threads/${HEAVY.threadId}`,
) {
  await page.goto(path);
  const toggle = page.getByRole('button', { name: 'Session panel' });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const panel = page.getByTestId('workspace-files-card');
  await expect(panel.getByRole('region', { name: 'Card', exact: true })).toBeVisible();
  return panel;
}

function transitionsEnd(page: Page) {
  return page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(glide => glide instanceof CSSTransition)
        .map(glide => glide.finished.catch(() => undefined)),
    ),
  );
}

function relayToFixture(context: BrowserContext, baseURL: string | undefined) {
  return context.route(
    url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
    async route => {
      const request = route.request();
      const response = await fetch(request.url(), { method: request.method() });
      // The fixture's streams never end; left pending, they stay open and idle as in the app.
      if (response.headers.get('content-type')?.startsWith('text/event-stream')) return response.body?.cancel();
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    },
  );
}

test.describe('Session panel with a heavy session', () => {
  test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ context, baseURL }) => {
    server.use(...heavySessionHandlers);
    await relayToFixture(context, baseURL);
  });

  test('keeps the title on one line and the conversation still across every view, clear of the session actions', async ({
    page,
  }, testInfo) => {
    const panel = await openPanel(page);
    const title = panel.getByRole('heading', { level: 2 });
    const conversation = page.getByRole('region', { name: 'Thread composer' });
    const before = { title: await boxOf(title), conversation: await boxOf(conversation) };
    const actions = await boxOf(page.getByRole('button', { name: 'Session panel' }));
    const lineHeight = await title.evaluate(heading => parseFloat(getComputedStyle(heading).lineHeight));
    expect(before.title.x + before.title.width).toBeLessThanOrEqual(actions.x);
    expect(before.title.height).toBeLessThanOrEqual(lineHeight);
    await panel.screenshot({ path: testInfo.outputPath('overview.png') });

    await panel.getByRole('button', { name: CHANGES }).click();
    for (const view of ['Changes', 'Files'] as const) {
      await panel.getByRole('tab', { name: view }).click();
      if (view === 'Changes')
        await expect(panel.getByRole('button', { name: /^Renamed .*agent-runner\.ts/ })).toBeVisible();
      if (view === 'Files') await expect(panel.getByRole('tree')).toBeVisible();
      const { y, height } = await boxOf(title);
      expect({ y, height }).toEqual({ y: before.title.y, height: before.title.height });
      expect(await boxOf(conversation)).toEqual(before.conversation);
      await page.screenshot({ path: testInfo.outputPath(`${view.toLowerCase()}.png`) });
    }
    await panel.getByRole('button', { name: 'Back to overview' }).click();

    const more = panel.getByRole('button', { name: 'Show more' });
    const preview = panel.locator(`[id="${await more.getAttribute('aria-controls')}"]`);
    const collapsed = await boxOf(preview);
    await more.click();
    await expect(panel.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    await transitionsEnd(page);
    expect((await boxOf(preview)).height).toBeGreaterThan(collapsed.height * 2);
    await panel.screenshot({ path: testInfo.outputPath('overview-expanded.png') });
  });

  test('narrows the panel, never the conversation, while the window narrows after the panel moved', async ({
    page,
  }) => {
    const panel = await openPanel(page);
    const toggle = page.getByRole('button', { name: 'Session panel' });
    await toggle.click();
    await transitionsEnd(page);
    const conversationWidth = (await boxOf(page.locator('[data-slot="chat-shell-column"]').first())).width;
    await toggle.click();
    await transitionsEnd(page);
    const cardWidth = (await boxOf(panel)).width;

    const frames = page.evaluate(
      () =>
        new Promise<(number | undefined)[]>(resolve => {
          const widths: (number | undefined)[] = [];
          const sample = () => {
            widths.push(document.querySelector('[data-slot="chat-shell-column"]')?.getBoundingClientRect().width);
            if (document.documentElement.dataset.drag === 'done') resolve(widths);
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }),
    );
    for (let width = 1600; width >= 1360; width -= 8) await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => {
      document.documentElement.dataset.drag = 'done';
    });

    expect(new Set(await frames)).toEqual(new Set([conversationWidth]));
    expect((await boxOf(panel)).width).toBeLessThan(cardWidth);
    await expect(panel).not.toHaveAttribute('inert');
  });

  test('unfolds the panel as smoothly when collapsing the sidebar makes room for it as when clicked open', async ({
    page,
  }) => {
    await openPanel(page);
    const toggle = page.getByRole('button', { name: 'Session panel' });
    const chatWidth = (await boxOf(page.locator('[data-slot="chat-page-header"]').locator('..'))).width;
    await page.setViewportSize({ width: Math.floor(1600 - chatWidth + DOCK_MIN_REM * 16) - 40, height: 1000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('workspace-files-card')).toHaveAttribute('inert');
    await transitionsEnd(page);

    const widths = page.evaluate(
      () =>
        new Promise<number[]>(resolve => {
          const widths: number[] = [];
          const sample = () => {
            const card = document.querySelector<HTMLElement>('[data-testid="workspace-files-card"]');
            const width = card?.parentElement?.getBoundingClientRect().width;
            if (width) widths.push(width);
            if (!card?.inert && widths.length > 10 && widths.slice(-10).every(seen => seen === width)) resolve(widths);
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }),
    );
    await page.getByRole('separator', { name: /^Resize sidebar/ }).focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    const unfold = await widths;
    const travel = Math.max(...unfold) - Math.min(...unfold);
    const steps = unfold.slice(1).map((width, frame) => Math.abs(width - (unfold[frame] ?? width)));
    expect(Math.max(...steps)).toBeLessThan(travel / 2);
  });

  test('keeps the conversation as wide beside the panel under classic scrollbars', async ({ playwright, baseURL }) => {
    const browser = await playwright.chromium.launch({
      ignoreDefaultArgs: ['--hide-scrollbars'],
      args: ['--disable-features=OverlayScrollbar'],
    });
    try {
      const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
      await relayToFixture(context, baseURL);
      const page = await context.newPage();
      await openPanel(page);
      const viewport = page.locator('[data-slot="message-scroller-viewport"]').first();
      expect(await viewport.evaluate(scroller => scroller.offsetWidth - scroller.clientWidth)).toBeGreaterThan(0);
      const column = page.locator('[data-slot="chat-shell-column"]').first();
      const toggle = page.getByRole('button', { name: 'Session panel' });
      await toggle.click();
      await transitionsEnd(page);
      const closedWidth = (await boxOf(column)).width;

      await toggle.click();
      await transitionsEnd(page);

      await expect(page.getByTestId('workspace-files-card')).not.toHaveAttribute('inert');
      expect((await boxOf(column)).width).toBe(closedWidth);
    } finally {
      await browser.close();
    }
  });

  test('finds a file among twelve hundred across checkouts and opens it where the tree keeps it', async ({
    page,
  }, testInfo) => {
    const panel = await openPanel(page);
    await panel.getByRole('button', { name: CHANGES }).click();
    await panel.getByRole('tab', { name: 'Files' }).click();
    const finder = panel.getByRole('combobox', { name: 'Go to file' });

    await finder.fill('core agent run');
    const results = panel.getByRole('listbox', { name: 'Files found' });
    await expect(results.getByRole('option').first()).toHaveAccessibleName(/agent-runner\.ts/);
    await page.screenshot({ path: testInfo.outputPath('finder.png') });

    await finder.press('Enter');
    await expect(panel.getByRole('region', { name: 'Workspace file viewer' })).toContainText('export function step0');
    await page.screenshot({ path: testInfo.outputPath('file.png') });

    await panel.getByRole('button', { name: 'Back to files' }).click();
    await finder.press('Escape');
    await expect(panel.getByRole('treeitem', { name: /agent-runner\.ts/, selected: true })).toBeVisible();
  });

  test("keeps a card draft's setup screen clear of the panel, whatever the panel's width", async ({
    page,
  }, testInfo) => {
    server.use(
      http.get('*/web/factory/projects/:factoryId/work-items/:workItemId/session-repository', () =>
        HttpResponse.json({ status: 'resolved', projectRepositoryId: HEAVY.repositoryId, slug: 'mastra-ai/mastra' }),
      ),
    );
    const panel = await openPanel(page, `/factories/${HEAVY.factoryId}/cards/card-c2`);
    await expect(page.getByRole('heading', { name: 'No model available' })).toBeVisible();
    const setup = page.getByText('Chats in this Factory run on your own keys');
    const panelWidths: number[] = [];

    for (const width of [1600, 1400]) {
      await page.setViewportSize({ width, height: 1000 });
      await transitionsEnd(page);
      const text = await boxOf(setup);
      const panelBox = await boxOf(panel);
      expect(text.x + text.width).toBeLessThan(panelBox.x);
      panelWidths.push(panelBox.width);
      await page.screenshot({ path: testInfo.outputPath(`card-draft-setup-${width}.png`) });
    }
    expect(panelWidths[1]).toBeLessThan(panelWidths[0] ?? 0);
  });
});
