import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import type { GithubRepo } from '../../services/github';
import { ProjectManagementFactoryStep } from '../ProjectManagementFactoryStep';
import type { ProjectManagementFactoryStepProps } from '../ProjectManagementFactoryStep';

const githubRepository: GithubRepo = {
  id: 99,
  fullName: 'acme/widgets',
  name: 'widgets',
  owner: 'acme',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/widgets',
};

const gitlabProject: GitLabRepository = {
  provider: 'gitlab',
  id: 'gitlab-source',
  externalId: '42',
  fullName: 'acme/platform',
  name: 'platform',
  owner: 'acme',
  defaultBranch: 'main',
  private: true,
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/platform',
};

function renderStep(overrides: Partial<ProjectManagementFactoryStepProps> = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
    ),
  );
  return renderWithProviders(
    <ProjectManagementFactoryStep onConnect={() => {}} onContinue={() => {}} {...overrides} />,
  );
}

describe('ProjectManagementFactoryStep', () => {
  describe('given the server has no Platform credentials', () => {
    it('shows only the Linear connect path', async () => {
      renderStep();

      expect(await screen.findByRole('button', { name: /Connect Linear/ })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText('Loading Jira connections')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Connect Jira' })).not.toBeInTheDocument();
    });
  });

  describe('given the Platform connect routes are mounted', () => {
    it('offers Jira and incident.io as equivalent choices beside Linear', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/jira/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
      );
      renderStep();

      expect(await screen.findByRole('button', { name: 'Connect Jira' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Connect incident.io' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect Linear/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
      // The incident.io pane is scoped to follow-ups only.
      expect(screen.getByText(/incident follow-ups/i)).toBeInTheDocument();
    });

    it('summarizes an active Jira account and unlocks Continue', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/jira/connections`, () =>
          HttpResponse.json({
            connections: [
              { id: 'a1b_acme', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
            ],
          }),
        ),
      );
      renderStep();

      expect(await screen.findByText('Connected', { exact: true })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Jira' })).toBeInTheDocument();
      expect(screen.getByText('Connected to acme.atlassian.net.')).toBeInTheDocument();
      // Additional accounts are managed in Settings, not during onboarding.
      expect(screen.queryByRole('button', { name: 'Connect another' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('summarizes an active incident.io account', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({
            connections: [{ id: 'c1_acme', integrationId: 'incident-io', status: 'active', accountLabel: 'acme' }],
          }),
        ),
      );
      renderStep();

      expect(await screen.findByText('Connected', { exact: true })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'incident.io' })).toBeInTheDocument();
      expect(screen.getByText('Connected to acme.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });
  });

  describe('given the codebase step picked a repository', () => {
    it('lists the GitHub repository as a source that is on by default', async () => {
      renderStep({ repository: githubRepository });

      expect(await screen.findByRole('heading', { name: 'GitHub' })).toBeInTheDocument();
      expect(screen.getByText('Sync issues from acme/widgets')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
      // The repository is a source on its own, so Work has something to bring in
      // without any tracker, and "Skip for now" would be misleading.
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('reports the switch being turned off', async () => {
      const onCodeHostSyncChange = vi.fn();
      renderStep({ repository: githubRepository, onCodeHostSyncChange });

      const user = userEvent.setup();
      await user.click(await screen.findByRole('switch', { name: 'Sync GitHub issues' }));

      // The switch reports the new value alongside its change details.
      expect(onCodeHostSyncChange).toHaveBeenCalledWith(false, expect.anything());
    });

    it('offers to skip while the switch is off', async () => {
      renderStep({ repository: githubRepository, codeHostSync: false });

      expect(await screen.findByRole('switch', { name: 'Sync GitHub issues' })).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
    });

    it('names the GitLab project its issues come from', async () => {
      renderStep({ repository: gitlabProject });

      expect(await screen.findByRole('heading', { name: 'GitLab' })).toBeInTheDocument();
      expect(screen.getByText('Sync issues from acme/platform')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync GitLab issues' })).toBeChecked();
    });

    it('previews the repository host while the row is hovered', async () => {
      const onPreviewSource = vi.fn();
      renderStep({ repository: gitlabProject, onPreviewSource });

      const user = userEvent.setup();
      await user.hover(await screen.findByRole('heading', { name: 'GitLab' }));

      expect(onPreviewSource).toHaveBeenCalledWith('gitlab');
    });
  });
});

describe('Tracker connection recovery', () => {
  it.each([
    ['jira', 'Jira'],
    ['incident-io', 'incident.io'],
  ] as const)('keeps %s visible after a temporary failure and retries', async (provider, name) => {
    let calls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/integrations/platform/${provider}/connections`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ connections: [] });
      }),
    );
    renderStep();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: `Retry ${name}` }));
    expect(await screen.findByRole('button', { name: `Connect ${name}` })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it.each([
    ['jira', 'Jira'],
    ['incident-io', 'incident.io'],
  ] as const)('reauthorizes the existing %s connection instead of creating another', async (provider, name) => {
    const reconnects: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/integrations/platform/${provider}/connections`, () =>
        HttpResponse.json({
          connections: [
            { id: 'expired-account', integrationId: provider, status: 'needs_reauth', accountLabel: 'Acme' },
          ],
        }),
      ),
      http.post(
        `${TEST_BASE_URL}/web/integrations/platform/${provider}/connections/expired-account/reconnect-session`,
        ({ request }) => {
          reconnects.push(request.url);
          return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        },
      ),
    );
    renderStep();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: `Reconnect ${name}` }));
    if (provider === 'incident-io') {
      await user.type(screen.getByLabelText('incident.io API key'), 'demo-key');
      await user.click(screen.getByRole('button', { name: 'Connect' }));
    }
    await waitFor(() => expect(reconnects).toHaveLength(1));
    expect(screen.queryByRole('button', { name: `Connect ${name}` })).not.toBeInTheDocument();
  });

  it('offers Retry instead of Reconnect when Linear status fails to load', async () => {
    let calls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' });
      }),
    );
    renderWithProviders(<ProjectManagementFactoryStep onConnect={() => {}} onContinue={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Retry Linear' }));
    expect(await screen.findByRole('button', { name: 'Connect Linear' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('offers Reconnect instead of Retry when Linear authorization expired', async () => {
    const onConnect = vi.fn();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ error: 'auth_required' }, { status: 401 }),
      ),
    );
    renderWithProviders(<ProjectManagementFactoryStep onConnect={onConnect} onContinue={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reconnect Linear' }));
    expect(onConnect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Retry Linear' })).not.toBeInTheDocument();
  });
});
