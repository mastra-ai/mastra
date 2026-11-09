import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { workBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../../api/types';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { WorkItem, WorkItemSessionRef } from '../../../factory/services/workItems';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

type WireWorkItem = Omit<WorkItem, 'githubProjectId' | 'source' | 'sourceKey' | 'url'> & {
  factoryProjectId: string;
  externalSource: null;
};

function session(sessionId: string, title: string, branch: string): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title,
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: '2026-09-04T10:00:00.000Z',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  };
}

const triageSession = session('triage-session', 'Triage fix login', 'factory/issue-1-triage');
const workSession = session('work-session', 'Build fix login', 'factory/issue-1');
const docsSession = session('docs-session', 'Write docs', 'factory/issue-2');
const userSession = session('user-session', 'Scratch notes', 'user/scratch');

const ref = (value: FactoryUserSession): WorkItemSessionRef => ({
  sessionId: value.sessionId,
  branch: value.branch,
  threadId: `${value.sessionId}-thread`,
  startedBy: 'user-1',
});

function card(id: string, title: string, sessions: WorkItem['sessions']): WireWorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: factoryId,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['execute'],
    stageHistory: [],
    sessions,
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    revision: 1,
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  };
}

beforeEach(() => {
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json(workBoardCatalog satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [triageSession, workSession, docsSession, userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          card('fix-login', 'Fix login', { triage: ref(triageSession), work: ref(workSession) }),
          card('write-docs', 'Write docs card', { work: ref(docsSession) }),
        ],
      }),
    ),
  );
});

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <ChatSessionContext.Provider value={testChatSession(factoryId, projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

const visibleRowLabels = (list: HTMLElement) =>
  within(list)
    .getAllByRole('link')
    .map(link => link.textContent);

describe("Sessions sidebar nests a card's sessions by context", () => {
  it('lists a card with two sessions under one heading, each named by its context', async () => {
    renderSection();

    const cardList = await screen.findByRole('list', { name: 'Fix login' });
    expect(screen.getByText('Fix login', { selector: 'span' })).toBeInTheDocument();
    expect(visibleRowLabels(cardList).toSorted()).toEqual(['Triage', 'Work']);
    expect(within(cardList).getByRole('link', { name: 'Triage: Triage fix login' })).toHaveTextContent('Triage');
  });

  it('still gives a card with one session its heading and a context row', async () => {
    renderSection();

    const cardList = await screen.findByRole('list', { name: 'Write docs card' });
    expect(visibleRowLabels(cardList)).toEqual(['Work']);
  });

  it('keeps a plain user session as a flat row', async () => {
    renderSection();

    const row = await screen.findByRole('link', { name: 'Scratch notes' });
    expect(row).toHaveTextContent('Scratch notes');
    expect(screen.queryByRole('list', { name: 'Scratch notes' })).not.toBeInTheDocument();
  });
});
