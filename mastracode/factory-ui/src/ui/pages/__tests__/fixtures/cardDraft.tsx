import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_API, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { createQueryClient } from '../../../../query-client';
import { providerFactsCard } from '../../../__tests__/fixtures/providerFactsCard';
import { createAppRouter } from '../../../router';
import { DRAFT_SESSION_ID, FACTORY_ID } from './draftRoute';

export const CARD_ID = 'card-eng-42';
export const THREAD_PATH = `/factories/${FACTORY_ID}/workspaces/${DRAFT_SESSION_ID}/threads/${DRAFT_SESSION_ID}`;
export const linearCard = {
  ...providerFactsCard,
  id: CARD_ID,
  factoryProjectId: FACTORY_ID,
  title: 'ENG-42: Repair source facts',
  stages: ['triage'],
  sessions: {},
  externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' },
  metadata: { repository: 'acme/app', authorTrusted: true },
  workItem: {
    ...providerFactsCard.workItem,
    provider: 'linear',
    key: 'ENG-42',
    title: 'ENG-42: Repair source facts',
    metadata: {},
  },
};
export const CARD_IN_CHAT = {
  ...linearCard,
  sessions: {
    chat: {
      sessionId: DRAFT_SESSION_ID,
      branch: 'factory/linear-eng-42',
      threadId: DRAFT_SESSION_ID,
      startedBy: 'user-1',
    },
  },
};
export const CARD_IN_TRIAGE = {
  ...linearCard,
  sessions: { triage: { sessionId: DRAFT_SESSION_ID, threadId: DRAFT_SESSION_ID, branch: 'factory/linear-eng-42' } },
};

export function stubCard(metadata: Record<string, string | boolean> = linearCard.metadata) {
  const runStarts: unknown[] = [];
  let bound = false;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [{ ...(bound ? CARD_IN_CHAT : linearCard), metadata }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/session-repository`, () =>
      HttpResponse.json({ status: 'resolved', projectRepositoryId: 'repository-draft-handoff', slug: 'acme/app' }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      runStarts.push(await request.json());
      bound = true;
      return HttpResponse.json({
        prepared: {
          workItemId: CARD_ID,
          threadId: DRAFT_SESSION_ID,
          sessionId: DRAFT_SESSION_ID,
          kickoffStatus: 'sent',
        },
      });
    }),
  );
  return runStarts;
}

export function renderAt(path: string) {
  const queryClient = createQueryClient();
  const router = createAppRouter({ queryClient, api: TEST_API }, routes =>
    createMemoryRouter(routes, { initialEntries: [path] }),
  );
  return { router, ...renderWithProviders(<RouterProvider router={router} />, queryClient) };
}

export function stubPageWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, width, 800));
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

export function stubTransitions() {
  const transitions: unknown[] = [];
  server.use(
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`,
      async ({ params, request }) => {
        transitions.push(await request.json());
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: String(params.itemId),
            revision: 9,
            stage: 'triage',
            decisions: [],
          },
        });
      },
    ),
  );
  return transitions;
}

export function stubThreadReads(held: () => Promise<void> | undefined = () => undefined) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, async () => {
      await held();
      return HttpResponse.json({ subscriptions: [] });
    }),
    http.get(`${TEST_BASE_URL}/web/linear/issues/:identifier`, () => HttpResponse.json({ description: null })),
    http.get(`${TEST_BASE_URL}/web/workspace/changes`, ({ request }) =>
      HttpResponse.json({
        workspacePath: new URL(request.url).searchParams.get('workspacePath'),
        available: true,
        additions: 0,
        deletions: 0,
        changes: [],
      }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
}
