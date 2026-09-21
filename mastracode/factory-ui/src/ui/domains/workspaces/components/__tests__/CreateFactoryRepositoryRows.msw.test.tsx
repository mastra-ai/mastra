import { screen } from '@testing-library/react';
import { Command } from '@mastra/playground-ui/components/Command';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { CreateFactoryRepositoryRows } from '../create-factory/CreateFactoryRepositoryRows';

afterEach(() => vi.restoreAllMocks());

it('offers both Platform connection actions without exposing server OAuth configuration', async () => {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({
        enabled: false,
        connected: false,
        installations: [],
        reason: 'missing_config',
        diagnostics: { missingGithubAppEnvVars: ['GITHUB_APP_ID'] },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
      HttpResponse.json({ enabled: false, configured: false, reason: 'missing_config' }),
    ),
  );
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);

  renderWithProviders(
    <Command>
      <CreateFactoryRepositoryRows
        query=""
        githubRedirecting={false}
        onConnect={vi.fn()}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />
    </Command>,
  );

  const github = await screen.findByRole('option', { name: /Connect GitHub/ });
  const gitlab = screen.getByRole('option', { name: /Connect GitLab/ });
  expect(github).toHaveAttribute('aria-disabled', 'false');
  expect(gitlab).toHaveAttribute('aria-disabled', 'false');
  expect(github).not.toHaveTextContent('GITHUB_APP_ID');
  expect(gitlab).not.toHaveTextContent('GITLAB_ACCESS_TOKEN');

  const user = userEvent.setup();
  await user.click(github);
  await user.click(gitlab);
  expect(open).toHaveBeenCalledTimes(2);
  expect(open).toHaveBeenCalledWith('https://projects.mastra.ai', '_blank', 'noopener,noreferrer');
});
