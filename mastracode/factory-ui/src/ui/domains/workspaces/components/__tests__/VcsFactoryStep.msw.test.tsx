import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { VcsFactoryStep } from '../VcsFactoryStep';

const connectedGithub = {
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

describe('VCS Factory step', () => {
  it('debounces repository searches before requesting filtered results', async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ repos: [repo] });
      }),
    );

    const { client } = renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Search repositories')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Connect GitHub/ }));
    const search = await screen.findByLabelText('Search repositories');
    await waitForMutationsIdle(client);
    expect(queries).toEqual(['']);
    queries.splice(0);

    const user = userEvent.setup({ delay: 350 });
    await user.type(search, 'jal');

    expect(queries).toEqual([]);
    await act(() => new Promise(resolve => setTimeout(resolve, 800)));
    await waitForMutationsIdle(client);
    expect(queries).toEqual(['jal']);
  });

  it('shows matching provider choices before showing a repository filter', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: true,
          reauthRequired: false,
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/projects`, () =>
        HttpResponse.json({
          projects: [
            {
              id: 'gitlab:123',
              name: 'group/project',
              projectId: '123',
              projectPath: 'group/project',
              installationStorageId: 'gitlab-installation',
              defaultBranch: 'main',
              sandboxProvider: 'local',
              sandboxWorkdir: '/workspace/project',
            },
          ],
        }),
      ),
    );

    renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose GitLab repository/ })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.queryByLabelText('Search repositories')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Choose GitLab repository/ }));

    expect(await screen.findByLabelText('Search repositories')).toBeInTheDocument();
    expect(await screen.findByText('group/project')).toBeInTheDocument();
  });

  it('prefers the deployment GitHub connect flow when it is configured', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: false,
          installations: [],
          reason: 'not_connected',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
      ),
    );
    const onConnect = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={onConnect}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Connect GitHub/ }));

    expect(onConnect).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it('starts a Platform connect session when GitLab has no active account yet', async () => {
    const connectSessions: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: false,
          mode: 'platform',
          connections: [],
          accounts: [],
          reauthRequired: false,
          reason: 'not_connected',
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/integrations/platform/gitlab/connect-session`, () => {
        connectSessions.push('gitlab');
        return HttpResponse.json(
          {
            connectionId: 'conn-new',
            integrationId: 'gitlab',
            connectUrl: 'https://connect.nango.dev/session',
            sessionToken: 'nango-session-token',
            expiresAt: '2026-09-17T12:30:00.000Z',
          },
          { status: 201 },
        );
      }),
    );
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    expect(await screen.findByText('Connect GitLab to choose a repository.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Connect GitLab/ }));

    // The button triggers a Nango connect session on the server, not a redirect to projects.mastra.ai.
    await vi.waitFor(() => expect(connectSessions).toEqual(['gitlab']));
    expect(open).not.toHaveBeenCalledWith('https://projects.mastra.ai', expect.anything(), expect.anything());
    expect(screen.queryByText('GITLAB_ACCESS_TOKEN')).not.toBeInTheDocument();
  });

  it('disables both connect actions without exposing missing provider credentials', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: false,
          connected: false,
          installations: [],
          reason: 'missing_config',
          diagnostics: {
            missingGithubAppEnvVars: ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'],
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({
          enabled: false,
          configured: false,
          reauthRequired: false,
          reason: 'missing_config',
        }),
      ),
    );
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    const github = await screen.findByRole('button', { name: /Connect GitHub/ });
    const gitlab = screen.getByRole('button', { name: /Connect GitLab/ });
    expect(github).toBeDisabled();
    expect(gitlab).toBeDisabled();
    expect(screen.queryByText('GITHUB_APP_ID')).not.toBeInTheDocument();
    expect(screen.queryByText('GITLAB_ACCESS_TOKEN')).not.toBeInTheDocument();

    expect(open).not.toHaveBeenCalledWith('https://projects.mastra.ai', expect.anything(), expect.anything());
  });

  it('disables the GitLab tile when the account is personal (organization_required)', async () => {
    const connectSessions: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      // GitLab returns enabled:true, but the connect-session would 403 with
      // organization_required, so the tile must not offer a doomed Nango start.
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: false,
          mode: 'platform',
          connections: [],
          accounts: [],
          reauthRequired: false,
          reason: 'organization_required',
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/integrations/platform/gitlab/connect-session`, () => {
        connectSessions.push('gitlab');
        return HttpResponse.json({ error: 'organization_required' }, { status: 403 });
      }),
    );

    renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    expect(await screen.findByText('Join an organization to connect GitLab repositories.')).toBeInTheDocument();
    const gitlab = screen.getByRole('button', { name: /Connect GitLab/ });
    expect(gitlab).toBeDisabled();
    await userEvent.click(gitlab);
    expect(connectSessions).toEqual([]);
  });

  it('does not show server environment variables when GitLab authorization must be renewed', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: false,
          mode: 'direct',
          connections: [],
          accounts: [],
          reauthRequired: true,
          reason: 'auth_required',
        }),
      ),
    );

    renderWithProviders(
      <VcsFactoryStep
        connectingRepositoryId={null}
        githubRedirecting={false}
        mutationPending={false}
        mutationError={null}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );

    expect(await screen.findByText('Connect GitLab to choose a repository.')).toBeInTheDocument();
    expect(screen.queryByText('GITLAB_ACCESS_TOKEN')).not.toBeInTheDocument();
    expect(screen.queryByText('GITLAB_ACCESS_TOKEN_TYPE')).not.toBeInTheDocument();
  });
});
