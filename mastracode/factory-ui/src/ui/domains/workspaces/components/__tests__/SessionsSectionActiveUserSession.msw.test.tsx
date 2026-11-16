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
  session('slack-run', 'Answer deploy question', 'slack/1700-42'),
  session('user-chat', 'Plan the migration', 'user/plan'),
];

beforeEach(() => {
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json(builtinBoardCatalog satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
  );
});

function renderSectionAt(path: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <ChatSessionContext.Provider value={testChatSession(factoryId, projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId" element={<SessionsSection />} />
          <Route path="/factories/:factoryId/user/threads/:threadId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Sessions sidebar open user session', () => {
  it('highlights a Slack session opened through its workspace link', async () => {
    renderSectionAt(`/factories/${factoryId}/workspaces/slack-run/threads/slack-run`);

    expect(await screen.findByRole('link', { name: 'Answer deploy question' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Plan the migration' })).not.toHaveAttribute('aria-current');
  });

  it('highlights a user session opened through its user thread link', async () => {
    renderSectionAt(`/factories/${factoryId}/user/threads/user-chat`);

    expect(await screen.findByRole('link', { name: 'Plan the migration' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Answer deploy question' })).not.toHaveAttribute('aria-current');
  });
});
