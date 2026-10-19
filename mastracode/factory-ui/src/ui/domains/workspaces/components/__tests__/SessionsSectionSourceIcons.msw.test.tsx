import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { builtinBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../../api/types';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

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

const sessions = [
  session('user-chat', 'Plan the migration', 'user/plan'),
  session('issue-run', 'Fix flaky login', 'factory/issue-3'),
  session('linear-run', 'Add audit log', 'factory/issue-4'),
  session('pr-review', 'Review PR 12', 'factory/pr-12'),
  session('slack-run', 'Answer deploy question', 'slack/1700-42'),
];

function workItem(id: string, sessionId: string, branch: string, externalSource: Record<string, string>) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: factoryId,
    board: 'work',
    externalSource,
    parentWorkItemId: null,
    title: id,
    stages: ['intake'],
    stageHistory: [],
    sessions: { work: { sessionId, branch, threadId: sessionId, startedBy: 'user-1' } },
    metadata: {},
    revision: 1,
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  };
}

beforeEach(() => {
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json(builtinBoardCatalog satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          workItem('issue-item', 'issue-run', 'factory/issue-3', {
            integrationId: 'github',
            type: 'issue',
            externalId: '3',
          }),
          workItem('linear-item', 'linear-run', 'factory/issue-4', {
            integrationId: 'linear',
            type: 'issue',
            externalId: 'ENG-4',
          }),
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

const iconFor = async (name: string) =>
  (await screen.findByRole('button', { name })).querySelector('[data-source]')?.getAttribute('data-source');

describe('Sessions sidebar source icons', () => {
  it('marks each session with where it came from', async () => {
    renderSection();

    expect(await iconFor('Plan the migration')).toBe('user');
    expect(await iconFor('Fix flaky login')).toBe('github-issue');
    expect(await iconFor('Add audit log')).toBe('linear-issue');
    expect(await iconFor('Review PR 12')).toBe('github-pr');
    expect(await iconFor('Answer deploy question')).toBe('slack-thread');
  });
});
