import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

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
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
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

async function renderSection() {
  const { client } = renderWithProviders(
    <MemoryRouter initialEntries={['/factories/factory-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitForMutationsIdle(client);
}

async function openFilters() {
  const trigger = await screen.findByRole('button', { name: 'Filter sessions' });
  await userEvent.setup().click(trigger);
  return screen.findByRole('textbox', { name: 'Search sessions' });
}

async function selectFilter(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  const item = await screen.findByRole('option', { name: option });
  fireEvent.pointerDown(item, { pointerType: 'mouse' });
  fireEvent.click(item, { detail: 1 });
}

describe('User session filters', () => {
  it('keeps controls in a popover and searches across session details', async () => {
    await renderSection();

    expect(await screen.findByRole('button', { name: 'Fix authentication' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Improve compiler output' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search sessions' })).not.toBeInTheDocument();

    const search = await openFilters();
    await userEvent.setup().type(search, 'COMPILER-OUTPUT');

    await waitFor(() => {
      expect(screen.queryByText('Fix authentication')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Improve compiler output')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter sessions, 1 active' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Fix authentication')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter sessions' })).toBeInTheDocument();
  });

  it('filters by the viewer and deduplicates owner choices', async () => {
    await renderSection();
    await openFilters();

    await selectFilter('Owner', 'Mine');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Fix authentication' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Owner' }));
    expect(await screen.findAllByRole('option', { name: 'Grace Hopper' })).toHaveLength(1);
  });

  it('uses the existing status precedence and shows a filtered-empty state', async () => {
    await renderSection();
    await openFilters();

    await selectFilter('Status', 'Initializing');

    expect(await screen.findByRole('button', { name: 'Prepare release' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Improve compiler output' })).not.toBeInTheDocument();

    const popover = screen.getByRole('textbox', { name: 'Search sessions' }).closest('[data-slot="popover-content"]');
    if (!(popover instanceof HTMLElement)) throw new Error('Filter popover not found');
    await userEvent.setup().type(within(popover).getByRole('textbox', { name: 'Search sessions' }), 'does-not-exist');

    expect(await screen.findByText('No sessions match these filters')).toBeInTheDocument();
  });
});
