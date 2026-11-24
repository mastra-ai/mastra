import { delay, http, HttpResponse } from 'msw';

import { TEST_BASE_URL } from './render';

/**
 * A project whose board never finishes loading: only a list read scoped to
 * `sessionId` answers, with that session's cards. A page that shows them did
 * not wait for the board.
 */
export function sessionCardsWhileBoardLoads(factoryProjectId: string, sessionId: string, cards: readonly unknown[]) {
  return http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, async ({ request }) => {
    const sessionIds = new URL(request.url).searchParams.getAll('sessionId');
    if (sessionIds.length === 0) await delay('infinite');
    return HttpResponse.json({ workItems: sessionIds.includes(sessionId) ? cards : [] });
  });
}
