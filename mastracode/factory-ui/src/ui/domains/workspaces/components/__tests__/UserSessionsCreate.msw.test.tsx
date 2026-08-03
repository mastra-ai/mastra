/**
 * BDD coverage for the sidebar "New user session" flow: the Plus button mints a
 * `user/session-N` branch and opens its thread in one round trip — no naming
 * dialog, and no agent-controller work, which is what used to hold the click
 * for as long as the sandbox took to clone the repository.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/github';
import { UserSessionsSection } from '../UserSessionsSection';

const projectRepositoryId = 'ghp-1';

function userSession(overrides: Partial<FactoryUserSession> = {}): FactoryUserSession {
  return {
    id: 'row-1',
    sessionId: 'sess-1',
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'user/session-1',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

/** Stub the factory (with one linked repository) + a session list. */
function stubFactoryWithRepository(sessions: FactoryUserSession[] = []) {
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
  );
}

/** Counts every agent-controller call the sidebar could make while creating. */
function trackControllerRequests() {
  const calls = { createSession: 0, renameThread: 0 };
  server.use(
    http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, () => {
      calls.createSession += 1;
      return HttpResponse.json({ controllerId: 'code', resourceId: 'sess-1', threadId: 'sess-1' });
    }),
    http.put(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/threads/:threadId`, () => {
      calls.renameThread += 1;
      return HttpResponse.json({});
    }),
  );
  return calls;
}

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
        <Route path="/factories/:factoryId/user/threads/:threadId" element={<UserSessionsSection />} />
        <Route path="*" element={<UserSessionsSection />} />
      </Routes>
      <LocationProbe />
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

describe('User sessions creation', () => {
  it('creates a numbered session and opens its thread without asking for a name', async () => {
    stubFactoryWithRepository();
    const controller = trackControllerRequests();
    let createBody: unknown;
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({ session: userSession() });
      }),
    );
    const user = userEvent.setup();

    renderSection();
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New user session' }));

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1/user/threads/sess-1'),
    );
    expect(createBody).toMatchObject({ branch: 'user/session-1' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // The sandbox provision behind these belongs to the thread page, not the click.
    expect(controller).toEqual({ createSession: 0, renameThread: 0 });
  });

  it('counts past the sessions already there', async () => {
    stubFactoryWithRepository([userSession({ branch: 'user/session-1' }), userSession({ branch: 'user/session-2' })]);
    trackControllerRequests();
    let createBody: unknown;
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({ session: userSession({ sessionId: 'sess-3', branch: 'user/session-3' }) });
      }),
    );
    const user = userEvent.setup();

    renderSection();
    await screen.findByRole('button', { name: 'session-2' });

    await user.click(screen.getByRole('button', { name: 'New user session' }));

    await waitFor(() => expect(createBody).toMatchObject({ branch: 'user/session-3' }));
  });

  it('shows the new session in the sidebar without waiting for the list to refetch', async () => {
    stubFactoryWithRepository();
    trackControllerRequests();
    let listings = 0;
    let landRefetch = () => {};
    const refetched = new Promise<void>(resolve => {
      landRefetch = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({ session: userSession() }),
      ),
      // The refetch the create kicks off is held open, so a row on screen can
      // only have come from the cache the mutation seeded.
      http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, async () => {
        listings += 1;
        if (listings === 1) return HttpResponse.json({ sessions: [] });
        await refetched;
        return HttpResponse.json({ sessions: [userSession()] });
      }),
    );
    const user = userEvent.setup();

    renderSection();
    await screen.findByText('No sessions yet');

    await user.click(screen.getByRole('button', { name: 'New user session' }));

    expect(await screen.findByRole('button', { name: 'session-1' })).toBeInTheDocument();
    landRefetch();
    await waitFor(() => expect(listings).toBeGreaterThan(1));
  });

  it('waits for the session list before naming, so it cannot reuse a name in use', async () => {
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
      http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({ sessions: [userSession()] });
      }),
    );

    renderSection();

    expect(await screen.findByRole('button', { name: 'New user session' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'New user session' })).toBeEnabled());
  });

  it('reports a failed create and leaves the button usable', async () => {
    stubFactoryWithRepository();
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({ message: 'Branch already exists' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();

    renderSection();
    await screen.findByText('No sessions yet');

    await user.click(screen.getByRole('button', { name: 'New user session' }));

    expect(await screen.findByText('Branch already exists')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'New user session' })).toBeEnabled());
  });
});
