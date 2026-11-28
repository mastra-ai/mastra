// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import type { InstalledBoardInfo } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { BoardNavigation } from '../board/board-navigation';
import { BoardNavigationProvider } from '../board/board-navigation-provider';
import { BoardContent } from './board-content';
import type { BoardHost } from './board-content';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const FP = 'fp-1';
const API = `${TEST_BASE_URL}/web/factory/projects/${FP}`;

const definition: InstalledBoardInfo = {
  id: 'work',
  name: 'Work',
  title: 'Work',
  initialPhase: 'backlog',
  phases: [
    { id: 'backlog', name: 'Backlog', title: 'Backlog', kind: 'resting', nextPhases: ['build'] },
    { id: 'build', name: 'Build', title: 'Build', kind: 'working', nextPhases: [] },
  ],
};

const card = {
  id: 'w1',
  orgId: 'org',
  createdBy: 'u1',
  factoryProjectId: FP,
  externalSource: null,
  parentWorkItemId: null,
  title: 'Fix the login redirect',
  stages: ['backlog'],
  stageHistory: [],
  sessions: {},
  metadata: null,
  revision: 1,
  version: 'v1',
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
};

const host: BoardHost = {
  viewer: { userId: 'u1', name: 'Ada' },
  filterSources: { connectedSources: new Set() },
  intake: { fed: true, unrouted: false, isPending: false },
};

const navigation: BoardNavigation = {
  LinkComponent: 'a',
  navigate: () => {},
  cardHref: cardId => `/cards/${cardId}`,
  sessionHref: session => `/threads/${session.threadId}`,
  boardHref: boardId => `/boards/${boardId}`,
  boardCardHref: (boardId, cardId) => `/boards/${boardId}?item=${cardId}`,
  boardConfigHref: boardId => `/boards/${boardId}/config`,
  newIntakeRuleHref: boardId => `/boards/${boardId}/config?rule=new`,
  intakeSettingsHref: () => '/settings/intake',
  searchParams: new URLSearchParams(),
  replaceSearchParams: () => {},
};

function serveBoard() {
  server.use(
    http.get(`${API}/boards/work/phases`, () =>
      HttpResponse.json({
        phases: [
          { phase: 'backlog', total: 1, cards: [{ id: 'w1', version: 'v1' }] },
          { phase: 'build', total: 0, cards: [] },
        ],
        related: [],
        boardTotal: 1,
        matchingTotal: 1,
        workItems: [card],
      }),
    ),
    http.get(`${API}/boards`, () => HttpResponse.json({ boards: [definition] })),
    http.get(`${API}/intake-routes`, () => HttpResponse.json({ intakeRoutes: [], canEdit: true })),
    http.get(`${API}/decisions`, () => HttpResponse.json({ decisions: [] })),
    http.get(`${API}/run-queue`, () =>
      HttpResponse.json({
        slots: null,
        running: 0,
        claimed: [],
        queuedCount: 0,
        queuedByLane: { automated: 0, interactive: 0 },
        queued: [],
      }),
    ),
    http.get(`${API}/session-activity`, () =>
      HttpResponse.json({ runningSessionIds: [], parkedSessionIds: [], cardStatuses: {}, sessionHeldCardIds: [] }),
    ),
    http.get(`${API}/audit`, () => HttpResponse.json({ events: [], actors: {} })),
    http.get(`${API}/work-items/filter-options`, () => HttpResponse.json({ actorIds: [], people: [], labels: [] })),
  );
}

describe('BoardContent', () => {
  describe('when the host mounts a board with a card in its first phase', () => {
    it('shows each phase and the card under it', async () => {
      serveBoard();
      renderWithProviders(
        <BoardNavigationProvider value={navigation}>
          <BoardContent factoryProjectId={FP} kind="work" definition={definition} host={host} />
        </BoardNavigationProvider>,
      );

      expect(await screen.findByText('Fix the login redirect')).toBeTruthy();
      expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Build').length).toBeGreaterThan(0);
    });
  });
});
