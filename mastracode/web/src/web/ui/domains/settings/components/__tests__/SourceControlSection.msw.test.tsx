/**
 * BDD coverage for Settings › Source Control.
 *
 * The section is scoped to the active factory: repository linking for
 * server-backed Factories, the bound path for local factories, and removal of
 * the active factory itself. Factories come from localStorage; only the
 * network is mocked (MSW).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { ActiveFactoryProvider } from '../../../workspaces';
import type { GithubStatus } from '../../../workspaces/services/github';
import { SourceControlSection } from '../SourceControlSection';

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
  reason: 'ready',
};

const availableRepo = {
  id: 99,
  fullName: 'octo/world',
  name: 'world',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  repositoryStorageId: 'repo-99',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/world',
};

function seedLocalFactory() {
  localStorage.setItem(
    'mastracode-factories',
    JSON.stringify([
      {
        id: 'factory-local',
        name: 'Local Factory',
        resourceId: 'resource-local',
        createdAt: 1,
        binding: { kind: 'local', path: '/tmp/local' },
      },
    ]),
  );
  localStorage.setItem('mastracode-active-factory', 'factory-local');
}

function seedServerFactory() {
  localStorage.setItem(
    'mastracode-factories',
    JSON.stringify([
      {
        id: 'factory-server',
        name: 'My Factory',
        resourceId: 'resource-server',
        createdAt: 1,
        binding: {
          kind: 'factory',
          factoryProjectId: 'fp-1',
          repositories: [{ projectRepositoryId: 'pr-1', slug: 'octo/hello', worktrees: [] }],
        },
      },
    ]),
  );
  localStorage.setItem('mastracode-active-factory', 'factory-server');
}

function renderSection() {
  return renderWithProviders(
    <ActiveFactoryProvider>
      <SourceControlSection />
    </ActiveFactoryProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe('SourceControlSection', () => {
  it('given no active factory, when rendered, then it prompts to select one', () => {
    renderSection();
    expect(screen.getByText('Select a factory to manage its source control.')).toBeInTheDocument();
  });

  it('given an active local factory, when rendered, then it shows the bound path without a repository panel', async () => {
    seedLocalFactory();

    renderSection();

    expect(await screen.findByText('/tmp/local')).toBeInTheDocument();
    expect(screen.queryByLabelText('Connect repositories')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Local Factory' })).toBeInTheDocument();
  });

  it('given an active server factory, when rendered, then linked and available repositories appear', async () => {
    seedServerFactory();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedStatus)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [availableRepo] })),
    );

    renderSection();

    expect(await screen.findByText('Linked repositories')).toBeInTheDocument();
    expect(await screen.findByText('octo/hello')).toBeInTheDocument();
    expect(await screen.findByText('octo/world')).toBeInTheDocument();
    expect(await screen.findByText('Link')).toBeInTheDocument();
  });

  it('given installations but no personal GitHub connection, when rendered, then it offers to connect the user', async () => {
    seedServerFactory();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ ...connectedStatus, userConnected: false, userGithubUsername: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [] })),
    );

    renderSection();

    expect(
      await screen.findByText('Connect your GitHub account so issues and PRs you create are authored as you.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
  });

  it('given a personal GitHub connection, when rendered, then it shows the linked identity instead of the button', async () => {
    seedServerFactory();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ ...connectedStatus, userConnected: true, userGithubUsername: 'ada' }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [] })),
    );

    renderSection();

    expect(await screen.findByText('@ada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
  });

  it('given a server without per-user connection support, when rendered, then no personal connection row appears', async () => {
    seedServerFactory();
    server.use(
      // Older backend: status has no userConnected/userGithubUsername fields.
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedStatus)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [] })),
    );

    renderSection();

    expect(await screen.findByText('Manage GitHub connection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Connect your GitHub account so issues and PRs you create are authored as you.'),
    ).not.toBeInTheDocument();
  });

  it('given an active server factory, when removed, then the project is deleted and selection clears', async () => {
    seedServerFactory();
    const deleted: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedStatus)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [] })),
      http.delete(`${TEST_BASE_URL}/web/factory/projects/:id`, ({ params }) => {
        deleted.push(String(params.id));
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Remove My Factory' }));

    await waitFor(() => expect(deleted).toEqual(['fp-1']));
    await screen.findByText('Select a factory to manage its source control.');
    expect(localStorage.getItem('mastracode-active-factory')).toBeNull();
  });
});
