import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../../hooks/useFactoryData';
import { useLinearIssuesQuery } from '../../../../../hooks/useLinearData';
import { IntakeColumnExtras } from '../IntakeColumnExtras';

const PROJECT_ID = 'github-project-1';
const ISSUES_URL = `${TEST_BASE_URL}/web/github/projects/${PROJECT_ID}/issues`;
const PULLS_URL = `${TEST_BASE_URL}/web/github/projects/${PROJECT_ID}/prs`;
const STATUS_URL = `${TEST_BASE_URL}/web/github/status`;

function IntakeColumnExtrasHarness({
  source = 'github',
  accountLogin = 'acme',
}: {
  source?: 'github' | 'github-prs';
  accountLogin?: string;
}) {
  const issues = useProjectIssuesQuery(source === 'github' ? PROJECT_ID : undefined);
  const pulls = useProjectPullRequestsQuery(source === 'github-prs' ? PROJECT_ID : undefined);
  const linearIssues = useLinearIssuesQuery(undefined);

  return (
    <IntakeColumnExtras
      source={source}
      issues={issues}
      pulls={pulls}
      linearIssues={linearIssues}
      accountLogin={accountLogin}
    />
  );
}

describe('IntakeColumnExtras GitHub installation health', () => {
  it('shows a reconnect banner for a broken installation and clears it after recovery', async () => {
    let broken = true;
    server.use(
      http.get(STATUS_URL, () =>
        HttpResponse.json({ enabled: true, connected: true, installations: [], brokenInstallations: [] }),
      ),
      http.get(ISSUES_URL, () =>
        broken
          ? HttpResponse.json(
              {
                error: 'github_installation_broken',
                message: 'GitHub installation for @acme is unavailable. Reconnect GitHub to continue.',
                installationId: 42,
                accountLogin: 'acme',
              },
              { status: 424 },
            )
          : HttpResponse.json({ issues: [], nextPage: null }),
      ),
    );

    const { client } = renderWithProviders(<IntakeColumnExtrasHarness />);

    expect(
      await screen.findByText('GitHub installation removed. Reconnect to keep syncing issues.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect GitHub' })).toBeInTheDocument();

    broken = false;
    await client.invalidateQueries();

    await waitFor(() =>
      expect(
        screen.queryByText('GitHub installation removed. Reconnect to keep syncing issues.'),
      ).not.toBeInTheDocument(),
    );
  });

  it('refetches GitHub status after a PR failure and shows the reconnect banner without changing the PR contract', async () => {
    let statusRequests = 0;
    server.use(
      http.get(STATUS_URL, () => {
        statusRequests += 1;
        return HttpResponse.json({
          enabled: true,
          connected: statusRequests === 1,
          installations: [],
          brokenInstallations:
            statusRequests === 1
              ? []
              : [{ installationId: 42, accountLogin: 'acme', accountType: 'Organization', brokenAt: Date.now() }],
        });
      }),
      http.get(PULLS_URL, () =>
        HttpResponse.json({ error: 'github_fetch_failed', message: 'Installation unavailable' }, { status: 502 }),
      ),
    );

    renderWithProviders(<IntakeColumnExtrasHarness source="github-prs" />);

    expect(
      await screen.findByText('GitHub installation removed. Reconnect to keep syncing pull requests.'),
    ).toBeInTheDocument();
    expect(statusRequests).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Reconnect GitHub' })).toBeInTheDocument();
  });

  it('does not show a PR reconnect banner when a different installation is broken', async () => {
    let statusRequests = 0;
    server.use(
      http.get(STATUS_URL, () => {
        statusRequests += 1;
        return HttpResponse.json({
          enabled: true,
          connected: true,
          installations: [{ installationId: 7, accountLogin: 'healthy-org', accountType: 'Organization' }],
          brokenInstallations: [
            { installationId: 42, accountLogin: 'other-org', accountType: 'Organization', brokenAt: Date.now() },
          ],
        });
      }),
      http.get(PULLS_URL, () =>
        HttpResponse.json({ error: 'github_fetch_failed', message: 'Temporary GitHub failure' }, { status: 502 }),
      ),
    );

    renderWithProviders(<IntakeColumnExtrasHarness source="github-prs" accountLogin="healthy-org" />);

    await waitFor(() => expect(statusRequests).toBeGreaterThanOrEqual(2));
    expect(
      screen.queryByText('GitHub installation removed. Reconnect to keep syncing pull requests.'),
    ).not.toBeInTheDocument();
  });
});
