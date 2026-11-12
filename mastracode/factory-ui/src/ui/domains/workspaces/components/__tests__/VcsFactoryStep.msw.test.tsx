import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { VcsFactoryStep } from '../VcsFactoryStep';
import type { VcsFactoryStepProps } from '../VcsFactoryStep';

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

function renderStep(props: Partial<VcsFactoryStepProps> = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/onboarding']}>
      <VcsFactoryStep
        githubRedirecting={false}
        onDismissGithubCallback={vi.fn()}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('VCS Factory step', () => {
  beforeEach(() => {
    server.use(http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })));
  });

  it('requires an explicit selection and Continue, and clears selection when searching', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)));
    const onSelectRepository = vi.fn();
    renderStep({ onSelectRepository });
    const user = userEvent.setup();
    const radio = await screen.findByRole('radio', { name: 'octo/hello' });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(screen.getByText('octo/hello'));
    expect(radio).toBeChecked();
    expect(onSelectRepository).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSelectRepository).toHaveBeenCalledExactlyOnceWith(repo);
    await user.type(screen.getByLabelText('Search repositories'), 'other');
    expect(radio).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('debounces repository searches before requesting filtered results', async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ repos: [repo] });
      }),
    );

    const { client } = renderStep();

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

  it('offers Retry when the repository list fails to load', async () => {
    let calls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ repos: [repo] });
      }),
    );
    renderStep();

    expect(await screen.findByRole('alert')).toHaveTextContent('503');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('offers Retry when GitLab status cannot be loaded', async () => {
    let calls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ enabled: true, configured: false, reauthRequired: false, reason: 'not_connected' });
      }),
    );
    renderStep();

    await userEvent.click(await screen.findByRole('radio', { name: 'GitLab' }));
    expect(await screen.findByText("Couldn't load GitLab status.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry GitLab' }));
    expect(await screen.findByRole('button', { name: /Connect GitLab/ })).toBeEnabled();
    expect(screen.getByText('Projects, branches, and merge requests.')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('offers Retry when GitHub status cannot be loaded, instead of a Connect that would fail', async () => {
    let calls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' });
      }),
    );
    renderStep();

    expect(await screen.findByText("Couldn't load GitHub status.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry GitHub' }));
    expect(await screen.findByRole('button', { name: /Connect GitHub/ })).toBeEnabled();
    expect(calls).toBe(2);
  });

  it('says why an install on a teammate-shared personal GitHub account shows nothing, even with GitLab ready', async () => {
    // Platform hides a personal-account install from an org with more than one member, so status stays not_connected.
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
    );
    const onConnect = vi.fn();
    renderStep({ githubCallback: { kind: 'installed' }, onConnect });

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Factory can’t use this GitHub installation');
    expect(screen.getByRole('radio', { name: 'GitHub' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Choose another account' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('keeps explaining a personal install Platform withholds when the user comes back later', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'personal_install_hidden' }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
      ),
    );
    renderStep();

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Factory can’t use this GitHub installation');
    expect(within(notice).getByRole('button', { name: 'Choose another account' })).toBeInTheDocument();
  });

  it('shows nothing extra when an install is usable right away', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)));
    renderStep({ githubCallback: { kind: 'installed' } });

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends a refusal fixed in Mastra Platform there, and clears it once Refresh finds the installation', async () => {
    let linkedInPlatform = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json(
          linkedInPlatform
            ? connectedGithub
            : { enabled: true, connected: false, installations: [], reason: 'not_connected' },
        ),
      ),
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authEnabled: true,
          authenticated: true,
          user: { userId: 'user-1', organizationId: 'org_1' },
        }),
      ),
    );
    const onDismissGithubCallback = vi.fn();
    renderStep({
      githubCallback: {
        kind: 'error',
        code: 'github_app_installation_preexisting',
        message: 'This GitHub account already had the Mastra GitHub App.',
      },
      onDismissGithubCallback,
    });

    const platform = await screen.findByRole('link', { name: 'Open Mastra Platform' });
    await waitFor(() =>
      expect(platform).toHaveAttribute('href', 'https://projects.mastra.ai/orgs/org_1/settings/general'),
    );
    linkedInPlatform = true;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(onDismissGithubCallback).toHaveBeenCalledOnce();
  });

  it('offers to connect again after a refusal only a new connect can fix', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );
    const onConnect = vi.fn();
    renderStep({
      githubCallback: { kind: 'error', code: 'github_app_installation_not_owned', message: 'Only the owner can link.' },
      onConnect,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Connect GitHub again' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('pairs a GitHub account mismatch with Platform and a new connect, since a refresh links nothing', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );
    const onConnect = vi.fn();
    renderStep({
      githubCallback: { kind: 'error', code: 'github_app_connection_mismatch', message: 'Different GitHub account.' },
      onConnect,
    });

    expect(await screen.findByRole('link', { name: 'Open Mastra Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect GitHub again' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('sends an expired session to sign in instead of offering a GitHub connect that would fail', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ error: 'auth_required' }, { status: 401 }),
      ),
    );
    renderStep();

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
  });

  it('opens connected repositories directly and lets the user switch providers', async () => {
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

    renderStep();

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'GitHub' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'GitLab' }));

    expect(await screen.findByRole('radio', { name: 'group/project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search repositories')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'octo/hello' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'GitHub' }));

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'group/project' })).not.toBeInTheDocument();
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

    renderStep({ onConnect });

    await userEvent.click(await screen.findByRole('button', { name: 'Connect GitHub' }));

    expect(onConnect).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it('asks to reconnect when the drafted repository’s provider was disconnected', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
      ),
    );

    renderStep({ initialRepository: repo });

    expect(await screen.findByRole('button', { name: 'Connect GitHub' })).toBeEnabled();
    expect(screen.queryByLabelText('Search repositories')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
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

    renderStep();

    await userEvent.click(await screen.findByRole('radio', { name: 'GitLab' }));
    expect(await screen.findByText('Projects, branches, and merge requests.')).toBeInTheDocument();
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

    renderStep();

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

    renderStep();

    await userEvent.click(await screen.findByRole('radio', { name: 'GitLab' }));
    expect(await screen.findByText('Join an organization to connect GitLab.')).toBeInTheDocument();
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

    renderStep();

    await userEvent.click(await screen.findByRole('radio', { name: 'GitLab' }));
    expect(await screen.findByText('Projects, branches, and merge requests.')).toBeInTheDocument();
    expect(screen.queryByText('GITLAB_ACCESS_TOKEN')).not.toBeInTheDocument();
    expect(screen.queryByText('GITLAB_ACCESS_TOKEN_TYPE')).not.toBeInTheDocument();
  });

  it('re-checks GitHub when an approval was requested', async () => {
    let statusCalls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => {
        statusCalls += 1;
        return HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' });
      }),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
      ),
    );

    const { client } = renderStep({ githubCallback: { kind: 'requested' } });

    expect(await screen.findByText('GitHub App installation requested')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    const before = statusCalls;

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitForMutationsIdle(client);

    expect(statusCalls).toBe(before + 1);
  });

  it('lists repositories once an approval requested from a connected GitHub account is granted', async () => {
    let statusCalls = 0;
    const refreshes: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => {
        statusCalls += 1;
        return HttpResponse.json(connectedGithub);
      }),
      // The new installation only shows up once the server re-syncs installations.
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        const refresh = new URL(request.url).searchParams.get('refresh');
        if (refresh) refreshes.push(refresh);
        return HttpResponse.json({ repos: refresh ? [repo] : [] });
      }),
    );

    const onDismissGithubCallback = vi.fn();
    const { client } = renderStep({ githubCallback: { kind: 'requested' }, onDismissGithubCallback });

    expect(await screen.findByText(/No repositories are shared with the Mastra GitHub App yet/)).toBeInTheDocument();
    expect(screen.getByText('GitHub App installation requested')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    const before = statusCalls;

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(refreshes).toHaveLength(1);
    expect(statusCalls).toBe(before + 1);
    expect(onDismissGithubCallback).toHaveBeenCalledOnce();
  });

  it('keeps a pending approval request up while other repositories are already listed', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)));
    renderStep({ githubCallback: { kind: 'requested' } });

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(screen.getByText('GitHub App installation requested')).toBeInTheDocument();
  });

  it('says when a repository refresh fails and retries it', async () => {
    let failRefresh = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        if (new URL(request.url).searchParams.get('refresh') && failRefresh)
          return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ repos: [repo] });
      }),
    );
    renderStep();

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh GitHub repositories' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('503');
    failRefresh = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
