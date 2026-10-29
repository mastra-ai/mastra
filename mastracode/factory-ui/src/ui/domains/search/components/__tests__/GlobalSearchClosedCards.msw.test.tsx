import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { builtinBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../../api/types';
import { stubSessionsFactory } from '../../../workspaces/components/__tests__/fixtures/sessionsSection';
import type { FactoryUserSession } from '../../../workspaces/services/user-sessions';
import { GlobalSearchDialog } from '../GlobalSearchDialog';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

const doneSession: FactoryUserSession = {
  id: 'row-issue-run',
  sessionId: 'issue-run',
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org',
  title: 'Fix flaky login',
  branch: 'factory/issue-42',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: '2026-09-04T10:00:00.000Z',
  createdAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
};

function closedCard(id: string, title: string, stage: string, externalId: string, sessions = {}) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: factoryId,
    board: 'work',
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId,
      url: `https://github.com/acme/app/issues/${externalId}`,
    },
    parentWorkItemId: null,
    title,
    stages: [stage],
    stageHistory: [],
    sessions,
    metadata: { number: Number(externalId) },
    revision: 1,
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  };
}

const doneCard = closedCard('item-done', 'Fix the login flow', 'done', '42', {
  work: { sessionId: 'issue-run', branch: 'factory/issue-42', threadId: 'thread-done', startedBy: 'user-1' },
});
const canceledCard = closedCard('item-canceled', 'Retire the legacy login page', 'canceled', '43');

const githubIssue = (number: number) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/acme/app/issues/${number}`,
  author: 'alice',
  labels: [],
  comments: 0,
  createdAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
});

let searches: string[];

beforeEach(() => {
  searches = [];
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json(builtinBoardCatalog satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [doneSession] }),
    ),
    // Both cards are closed, so the snapshot only summarizes them.
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({
        workItems: [],
        runningSessionIds: [],
        parkedSessionIds: [],
        excludedCards: [
          { board: 'work', stage: 'done', count: 1, sourceKeys: ['42'], recent: [] },
          {
            board: 'work',
            stage: 'canceled',
            count: 1,
            sourceKeys: ['43', 'github-issue:43', 'https://github.com/acme/app/issues/43'],
            recent: [],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['acme/app'] } } }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/issues`, ({ request }) =>
      HttpResponse.json({
        issues: new URL(request.url).searchParams.has('label') ? [] : [githubIssue(43), githubIssue(50)],
        nextPage: null,
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items/sessions`, async ({ request }) => {
      const { sessionIds } = (await request.json()) as { sessionIds: string[] };
      return HttpResponse.json({ workItems: sessionIds.includes('issue-run') ? [doneCard] : [] });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items/terminal/search`, ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';
      searches.push(q);
      const words = q.toLowerCase().split(/\s+/);
      const matches = [doneCard, canceledCard].filter(card =>
        words.every(word => card.title.toLowerCase().includes(word)),
      );
      return HttpResponse.json({ workItems: matches });
    }),
  );
});

function renderSearch() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <Routes>
        <Route path="/factories/:factoryId" element={<GlobalSearchDialog closeSearch={() => {}} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Global search over closed cards', () => {
  it('titles the session of a done card the board snapshot leaves out', async () => {
    renderSearch();

    expect(await screen.findByRole('option', { name: /Fix the login flow/ })).toBeInTheDocument();
  });

  it('finds a canceled card that never had a session by asking the server', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByPlaceholderText(/Search sessions/), 'legacy');

    expect(await screen.findByRole('option', { name: /Retire the legacy login page/ })).toBeInTheDocument();
    await waitFor(() => expect(searches).toEqual(['legacy']));
  });

  it('keeps hiding the Intake candidate of an issue whose card was canceled', async () => {
    renderSearch();

    expect(await screen.findByRole('option', { name: /Issue 50/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Issue 43/ })).not.toBeInTheDocument();
  });
});
