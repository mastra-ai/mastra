/**
 * BDD coverage for the sidebar session-row pending state: clicking a row kicks
 * off an async open (agent-controller session create + navigation), so while
 * that is in flight the row shows an "Opening <name>" spinner, is disabled,
 * and further clicks do not fire duplicate session-create requests.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { FactoryUserSession } from '../../services/github';
import { UserSessionsSection } from '../UserSessionsSection';

const projectRepositoryId = 'ghp-1';

const existingSession: FactoryUserSession = {
  id: 'row-1',
  sessionId: 'sess-1',
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'user/my-feature',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

/** Stub the factory (with one linked repository) + the session list. */
function stubFactoryWithRepository(sessions: FactoryUserSession[]) {
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

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
        <Route path="*" element={<UserSessionsSection />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Session row open pending state', () => {
  it('shows a spinner on the clicked row, blocks duplicate opens, then navigates once resolved', async () => {
    stubFactoryWithRepository([existingSession]);

    let createCalls = 0;
    let releaseCreate!: () => void;
    const createGate = new Promise<void>(resolve => {
      releaseCreate = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, async () => {
        createCalls += 1;
        await createGate;
        return HttpResponse.json({ controllerId: 'code', resourceId: 'sess-1', threadId: 'sess-1' });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    const row = await screen.findByRole('button', { name: 'my-feature' });
    await user.click(row);

    // The clicked row shows a spinner and is disabled while the open is in flight.
    const spinner = await screen.findByRole('status', { name: 'Opening my-feature' });
    expect(spinner).toBeInTheDocument();
    expect(row).toBeDisabled();

    // A second click while pending does not fire another session create.
    await user.click(row);
    expect(createCalls).toBe(1);

    releaseCreate();

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1/user/threads/sess-1'),
    );
    expect(screen.queryByRole('status', { name: 'Opening my-feature' })).not.toBeInTheDocument();
    expect(row).toBeEnabled();
    expect(createCalls).toBe(1);
  });
});
