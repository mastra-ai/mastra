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
import { pickSessionProperty } from './fixtures/sessionProperties';

const projectRepositoryId = 'ghp-1';
const sessionId = 'sess-1';

const session: FactoryUserSession = {
  id: 'row-1',
  sessionId,
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'private' as const,
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
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
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

async function openActions(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Session actions for ${name}` }));
}

const name = 'Tell me what have been done in the factory since';

describe('User session visibility', () => {
  it('lets the owner share a private session and make it private again', async () => {
    let sessions = [session];
    const requested: unknown[] = [];
    useFactoryFixtures(() => sessions);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/:sessionId/visibility`, async ({ request }) => {
        const { visibility } = (await request.json()) as { visibility: 'org' | 'private' };
        requested.push(visibility);
        sessions = [{ ...session, visibility }];
        return HttpResponse.json({ session: sessions[0] });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    await openActions(user, name);
    await user.click(await screen.findByRole('menuitem', { name: 'Share with organization' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Session shared with your organization')).toBeInTheDocument();
    expect(await screen.findByLabelText(`${name} shared with organization`)).toBeInTheDocument();

    await openActions(user, name);
    await user.click(await screen.findByRole('menuitem', { name: 'Make private' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Session is now private')).toBeInTheDocument();
    expect(screen.queryByLabelText(`${name} shared with organization`)).not.toBeInTheDocument();
    expect(requested).toEqual(['org', 'private']);
  });

  it('does not offer visibility changes on a teammate’s shared session', async () => {
    useFactoryFixtures(() => [{ ...session, userId: 'user-2', visibility: 'org' }]);

    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('button', { name: /^Sessions properties/ });
    await pickSessionProperty(user, 'Owner', 'All owners');
    expect(await screen.findByLabelText(`${name} shared with organization`)).toBeInTheDocument();
    await openActions(user, name);
    expect(await screen.findByRole('menuitem', { name: 'Pin session' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Make private' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Share with organization' })).not.toBeInTheDocument();
  });

  it('does not offer visibility changes on the owner’s Slack thread session', async () => {
    useFactoryFixtures(() => [{ ...session, branch: 'slack/1700000000-000100', visibility: 'org' }]);

    const user = userEvent.setup();
    renderSection();

    await openActions(user, name);
    expect(await screen.findByRole('menuitem', { name: 'Pin session' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Make private' })).not.toBeInTheDocument();
  });

  it('disables the visibility change while one is in flight', async () => {
    let release = () => {};
    const answered = new Promise<void>(resolve => {
      release = resolve;
    });
    const requested: string[] = [];
    useFactoryFixtures(() => [session]);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/:sessionId/visibility`, async ({ request }) => {
        const { visibility } = (await request.json()) as { visibility: 'org' | 'private' };
        requested.push(visibility);
        await answered;
        return HttpResponse.json({ session: { ...session, visibility } });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    await openActions(user, name);
    await user.click(await screen.findByRole('menuitem', { name: 'Share with organization' }));
    await openActions(user, name);
    const pending = await screen.findByRole('menuitem', { name: 'Share with organization' });
    expect(pending).toHaveAttribute('aria-disabled', 'true');
    await user.click(pending);

    release();
    await waitForMutationsIdle(client);
    expect(requested).toEqual(['org']);
  });

  it('reports a failed change and keeps the session private', async () => {
    useFactoryFixtures(() => [session]);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/:sessionId/visibility`, () =>
        HttpResponse.json({ error: 'Session not found' }, { status: 404 }),
      ),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    await openActions(user, name);
    await user.click(await screen.findByRole('menuitem', { name: 'Share with organization' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText('Failed to change session visibility (404)')).toBeInTheDocument();
    expect(screen.queryByLabelText(`${name} shared with organization`)).not.toBeInTheDocument();
  });
});
