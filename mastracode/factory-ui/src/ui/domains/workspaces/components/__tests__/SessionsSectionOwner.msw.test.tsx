import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { pickSessionProperty, sessionPropertiesTrigger } from './fixtures/sessionProperties';

const projectRepositoryId = 'ghp-1';
const viewerUserId = 'user-me';

function session(index: number, userId: string, branch: string): FactoryUserSession {
  const createdAt = `2026-07-23T00:00:${String(index).padStart(2, '0')}.000Z`;
  return {
    id: `row-${index}`,
    sessionId: `sess-${index}`,
    projectRepositoryId,
    orgId: 'org-1',
    userId,
    owner: { id: userId, name: userId },
    visibility: 'org',
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

const reviewSession = (index: number, userId: string) => session(index, userId, `factory/pr-${20000 + index}`);
const workSession = (index: number, userId: string) => session(index, userId, `factory/issue-${20000 + index}`);
const userSession = (index: number, userId: string) => session(index, userId, `user/task-${20000 + index}`);

function stubSessions(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ workItems: [] })),
  );
}

function renderSection(defaultState: 'default' | 'collapsed' = 'default') {
  stubSessionsFactory('fp-1', [projectRepositoryId]);
  return renderWithProviders(
    <Sidebar.Provider defaultState={defaultState} collapsedWidth={0} storageKey="owner-scope-test">
      <MemoryRouter initialEntries={['/factories/fp-1']}>
        <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
          <Routes>
            <Route path="/factories/:factoryId" element={<SessionsSection />} />
          </Routes>
        </ChatSessionContext.Provider>
      </MemoryRouter>
    </Sidebar.Provider>,
  );
}

describe('Sessions sidebar owner filter', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
    window.__MASTRACODE_CONFIG__ = { authEnabled: true };
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authEnabled: true,
          authenticated: true,
          user: { userId: viewerUserId, name: 'Romain', email: 'romain@example.com' },
        }),
      ),
    );
  });

  afterEach(() => {
    delete window.__MASTRACODE_CONFIG__;
  });

  const mixedSessions = () => [
    workSession(1, viewerUserId),
    userSession(2, viewerUserId),
    workSession(3, 'user-grace'),
    reviewSession(4, 'user-grace'),
    userSession(5, 'user-grace'),
  ];

  it("starts on the viewer's own sessions across factory and user rows", async () => {
    stubSessions(mixedSessions());

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);

    const work = await screen.findByRole('region', { name: 'Work sessions' });
    const userGroup = await screen.findByRole('region', { name: 'User sessions' });
    expect(await within(work).findByRole('link', { name: 'factory/issue-20001' })).toBeInTheDocument();
    expect(within(userGroup).getByRole('link', { name: 'task-20002' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'factory/issue-20003' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'task-20005' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Review sessions' })).not.toBeInTheDocument();
    expect(sessionPropertiesTrigger()).toBeInTheDocument();
  });

  it('says so when the viewer owns none of the sessions', async () => {
    stubSessions([workSession(3, 'user-grace'), reviewSession(4, 'user-grace'), userSession(5, 'user-grace')]);

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);

    expect(await screen.findByRole('status')).toHaveTextContent('No sessions of your own.');
    expect(screen.queryByRole('region', { name: /sessions$/ })).not.toBeInTheDocument();
  });

  it('widens every group to all owners', async () => {
    stubSessions(mixedSessions());
    const user = userEvent.setup();

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);
    await screen.findByRole('link', { name: 'factory/issue-20001' });

    await pickSessionProperty(user, 'Owner', 'All owners');

    const work = await screen.findByRole('region', { name: 'Work sessions' });
    const review = await screen.findByRole('region', { name: 'Review sessions' });
    const userGroup = screen.getByRole('region', { name: 'User sessions' });
    expect(within(work).getByRole('link', { name: 'factory/issue-20003' })).toBeInTheDocument();
    expect(within(review).getByRole('link', { name: 'factory/pr-20004' })).toBeInTheDocument();
    expect(within(userGroup).getByRole('link', { name: 'task-20005' })).toBeInTheDocument();
    expect(sessionPropertiesTrigger(1)).toBeInTheDocument();
  });

  it('keeps the Properties menu reachable when the sidebar is collapsed', async () => {
    stubSessions(mixedSessions());
    const user = userEvent.setup();

    const rendered = renderSection('collapsed');
    await waitForMutationsIdle(rendered.client);

    await pickSessionProperty(user, 'Owner', 'All owners');

    expect(await screen.findByRole('link', { name: 'factory/pr-20004' })).toBeInTheDocument();
    expect(sessionPropertiesTrigger(1)).toBeInTheDocument();
  });
});
