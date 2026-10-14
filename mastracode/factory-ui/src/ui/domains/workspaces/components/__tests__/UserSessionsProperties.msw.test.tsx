import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';
import {
  closeSessionProperties,
  openSessionProperties,
  openSessionProperty,
  pickSessionProperty,
  sessionPropertiesTrigger,
} from './fixtures/sessionProperties';

const projectRepositoryId = 'repo-1';

const sessions: FactoryUserSession[] = [
  {
    id: 'row-mine',
    sessionId: 'session-mine',
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-me',
    owner: { id: 'user-me', name: 'Romain' },
    visibility: 'org',
    title: 'Fix authentication',
    branch: 'user/fix-auth',
    baseBranch: 'main',
    sandboxId: 'sandbox-1',
    sandboxWorkdir: '/workspace/mine',
    materializedAt: '2026-09-04T10:00:00.000Z',
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T11:00:00.000Z',
  },
  {
    id: 'row-working',
    sessionId: 'session-working',
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-grace',
    owner: { id: 'user-grace', name: 'Grace Hopper' },
    visibility: 'org',
    title: 'Improve compiler output',
    branch: 'user/compiler-output',
    baseBranch: 'main',
    sandboxId: 'sandbox-2',
    sandboxWorkdir: '/workspace/working',
    materializedAt: '2026-09-04T10:00:00.000Z',
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T10:30:00.000Z',
  },
  {
    id: 'row-initializing',
    sessionId: 'session-initializing',
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-grace',
    owner: { id: 'user-grace', name: 'Grace Hopper' },
    visibility: 'org',
    title: 'Prepare release',
    branch: 'user/release',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  },
];

beforeEach(() => {
  window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authEnabled: true,
        authenticated: true,
        user: { userId: 'user-me', name: 'Romain', email: 'romain@example.com' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'factory-1', name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: [
              {
                id: projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/workspace',
                repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json({
        runs: [
          { runId: 'run-working', resourceId: 'session-working', threadId: 'session-working' },
          { runId: 'run-initializing', resourceId: 'session-initializing', threadId: 'session-initializing' },
        ],
      }),
    ),
  );
});

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

async function renderSection({ waitForIdle = true } = {}) {
  const { client } = renderWithProviders(
    <MemoryRouter initialEntries={['/factories/factory-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
      </Routes>
    </MemoryRouter>,
  );
  if (waitForIdle) await waitForMutationsIdle(client);
}

const sessionRowLabels = () =>
  screen
    .getAllByRole('button', { name: /^(Fix authentication|Improve compiler output|Prepare release)$/ })
    .map(row => row.getAttribute('aria-label'));

describe('User sessions properties', () => {
  it("opens on the viewer's own sessions without reading as changed", async () => {
    const user = userEvent.setup();
    await renderSection();

    expect(await screen.findByRole('button', { name: 'Fix authentication' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();
    expect(sessionPropertiesTrigger('User sessions')).toBeInTheDocument();

    await openSessionProperties(user, 'User sessions');
    expect(screen.getByRole('menuitem', { name: /^Owner\s*Mine$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reset to default' })).toHaveAttribute('aria-disabled', 'true');
    await closeSessionProperties(user);

    await pickSessionProperty(user, 'User sessions', 'Owner', 'All owners');

    expect(await screen.findByRole('button', { name: 'Improve compiler output' })).toBeInTheDocument();
    expect(sessionPropertiesTrigger('User sessions', 1)).toBeInTheDocument();

    await openSessionProperties(user, 'User sessions');
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Fix authentication' })).toBeInTheDocument();
    expect(sessionPropertiesTrigger('User sessions')).toBeInTheDocument();
  });

  it('says so when the viewer owns no sessions yet', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () =>
        HttpResponse.json({ sessions: sessions.filter(session => session.userId !== 'user-me') }),
      ),
    );
    const user = userEvent.setup();
    await renderSection();

    expect(await screen.findByText('No sessions of your own.')).toHaveAttribute('role', 'status');

    await pickSessionProperty(user, 'User sessions', 'Owner', 'All owners');

    expect(await screen.findByRole('button', { name: 'Improve compiler output' })).toBeInTheDocument();
    expect(screen.queryByText('No sessions of your own.')).not.toBeInTheDocument();
  });

  it('keeps the Mine default when a control changes before the viewer is known', async () => {
    let releaseAuth!: () => void;
    const authGate = new Promise<void>(resolve => {
      releaseAuth = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, async () => {
        await authGate;
        return HttpResponse.json({
          authEnabled: true,
          authenticated: true,
          user: { userId: 'user-me', name: 'Romain', email: 'romain@example.com' },
        });
      }),
    );
    const user = userEvent.setup();
    // /auth/me is held open, so the queries never go idle until it is released.
    await renderSection({ waitForIdle: false });

    expect(await screen.findByRole('button', { name: 'Improve compiler output' })).toBeInTheDocument();
    await pickSessionProperty(user, 'User sessions', 'Status', 'Working');

    releaseAuth();

    // Mine now applies on top of the status change: the viewer has no working session.
    expect(await screen.findByText('No sessions match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();
    await openSessionProperties(user, 'User sessions');
    expect(screen.getByRole('button', { name: 'User sessions properties, 1 changed' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Owner\s*Mine$/ })).toBeInTheDocument();
  });

  it('filters by a specific owner and deduplicates owner choices', async () => {
    const user = userEvent.setup();
    await renderSection();

    await pickSessionProperty(user, 'User sessions', 'Owner', 'Grace Hopper');

    expect(await screen.findByRole('button', { name: 'Improve compiler output' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Fix authentication' })).not.toBeInTheDocument();
    });

    await openSessionProperty(user, 'User sessions', 'Owner');
    expect(screen.getAllByRole('menuitemradio', { name: 'Grace Hopper' })).toHaveLength(1);
    await closeSessionProperties(user);
  });

  it('uses the existing status precedence and shows a filtered-empty state', async () => {
    const user = userEvent.setup();
    await renderSection();

    await pickSessionProperty(user, 'User sessions', 'Owner', 'All owners');
    await pickSessionProperty(user, 'User sessions', 'Status', 'Initializing');

    expect(await screen.findByRole('button', { name: 'Prepare release' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();

    await pickSessionProperty(user, 'User sessions', 'Owner', 'Mine');

    expect(await screen.findByText('No sessions match these filters')).toHaveAttribute('role', 'status');
  });

  it('lists sessions by last update with pinned first, and resets a chosen sort', async () => {
    localStorage.setItem('mastracode.pinnedSessions', JSON.stringify(['session-initializing']));
    const user = userEvent.setup();
    await renderSection();

    await pickSessionProperty(user, 'User sessions', 'Owner', 'All owners');
    await screen.findByRole('button', { name: 'Improve compiler output' });
    expect(sessionRowLabels()).toEqual(['Prepare release', 'Fix authentication', 'Improve compiler output']);

    await pickSessionProperty(user, 'User sessions', 'Sort', 'Last created');

    expect(sessionRowLabels()).toEqual(['Prepare release', 'Improve compiler output', 'Fix authentication']);
    expect(sessionPropertiesTrigger('User sessions', 2)).toBeInTheDocument();

    await openSessionProperties(user, 'User sessions');
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));

    await waitFor(() => expect(sessionPropertiesTrigger('User sessions')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Fix authentication' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();
  });
});
