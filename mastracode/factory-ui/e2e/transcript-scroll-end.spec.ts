import type { MastraDBMessage } from '@mastra/client-js';
import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { server } from './ui/msw-server';

const FACTORY_ID = 'fp-scroll';
const REPOSITORY_ID = 'repo-scroll';
const SESSION_ID = 'session-scroll';
const createdAt = '2026-10-28T09:00:00.000Z';

const session = {
  id: 'session-row',
  sessionId: SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/scroll',
  baseBranch: 'main',
  sandboxId: 'sandbox-1',
  sandboxWorkdir: '/workspace/acme',
  materializedAt: createdAt,
  createdAt,
  updatedAt: createdAt,
};

const text = (id: string, role: 'user' | 'assistant', value: string): MastraDBMessage => ({
  id,
  role,
  createdAt: new Date(createdAt),
  content: { format: 2, parts: [{ type: 'text', text: value }] },
});

const toolStep = (id: string, toolCallId: string, path: string): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(createdAt),
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId, toolName: 'view', args: { path }, result: 'ok' },
      },
    ],
  },
});

const earlierTurns = Array.from({ length: 8 }, (_, turn) => [
  text(`user-${turn}`, 'user', `Question ${turn}`),
  text(`assistant-${turn}`, 'assistant', `Answer ${turn}. ${'Long explanation. '.repeat(40)}`),
]).flat();

const messages = [
  ...earlierTurns,
  text('user-last', 'user', 'Read the config files'),
  toolStep('assistant-step-1', 'call-1', 'config/a.ts'),
  toolStep('assistant-step-2', 'call-2', 'config/b.ts'),
];

test.describe('Factory transcript', () => {
  test.beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());

  test.beforeEach(async ({ context, baseURL }) => {
    server.use(
      http.get(`*/web/factory/projects/${FACTORY_ID}`, () =>
        HttpResponse.json({
          project: { id: FACTORY_ID, name: 'Acme Factory', modelScope: 'factory', defaultModelId: null },
        }),
      ),
      http.get('*/web/config/default-model', () => HttpResponse.json({ modelId: null, thinkingLevel: null })),
      http.get('*/auth/me', () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get('*/web/factory/projects', () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
      ),
      http.get(`*/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'connection-1',
              installationId: 'installation-1',
              repositories: [
                {
                  id: REPOSITORY_ID,
                  branch: 'main',
                  sandboxWorkdir: '/workspace/acme',
                  repository: { slug: 'acme/app', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get(`*/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems: [] })),
      http.get(`*/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [session] })),
      http.get('*/web/github/subscriptions', () => HttpResponse.json({ subscriptions: [] })),
      http.get(`*/web/user-sessions/${SESSION_ID}`, () => HttpResponse.json({ session })),
      http.post('*/api/agent-controller/code/sessions', () =>
        HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID }),
      ),
      http.get('*/api/agent-controller/code/sessions/:resourceId', () =>
        HttpResponse.json({
          controllerId: 'code',
          resourceId: SESSION_ID,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: SESSION_ID,
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
      http.put('*/api/agent-controller/code/sessions/:resourceId/state', () => HttpResponse.json({ ok: true })),
      http.get('*/api/agent-controller/code/sessions/:resourceId/permissions', () => HttpResponse.json({})),
      http.get('*/api/agent-controller/code/sessions/:resourceId/threads', () =>
        HttpResponse.json({ threads: [{ id: SESSION_ID, title: 'Factory thread' }] }),
      ),
      http.get('*/api/agent-controller/code/sessions/:resourceId/threads/:threadId/messages', () =>
        HttpResponse.json({ messages }),
      ),
      http.get('*/web/workspace/rendered/list', () =>
        HttpResponse.json({ workspacePath: `/workspace/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
      ),
    );
    await context.route(
      url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
      async route => {
        const request = route.request();
        if (/\/(feed-events|stream)$/.test(new URL(request.url()).pathname)) {
          await route.fulfill({ contentType: 'text/event-stream', body: '' });
          return;
        }
        const response = await fetch(request.url(), { method: request.method(), body: request.postData() });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        });
      },
    );
  });

  test('a reader who scrolled back up returns to the end of a turn whose last step folded into its activity line', async ({
    page,
  }) => {
    await page.goto(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`);
    await expect(page.getByText('Read the config files')).toBeVisible();

    const viewport = page.locator('[data-slot="message-scroller-viewport"]');
    await viewport.evaluate(element => element.scrollTo({ top: 0 }));

    const scrollToEnd = page.getByRole('button', { name: 'Jump to latest message' });
    await expect(scrollToEnd).toHaveAttribute('data-active', 'true');
    await scrollToEnd.click();

    await expect(page.getByText('Read files')).toBeInViewport({ ratio: 1 });
    await expect(scrollToEnd).toHaveAttribute('data-active', 'false');
  });
});
