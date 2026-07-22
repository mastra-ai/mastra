/**
 * BDD coverage for the `/factories/create` full-screen wizard: Name → VCS
 * (GitHub repo) → Project management (Linear). The step and pending factory id
 * live in sessionStorage so a full-page OAuth redirect can resume the flow.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { CreateFactoryPage } from '../../../../pages/CreateFactoryPage';
import type { GithubStatus } from '../../services/github';

const STEP_KEY = 'mastracode.factory-create.step';
const FACTORY_KEY = 'mastracode.factory-create.factory-id';

const connectedGithub: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
  reason: 'ready',
};

const repo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  repositoryStorageId: 'repo-99',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderFlow(initialEntries: string[] = ['/factories/create']) {
  return renderWithProviders(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
      <Routes>
        <Route path="/factories/create" element={<CreateFactoryPage />} />
        <Route path="*" element={<></>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Create Factory wizard', () => {
  it('starts on the name step with a disabled Continue until a name is typed', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));

    renderFlow();

    expect(await screen.findByRole('heading', { name: 'Name your new Factory.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Factory name')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await userEvent.setup().type(screen.getByLabelText('Factory name'), 'Mastra');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('creates the Factory from the name step, then advances to repository selection', async () => {
    let received: unknown;
    let projectCreated = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: projectCreated ? [{ id: 'fp-1', name: 'Mastra' }] : [] }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
        received = await request.json();
        projectCreated = true;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.type(await screen.findByLabelText('Factory name'), 'Mastra');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
    expect(received).toEqual({ name: 'Mastra' });
    // Persisted for the GitHub OAuth round-trip.
    expect(sessionStorage.getItem(STEP_KEY)).toBe('vcs');
    expect(sessionStorage.getItem(FACTORY_KEY)).toBe('fp-1');
  });

  it('links the selected repository to the pending Factory (no second create), then shows Linear', async () => {
    const calls: string[] = [];
    seedPendingVcsFlow();
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects`, () => {
        calls.push('create');
        return HttpResponse.json({ project: { id: 'fp-other', name: 'unexpected' } });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () => {
        calls.push('connect');
        return HttpResponse.json({ connection: { id: 'conn-1' } });
      }),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
        async ({ request }) => {
          calls.push('link');
          expect(await request.json()).toMatchObject({ repositoryId: 'repo-99', branch: 'main' });
          return HttpResponse.json({
            projectRepository: {
              id: 'ghp_1',
              branch: 'main',
              sandboxWorkdir: '/workspace/hello',
              repository: { slug: 'octo/hello', defaultBranch: 'main' },
            },
          });
        },
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    expect(await screen.findByRole('heading', { name: 'Connect the work behind the code.' })).toBeInTheDocument();
    expect(calls).toEqual(['connect', 'link']);
    expect(sessionStorage.getItem(STEP_KEY)).toBe('project-management');
    expect(sessionStorage.getItem(FACTORY_KEY)).toBe('fp-1');
  });

  it('skips repository selection and lands on the Factory home with the flow cleared', async () => {
    seedPendingVcsFlow();
    const user = userEvent.setup();

    renderFlow();

    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1'));
    expect(sessionStorage.getItem(STEP_KEY)).toBeNull();
    expect(sessionStorage.getItem(FACTORY_KEY)).toBeNull();
  });

  it('resumes at the stored step after an OAuth round-trip', async () => {
    seedPendingVcsFlow('project-management');
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          reason: 'ready',
          workspace: { name: 'Acme', urlKey: 'acme' },
        }),
      ),
    );

    renderFlow();

    expect(await screen.findByRole('heading', { name: 'Connect the work behind the code.' })).toBeInTheDocument();
    expect(await screen.findByText('Connected to Acme.')).toBeInTheDocument();
  });

  it('restarts at the name step when the stored pending Factory no longer exists', async () => {
    sessionStorage.setItem(STEP_KEY, 'vcs');
    sessionStorage.setItem(FACTORY_KEY, 'missing-factory');
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      // The VCS step may render briefly before the reset effect fires.
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
    );

    renderFlow();

    expect(await screen.findByRole('heading', { name: 'Name your new Factory.' })).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem(FACTORY_KEY)).toBeNull());
  });

  it('shows the server error inline when Factory creation fails', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ error: 'Factory creation is unavailable' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.type(await screen.findByLabelText('Factory name'), 'Mastra');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create Factory (500)');
    expect(screen.getByRole('heading', { name: 'Name your new Factory.' })).toBeInTheDocument();
  });

  it('the Back button and Escape return to the previous history entry', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));
    const user = userEvent.setup();

    renderFlow(['/factories/previous/work', '/factories/create']);

    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/previous/work'));
  });

  it('the Back button falls back to / when there is no in-app history (deep link)', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));
    const user = userEvent.setup();

    renderFlow();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/'));
  });
});

/** Seed a mid-flow state: factory fp-1 exists server-side and the wizard is past the name step. */
function seedPendingVcsFlow(step: 'vcs' | 'project-management' = 'vcs') {
  sessionStorage.setItem(STEP_KEY, step);
  sessionStorage.setItem(FACTORY_KEY, 'fp-1');
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
    http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
  );
}
