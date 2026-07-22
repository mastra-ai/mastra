import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { ActiveFactoryProvider } from '../../context/ActiveFactoryProvider';
import { loadActiveFactoryId, loadFactories, saveFactories } from '../../services/factories';
import type { GithubStatus } from '../../services/github';
import { EmptyFactoryState } from '../EmptyFactoryState';

const STEP_KEY = 'mastracode.factory-onboarding.step';
const FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

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

function renderOnboarding() {
  return renderWithProviders(
    <MemoryRouter>
      <ActiveFactoryProvider>
        <EmptyFactoryState />
      </ActiveFactoryProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('EmptyFactoryState onboarding', () => {
  it('explains Software Factories before moving to the GitHub step', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );
    const user = userEvent.setup();

    renderOnboarding();

    expect(
      screen.getByRole('heading', { name: 'Build software with a Factory that knows your work.' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create my first factory' }));

    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
    expect(sessionStorage.getItem(STEP_KEY)).toBe('vcs');
  });

  it('explains when GitHub is unavailable without offering a connection action', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
      ),
    );
    const user = userEvent.setup();

    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Create my first factory' }));

    expect(await screen.findByText('GitHub is not configured for this deployment.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
  });

  it('searches GitHub repositories with the entered query and renders the filtered result', async () => {
    const queries: Array<string | null> = [];
    const filteredRepo = {
      ...repo,
      id: 100,
      fullName: 'octo/filtered',
      name: 'filtered',
      repositoryStorageId: 'repo-100',
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        const query = new URL(request.url).searchParams.get('q');
        queries.push(query);
        return HttpResponse.json({ repos: query === 'filtered' ? [filteredRepo] : [repo] });
      }),
    );
    const user = userEvent.setup();

    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Create my first factory' }));
    const search = await screen.findByRole('textbox', { name: 'Search repositories' });
    await user.type(search, 'filtered');

    expect(await screen.findByRole('button', { name: /octo\/filtered/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /octo\/hello/ })).not.toBeInTheDocument();
    expect(queries).toContain('filtered');
  });

  it('clears stale onboarding state and returns to repository selection', async () => {
    sessionStorage.setItem(STEP_KEY, 'project-management');
    sessionStorage.setItem(FACTORY_KEY, 'missing-factory');
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );

    renderOnboarding();

    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
    expect(sessionStorage.getItem(STEP_KEY)).toBe('vcs');
    expect(sessionStorage.getItem(FACTORY_KEY)).toBeNull();
  });

  it('creates and links the selected repository, waits for Linear, then activates on skip', async () => {
    const calls: string[] = [];
    let projectCreated = false;
    const linked: Array<{
      id: string;
      branch: string;
      sandboxWorkdir: string;
      repository: { slug: string; defaultBranch: string };
    }> = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: projectCreated ? [{ id: 'fp-1', name: 'hello' }] : [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({
          connections: linked.length ? [{ id: 'conn-1', installationId: 'inst-7', repositories: linked }] : [],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('q')).toBeNull();
        return HttpResponse.json({ repos: [repo] });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
        calls.push('create');
        expect(await request.json()).toEqual({ name: 'hello' });
        projectCreated = true;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'hello' } });
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
          const projectRepository = {
            id: 'ghp_1',
            branch: 'main',
            sandboxWorkdir: '/workspace/hello',
            repository: { slug: 'octo/hello', defaultBranch: 'main' },
          };
          linked.push(projectRepository);
          return HttpResponse.json({ projectRepository });
        },
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
      http.post(`${TEST_BASE_URL}/web/github/projects/ghp_1/ensure`, () =>
        HttpResponse.json({
          resourceId: 'resource-1',
          factoryProjectId: 'fp-1',
          projectRepositoryId: 'ghp_1',
          sandboxId: 'sandbox-1',
          sandboxWorkdir: '/workspace/hello',
        }),
      ),
    );
    const user = userEvent.setup();

    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Create my first factory' }));
    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    await waitFor(() => expect(calls).toEqual(['create', 'connect', 'link']));
    expect(await screen.findByRole('heading', { name: 'Connect the work behind the code.' })).toBeInTheDocument();
    expect(loadActiveFactoryId()).toBeNull();
    expect(sessionStorage.getItem(FACTORY_KEY)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(loadActiveFactoryId()).not.toBeNull());
    expect(loadFactories()[0]).toMatchObject({ resourceId: 'resource-1' });
    expect(sessionStorage.getItem(STEP_KEY)).toBeNull();
    expect(sessionStorage.getItem(FACTORY_KEY)).toBeNull();
  });

  it('restores the Linear step after OAuth and completes an already connected setup', async () => {
    saveFactories([
      {
        id: 'factory-1',
        name: 'hello',
        createdAt: 1,
        binding: {
          kind: 'factory',
          factoryProjectId: 'fp-1',
          repositories: [{ projectRepositoryId: 'ghp_1', slug: 'octo/hello', worktrees: [] }],
        },
      },
    ]);
    sessionStorage.setItem(STEP_KEY, 'project-management');
    sessionStorage.setItem(FACTORY_KEY, 'factory-1');
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'hello' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              installationId: 'inst-7',
              repositories: [
                {
                  id: 'ghp_1',
                  branch: 'main',
                  repository: { slug: 'octo/hello', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          reason: 'ready',
          workspace: { name: 'Acme', urlKey: 'acme' },
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/github/projects/ghp_1/ensure`, () =>
        HttpResponse.json({
          resourceId: 'resource-1',
          factoryProjectId: 'fp-1',
          projectRepositoryId: 'ghp_1',
          sandboxId: 'sandbox-1',
          sandboxWorkdir: '/workspace/hello',
        }),
      ),
    );
    const user = userEvent.setup();

    renderOnboarding();

    expect(await screen.findByText('Connected to Acme.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));

    await waitFor(() => expect(loadActiveFactoryId()).toBe('factory-1'));
    expect(sessionStorage.getItem(STEP_KEY)).toBeNull();
    expect(sessionStorage.getItem(FACTORY_KEY)).toBeNull();
  });

  it('shows the server error when Factory creation fails', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ error: 'Factory creation is unavailable' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();

    renderOnboarding();
    await user.click(screen.getByRole('button', { name: 'Create my first factory' }));
    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create Factory (500)');
    expect(screen.getByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();
  });
});
