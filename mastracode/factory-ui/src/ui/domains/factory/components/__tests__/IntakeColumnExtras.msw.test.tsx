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

function IntakeColumnExtrasHarness() {
  const issues = useProjectIssuesQuery(PROJECT_ID);
  const pulls = useProjectPullRequestsQuery(undefined);
  const linearIssues = useLinearIssuesQuery(undefined);

  return <IntakeColumnExtras source="github" issues={issues} pulls={pulls} linearIssues={linearIssues} />;
}

describe('IntakeColumnExtras GitHub installation health', () => {
  it('shows a reconnect banner for a broken installation and clears it after recovery', async () => {
    let broken = true;
    server.use(
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

    expect(await screen.findByText('GitHub installation removed. Reconnect to keep syncing issues.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect GitHub' })).toBeInTheDocument();

    broken = false;
    await client.invalidateQueries();

    await waitFor(() =>
      expect(
        screen.queryByText('GitHub installation removed. Reconnect to keep syncing issues.'),
      ).not.toBeInTheDocument(),
    );
  });
});
