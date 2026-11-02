import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Toaster } from '@mastra/playground-ui/components/Toaster';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { SessionsSection } from '../SessionsSection';
import { testChatSession } from './fixtures/sessionsSection';

const projectRepositoryId = 'ghp-1';
const sessionId = 'sess-1';

const session: FactoryUserSession = {
  id: 'row-1',
  sessionId,
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  branch: 'user/my-feature',
  baseBranch: 'main',
  title: 'Tell me what have been done in the factory since',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function useFactoryFixtures(sessions: () => FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-7',
            repositories: [
              {
                id: projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/workspace/hello',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () =>
      HttpResponse.json({ sessions: sessions() }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/:agentControllerId/sessions/:resourceId/threads`, () =>
      HttpResponse.json({ threads: [] }),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

async function openTitleAction(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Session actions for ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Regenerate title' }));
}

describe('Session title regeneration', () => {
  it.each([
    ['user/my-feature', 'dropdown'],
    ['user/my-feature', 'context'],
    ['slack/1791936483-798759', 'dropdown'],
    ['slack/1791936483-798759', 'context'],
  ])('renames the owned %s row from the %s menu', async (branch, entry) => {
    let sessions = [{ ...session, branch }];
    useFactoryFixtures(() => sessions);
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authEnabled: true, authenticated: true, user: { userId: session.userId } }),
      ),
      http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/title`, () => {
        sessions = [{ ...session, branch, title: 'Factory audit log review' }];
        return HttpResponse.json({ title: 'Factory audit log review' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    if (entry === 'context') {
      await user.pointer({
        target: await screen.findByRole('link', { name: session.title }),
        keys: '[MouseRight]',
      });
      await user.click(await screen.findByRole('menuitem', { name: 'Regenerate title' }));
    } else {
      await openTitleAction(user, 'Tell me what have been done in the factory since');
    }
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('link', { name: 'Factory audit log review' })).toBeInTheDocument();
  });

  it('keeps a pending session disabled while another session finishes first', async () => {
    const other: FactoryUserSession = { ...session, id: 'row-2', sessionId: 'sess-2', title: 'Second session' };
    let releaseFirst = () => {};
    const firstAnswered = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const asked: string[] = [];
    useFactoryFixtures(() => [session, other]);
    server.use(
      http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/title`, async ({ params }) => {
        asked.push(String(params.sessionId));
        if (params.sessionId === sessionId) await firstAnswered;
        return HttpResponse.json({ title: `Named ${params.sessionId}` });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    await openTitleAction(user, 'Tell me what have been done in the factory since');
    await openTitleAction(user, 'Second session');
    expect(await screen.findByText('Renamed to “Named sess-2”')).toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', {
        name: 'Session actions for Tell me what have been done in the factory since',
      }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Regenerate title' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(await screen.findByRole('menuitem', { name: 'Regenerate title' }));

    releaseFirst();
    await waitForMutationsIdle(client);
    expect(asked).toEqual([sessionId, 'sess-2']);
  });

  it('keeps a pending session disabled after its group folds and unfolds again', async () => {
    const newerSessions = Array.from(
      { length: 5 },
      (_, index): FactoryUserSession => ({
        ...session,
        id: `row-newer-${index}`,
        sessionId: `sess-newer-${index}`,
        title: `Newer session ${index}`,
        updatedAt: `2026-07-24T0${index}:00:00.000Z`,
      }),
    );
    let releaseTitle = () => {};
    const titleAnswered = new Promise<void>(resolve => {
      releaseTitle = resolve;
    });
    const asked: string[] = [];
    useFactoryFixtures(() => [session, ...newerSessions]);
    server.use(
      http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/title`, async ({ params }) => {
        asked.push(String(params.sessionId));
        await titleAnswered;
        return HttpResponse.json({ title: 'Factory audit log review' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    await user.click(await screen.findByRole('button', { name: 'Show 1 more' }));
    await openTitleAction(user, 'Tell me what have been done in the factory since');
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));

    await user.click(
      await screen.findByRole('button', {
        name: 'Session actions for Tell me what have been done in the factory since',
      }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Regenerate title' })).toHaveAttribute('aria-disabled', 'true');

    releaseTitle();
    await waitForMutationsIdle(client);
    expect(asked).toEqual([sessionId]);
  });

  it('surfaces the server’s reason when there is nothing to name the session from', async () => {
    useFactoryFixtures(() => [session]);
    server.use(
      http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/title`, () =>
        HttpResponse.json({ error: 'This session has no conversation to name yet.' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    await openTitleAction(user, 'Tell me what have been done in the factory since');
    await waitForMutationsIdle(client);

    expect(await screen.findByText('This session has no conversation to name yet.')).toBeInTheDocument();
  });
});
