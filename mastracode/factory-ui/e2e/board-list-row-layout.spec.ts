import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { largeBoard } from '../src/ui/__tests__/fixtures/largeBoard';
import { server } from './ui/msw-server';

const [base] = largeBoard(1);

function workItem(id: string, overrides: Record<string, unknown>) {
  return { ...base, id, stages: ['review'], ...overrides };
}

// A GitHub issue in Review: a linked PR, labels, an author avatar and a long self-review verdict all compete for
// the same row, which is where the verdict badge used to run over the avatar and the timestamp.
const githubIssue = (number: number, title: string, labels: string[]) =>
  workItem(`issue-${number}`, {
    title,
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: `github-issue:${number}`,
      url: `https://github.com/acme/app/issues/${number}`,
    },
    metadata: {
      number,
      author: 'octocat',
      labels,
      selfReviewVerdict: 'approve',
      selfReviewRounds: 1,
    },
  });

const pullRequest = (number: number, parentWorkItemId: string) =>
  workItem(`pr-${number}`, {
    board: 'review',
    title: `PR ${number}`,
    parentWorkItemId,
    externalSource: {
      integrationId: 'github',
      type: 'pull-request',
      externalId: `github-pr:${number}`,
      url: `https://github.com/acme/app/pull/${number}`,
    },
    metadata: { number },
  });

const workItems = [
  workItem('manual-1', {
    title: 'Move durable streams from DurableAgent into base Agent',
    commentCount: 1,
    metadata: { selfReviewVerdict: 'approve' },
  }),
  workItem('manual-2', {
    title: 'Manage incident banners from the Platform admin panel',
    commentCount: 1,
    metadata: { selfReviewVerdict: 'request changes', selfReviewRounds: 2 },
  }),
  githubIssue(
    28324,
    '[BUG] createEventedAgent on a Redis pubsub: observe(runId, { offset }) re-sends events from before the offset, so a reconnect sees them twice',
    [],
  ),
  githubIssue(
    28310,
    "[BUG] Durable agents: a thread abort sent to a server that didn't start the run does nothing; aborting by run id works",
    ['bug', 'Agents'],
  ),
  pullRequest(28325, 'issue-28324'),
  pullRequest(28311, 'issue-28310'),
];

test.describe('Factory board list row layout', () => {
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ page, baseURL }) => {
    server.use(
      http.get('*/auth/me', () => HttpResponse.json({ authenticated: true, authEnabled: false })),
      http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Factory' }] })),
      http.get('*/web/factory/projects/fp-1/source-control-connections', () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              installationId: 'inst-1',
              repositories: [
                {
                  id: 'repo-1',
                  branch: 'main',
                  sandboxWorkdir: '/repo',
                  repository: { slug: 'acme/app', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get('*/web/factory/projects/fp-1/work-items', () => HttpResponse.json({ workItems })),
      http.get('*/web/factory/projects/fp-1/sessions', () => HttpResponse.json({ sessions: [] })),
      http.get('*/web/github/projects/repo-1/issues', () => HttpResponse.json({ issues: [], nextPage: null })),
      http.get('*/web/github/projects/repo-1/prs', () => HttpResponse.json({ pullRequests: [], nextPage: null })),
      http.get('*/web/intake/config', () =>
        HttpResponse.json({
          config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
        }),
      ),
      http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
      http.get('*/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
      http.get('*/api/agent-controller/code/sessions/fp-1/permissions', () => HttpResponse.json({ permissions: [] })),
    );
    await page.route('https://github.com/**', route => route.abort());
    await page.route(
      url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
      async route => {
        const request = route.request();
        if (request.url().endsWith('/feed-events')) {
          await route.fulfill({ contentType: 'text/event-stream', body: '' });
          return;
        }
        const response = await fetch(request.url(), { method: request.method() });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        });
      },
    );
  });

  // Phones stack the row into two lines, so the column check only applies where cells share a line.
  for (const viewport of [
    { name: 'desktop', width: 1240 },
    { name: 'tablet', width: 820 },
  ]) {
    test.describe(`on ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: 1000 } });

      test('keeps the review verdict clear of the activity avatar and the timestamp', async ({ page }) => {
        await page.goto('/factories/fp-1/work');
        const rows = page.getByTestId('work-item-card');
        await expect(rows.filter({ hasText: 'createEventedAgent' })).toBeVisible();
        // The overlap check only measures text that renders, so make sure the verdicts under test are there.
        for (const title of ['createEventedAgent', 'thread abort']) {
          await expect(rows.filter({ hasText: title }).getByText('Self-review: approved (round 1)')).toBeAttached();
        }

        // Set LIST_ROW_SCREENSHOT to a directory to capture the rows for visual review.
        const screenshotDir = process.env.LIST_ROW_SCREENSHOT;
        if (screenshotDir) {
          await page.mouse.move(0, 0);
          const first = await rows.first().boundingBox();
          const last = await rows.last().boundingBox();
          if (first && last) {
            await page.screenshot({
              path: `${screenshotDir}/${viewport.name}.png`,
              clip: {
                x: first.x - 16,
                y: first.y - 56,
                width: first.width + 32,
                height: last.y + last.height - first.y + 64,
              },
            });
          }
        }

        // Every cell's visible content must stay inside its own grid track: overlap is what read as garbled text.
        // A node's visible box is its rect clipped by every ancestor (up to the row) that hides overflow.
        const overlaps = await rows.evaluateAll(elements =>
          elements.flatMap(row => {
            // Measure text, not elements: a squeezed badge keeps a tiny box while its text spills out of it.
            const visibleRight = (text: Text) => {
              const range = document.createRange();
              range.selectNodeContents(text);
              let right = range.getBoundingClientRect().right;
              for (let parent = text.parentElement; parent && parent !== row; parent = parent.parentElement) {
                if (getComputedStyle(parent).overflowX !== 'visible') {
                  right = Math.min(right, parent.getBoundingClientRect().right);
                }
              }
              return right;
            };
            const textNodes = (cell: Element) => {
              const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
              const nodes: Text[] = [];
              while (walker.nextNode()) {
                const node = walker.currentNode as Text;
                if (node.textContent?.trim() && node.parentElement?.checkVisibility()) nodes.push(node);
              }
              return nodes;
            };
            const cells = [...row.children];
            const content = cells.map(cell => Math.max(...textNodes(cell).map(visibleRight)));
            const tracks = cells.map(cell => cell.getBoundingClientRect());
            return content.flatMap((right, index) => {
              const next = tracks[index + 1];
              if (!Number.isFinite(right) || !next) return [];
              return right > next.left + 0.5
                ? [`${row.getAttribute('aria-label')}: cell ${index} ends at ${right}, next starts at ${next.left}`]
                : [];
            });
          }),
        );
        expect(overlaps).toEqual([]);
      });
    });
  }
});
