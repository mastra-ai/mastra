import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import type { GitHubAppCallbackResult } from '../GitHubAppCallbackHandler';
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

const gitlabRepository: GitLabRepository = {
  provider: 'gitlab',
  id: 'gitlab:123',
  externalId: '123',
  fullName: 'group/project',
  name: 'project',
  owner: 'group',
  defaultBranch: 'main',
  private: true,
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/project',
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

/** Owns the callback the way the onboarding page does, so dismissing it really removes it. */
function StepWithDismissableCallback({ callback }: { callback: GitHubAppCallbackResult }) {
  const [current, setCurrent] = useState<GitHubAppCallbackResult | undefined>(callback);
  return (
    <VcsFactoryStep
      githubRedirecting={false}
      githubCallback={current}
      onDismissGithubCallback={() => setCurrent(undefined)}
      onConnect={vi.fn()}
      onManageConnection={vi.fn()}
      onSelectRepository={vi.fn()}
    />
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

  it('opens on a few recently pushed repositories and searches the server for the rest once typing starts', async () => {
    const requests: Array<{ q: string | null; limit: string | null }> = [];
    const recent = Array.from({ length: 8 }, (_, index) => ({
      ...repo,
      id: index + 1,
      name: `recent-${index}`,
      fullName: `acme/recent-${index}`,
    }));
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push({ q: params.get('q'), limit: params.get('limit') });
        return HttpResponse.json({
          repos: params.get('q') ? [{ ...repo, id: 99, name: 'old-tool', fullName: 'acme/old-tool' }] : recent,
        });
      }),
    );

    const { client } = renderStep();

    expect(await screen.findByText('acme/recent-0')).toBeInTheDocument();
    expect(requests).toEqual([{ q: null, limit: '8' }]);

    await userEvent.type(screen.getByLabelText('Search repositories'), 'old');
    expect(await screen.findByText('acme/old-tool', {}, { timeout: 2000 })).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(requests.at(-1)).toEqual({ q: 'old', limit: '50' });
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

  it('says an install GitHub reported is not usable yet instead of a bare Connect, even with GitLab ready', async () => {
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
    expect(notice).toHaveTextContent('Factory can’t see this GitHub installation yet');
    expect(screen.getByRole('radio', { name: 'GitHub' })).toBeChecked();
    await userEvent.click(within(notice).getByRole('button', { name: 'Choose another account' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('blames a failed status load, not the install, when status cannot be read after an install', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ error: 'Temporary outage' }, { status: 503 }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
      ),
    );
    renderStep({ githubCallback: { kind: 'installed' } });

    expect(await screen.findByText("Couldn't load GitHub status.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry GitHub' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a GitHub refusal even when the drafted repository is on GitLab', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
    );
    renderStep({
      initialRepository: gitlabRepository,
      githubCallback: { kind: 'error', code: 'github_app_installation_not_owned', message: 'Only the owner can link.' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Only the owner can link.');
    expect(await screen.findByRole('radio', { name: 'GitHub' })).toBeChecked();
  });

  it('stays on GitHub after its notice is dismissed, so Connect is still there', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
    );
    renderWithProviders(
      <MemoryRouter initialEntries={['/onboarding']}>
        <StepWithDismissableCallback
          callback={{ kind: 'error', code: 'github_app_installation_not_owned', message: 'Only the owner can link.' }}
        />
      </MemoryRouter>,
    );

    const notice = await screen.findByRole('alert');
    await userEvent.click(within(notice).getByRole('button', { name: 'Dismiss notice' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'GitHub' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeEnabled();
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
    // Platform's reason holds until the organization changes; dismissing it would hide the only explanation.
    expect(within(notice).queryByRole('button', { name: 'Dismiss notice' })).not.toBeInTheDocument();
  });

  it('keeps a ready GitLab user on GitLab when Platform withholds a personal GitHub install', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'personal_install_hidden' }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/projects`, () => HttpResponse.json({ projects: [] })),
    );
    renderStep();

    expect(await screen.findByRole('radio', { name: 'GitLab' })).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/signin?returnTo=%2Fonboarding',
    );
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
  });

  it('sends a Factory account Platform cannot link to sign out, since connecting again fails the same way', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );
    renderStep({
      githubCallback: {
        kind: 'error',
        code: 'github_app_person_not_platform_user',
        message: 'This GitHub link was started for an account that isn’t a Mastra account.',
      },
    });

    const notice = await screen.findByRole('alert');
    expect(within(notice).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(notice).queryByRole('button', { name: 'Connect GitHub again' })).not.toBeInTheDocument();
  });

  it('treats an already-used GitHub link as likely done: informs instead of alarming, and offers Refresh', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );
    renderStep({
      githubCallback: {
        kind: 'error',
        code: 'github_app_link_already_used',
        message: 'This GitHub link was already used.',
      },
    });

    expect(await screen.findByText('This GitHub link was already used.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
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

  it('lists repositories and clears the request once an approval lands and Refresh finds it', async () => {
    let approved = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json(
          approved ? connectedGithub : { enabled: true, connected: false, installations: [], reason: 'not_connected' },
        ),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, reauthRequired: false, reason: 'missing_config' }),
      ),
    );
    const onDismissGithubCallback = vi.fn();
    renderStep({ githubCallback: { kind: 'requested' }, onDismissGithubCallback });

    expect(await screen.findByText('GitHub App installation requested')).toBeInTheDocument();
    approved = true;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('radio', { name: 'octo/hello' })).toBeInTheDocument();
    expect(onDismissGithubCallback).toHaveBeenCalledOnce();
  });

  it('keeps a refusal up when a refresh lists repositories it was not waiting on', async () => {
    let refreshed = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        if (new URL(request.url).searchParams.get('refresh')) refreshed = true;
        return HttpResponse.json({ repos: refreshed ? [repo, { ...repo, id: 100, fullName: 'octo/new' }] : [repo] });
      }),
    );
    const onDismissGithubCallback = vi.fn();
    const { client } = renderStep({
      githubCallback: { kind: 'error', code: 'github_app_connection_mismatch', message: 'Different GitHub account.' },
      onDismissGithubCallback,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh GitHub repositories' }));
    expect(await screen.findByRole('radio', { name: 'octo/new' })).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(onDismissGithubCallback).not.toHaveBeenCalled();
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
    const refreshStatuses: number[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, ({ request }) => {
        if (!new URL(request.url).searchParams.get('refresh')) return HttpResponse.json({ repos: [repo] });
        refreshStatuses.push(failRefresh ? 503 : 200);
        if (failRefresh) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ repos: [repo] });
      }),
    );
    const { client } = renderStep();

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh GitHub repositories' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('503');
    failRefresh = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(refreshStatuses).toEqual([503, 200]);
  });
});
