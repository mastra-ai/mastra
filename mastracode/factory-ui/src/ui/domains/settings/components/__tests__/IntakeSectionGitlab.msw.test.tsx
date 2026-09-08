import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { IntakeConfig } from '../../../factory/services/intake';
import { IntakeSection } from '../IntakeSection';

/**
 * GitLab intake in Settings › Intake.
 *
 * The GitLab section is hidden unless the server reports the integration is
 * registered, so every test here has to stub `/web/gitlab/status` — the
 * ambient default in `msw-server.ts` answers 404 (absent) on purpose.
 */

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const GITLAB_STATUS_URL = `${TEST_BASE_URL}/web/gitlab/status`;
const INTAKE_SOURCES_URL = `${TEST_BASE_URL}/web/intake/sources`;
const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;

function baseConfig(overrides: Partial<IntakeConfig> = {}): IntakeConfig {
  return {
    github: { enabled: true, sourceIds: null },
    linear: { enabled: false, sourceIds: null },
    gitlab: { enabled: true, sourceIds: null },
    ...overrides,
  };
}

const connectedStatus = {
  configured: true,
  oauthAvailable: true,
  baseUrl: 'https://gitlab.example.com',
  connectedAs: 'nampn',
  credential: 'oauth',
  expiresAt: 1788866639899,
  instanceVersion: '18.0.2-ee',
};

const disconnectedStatus = {
  configured: false,
  oauthAvailable: true,
  baseUrl: 'https://gitlab.example.com',
  reason: 'no_connection',
};

const gitlabSources = [
  { integrationId: 'gitlab', id: '97', name: 'ScraperOS / app', type: 'project', metadata: { path: 'scraperos/app' } },
  {
    integrationId: 'gitlab',
    id: '108',
    name: 'nampn / orpc-starter',
    type: 'project',
    metadata: { path: 'nampn/orpc-starter' },
  },
  // A source from another integration must not leak into the GitLab picker.
  { integrationId: 'linear', id: 'lproj-1', name: 'Q3 Roadmap', type: 'project' },
];

function stubGitlab({
  status = connectedStatus,
  config = baseConfig(),
}: { status?: JsonBodyType; config?: IntakeConfig } = {}) {
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put(CONFIG_URL, async ({ request }) => {
      const next = (await request.json()) as IntakeConfig;
      saved.push(next);
      return HttpResponse.json({ config: next });
    }),
    http.get(GITLAB_STATUS_URL, () => HttpResponse.json(status)),
    http.get(INTAKE_SOURCES_URL, () => HttpResponse.json({ sources: gitlabSources, failures: [] })),
    http.get(LINEAR_STATUS_URL, () => HttpResponse.json({ enabled: false, connected: false, reason: 'disabled' })),
  );
  return saved;
}

function renderIntakeSection() {
  return renderWithProviders(
    <>
      <IntakeSection />
      <Toaster position="bottom-right" />
    </>,
  );
}

describe('IntakeSection — GitLab', () => {
  describe('given the server has no GitLab integration registered', () => {
    it('omits the section entirely rather than showing a dead source', async () => {
      server.use(
        http.get(CONFIG_URL, () => HttpResponse.json({ config: baseConfig() })),
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json({ enabled: false, connected: false, reason: 'disabled' })),
      );

      renderIntakeSection();

      await waitFor(() => expect(screen.getByText('GitHub issues')).toBeInTheDocument());
      expect(screen.queryByText(/GitLab issues/)).not.toBeInTheDocument();
    });
  });

  describe('given GitLab is configured but not connected', () => {
    it('offers the connect action and names the instance', async () => {
      stubGitlab({ status: disconnectedStatus });

      renderIntakeSection();

      await waitFor(() => expect(screen.getByText('GitLab issues')).toBeInTheDocument());
      expect(screen.getByText('Connect gitlab.example.com to sync its issues.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Connect GitLab' })).toBeInTheDocument();
      // Nothing can be synced yet, so the toggle must not invite a save.
      expect(screen.getByRole('switch', { name: 'Sync GitLab issues' })).toBeDisabled();
    });
  });

  describe('given the stored credential is rejected by GitLab', () => {
    it('surfaces the server detail and offers a reconnect', async () => {
      stubGitlab({
        status: {
          configured: false,
          oauthAvailable: true,
          baseUrl: 'https://gitlab.example.com',
          reason: 'credential_rejected',
          detail: 'GitLab API request failed (401): 401 Unauthorized',
        },
      });

      renderIntakeSection();

      await waitFor(() =>
        expect(
          screen.getByText(/GitLab rejected the stored credential: GitLab API request failed \(401\)/),
        ).toBeInTheDocument(),
      );
      expect(screen.getByRole('button', { name: 'Reconnect GitLab' })).toBeInTheDocument();
    });
  });

  describe('given a connected instance', () => {
    it('lists only GitLab projects, by path, and reports the identity and version', async () => {
      stubGitlab();

      renderIntakeSection();

      await waitFor(() => expect(screen.getByText('GitLab issues (18.0.2-ee)')).toBeInTheDocument());
      expect(screen.getByText(/as nampn/)).toBeInTheDocument();

      const picker = await screen.findByRole('group', { name: /Projects/i }).catch(() => null);
      const scope = picker ? within(picker) : screen;
      expect(await scope.findByText('scraperos/app')).toBeInTheDocument();
      expect(await scope.findByText('nampn/orpc-starter')).toBeInTheDocument();
      // The Linear source in the same response belongs to Linear's own section.
      expect(scope.queryByText('Q3 Roadmap')).not.toBeInTheDocument();
    });

    it('saves the picked project without dropping the other integrations’ selections', async () => {
      const saved = stubGitlab({
        config: baseConfig({
          github: { enabled: true, sourceIds: ['mastra'] },
          linear: { enabled: true, sourceIds: ['lproj-1'] },
        }),
      });

      renderIntakeSection();

      const project = await screen.findByText('scraperos/app');
      await userEvent.click(project);

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]?.gitlab).toEqual({ enabled: true, sourceIds: ['97'] });
      // The server replaces the whole config blob, so a save that forgets a
      // sibling integration silently unsubscribes it.
      expect(saved[0]?.github).toEqual({ enabled: true, sourceIds: ['mastra'] });
      expect(saved[0]?.linear).toEqual({ enabled: true, sourceIds: ['lproj-1'] });
    });

    it('preserves selections for integrations this build has no UI for', async () => {
      const saved = stubGitlab({
        config: {
          ...baseConfig(),
          // A future provider the server knows about and this UI does not.
          jira: { enabled: true, sourceIds: ['PROJ'] },
        },
      });

      renderIntakeSection();

      await userEvent.click(await screen.findByText('scraperos/app'));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]?.jira).toEqual({ enabled: true, sourceIds: ['PROJ'] });
    });
  });
});
