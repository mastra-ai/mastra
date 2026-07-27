/**
 * BDD coverage for the sidebar "New user session" flow: the Plus button opens
 * a naming dialog (no inline sidebar input), creating slugs the name into a
 * `user/<slug>` branch, binds an agent-controller chat session/thread, and
 * navigates to the new session thread.
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

const createdSession: FactoryUserSession = {
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

/** Stub the factory (with one linked repository) + an empty session list. */
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

describe('User sessions create dialog', () => {
  it('opens a naming dialog from the Plus button instead of an inline sidebar input', async () => {
    stubFactoryWithRepository();
    const user = userEvent.setup();

    renderSection();

    // Before opening: no input anywhere in the sidebar.
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New user session' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New user session' })).toBeInTheDocument();
    expect(screen.getByLabelText('Session name')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('creates the session with a user/<slug> branch, then navigates to its thread', async () => {
    stubFactoryWithRepository();
    let createBody: unknown;
    let controllerCreateBody: unknown;
    let renamedTitle: unknown;
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({ session: createdSession });
      }),
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, async ({ request }) => {
        controllerCreateBody = await request.json();
        return HttpResponse.json({ controllerId: 'code', resourceId: 'sess-1', threadId: 'sess-1' });
      }),
      http.put(`${TEST_BASE_URL}/api/agent-controller/code/sessions/sess-1/threads/sess-1`, async ({ request }) => {
        renamedTitle = ((await request.json()) as { title: string }).title;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();

    renderSection();

    await user.click(await screen.findByRole('button', { name: 'New user session' }));
    await user.type(screen.getByLabelText('Session name'), 'My Feature');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1/user/threads/sess-1'),
    );
    expect(createBody).toMatchObject({ branch: 'user/my-feature' });
    expect(controllerCreateBody).toMatchObject({ threadId: 'sess-1' });
    expect(renamedTitle).toBe('My Feature');
    // The dialog closes once the session exists.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the create error inside the dialog and keeps the entered name', async () => {
    stubFactoryWithRepository();
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({ message: 'Branch already exists' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();

    renderSection();

    await user.click(await screen.findByRole('button', { name: 'New user session' }));
    await user.type(screen.getByLabelText('Session name'), 'My Feature');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Branch already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Session name')).toHaveValue('My Feature');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closing the dialog via Cancel leaves no input behind in the sidebar', async () => {
    stubFactoryWithRepository();
    const user = userEvent.setup();

    renderSection();

    await user.click(await screen.findByRole('button', { name: 'New user session' }));
    await user.type(screen.getByLabelText('Session name'), 'scratch');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    // Reopening starts fresh.
    await user.click(screen.getByRole('button', { name: 'New user session' }));
    expect(await screen.findByLabelText('Session name')).toHaveValue('');
  });
});
