import { screen } from '@testing-library/react';
import { Command } from '@mastra/playground-ui/components/Command';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { CreateFactoryRepositoryRows } from '../create-factory/CreateFactoryRepositoryRows';

afterEach(() => vi.restoreAllMocks());

it('disables both connect actions when neither provider is configured', async () => {
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

  const github = await screen.findByRole('option', { name: /GitHub unavailable/ });
  const gitlab = screen.getByRole('option', { name: /GitLab unavailable/ });
  expect(github).toHaveAttribute('aria-disabled', 'true');
  expect(gitlab).toHaveAttribute('aria-disabled', 'true');
  expect(github).not.toHaveTextContent('GITHUB_APP_ID');
  expect(gitlab).not.toHaveTextContent('GITLAB_ACCESS_TOKEN');
  expect(open).not.toHaveBeenCalledWith('https://projects.mastra.ai', expect.anything(), expect.anything());
});

it('calls onConnect for GitHub directly without any Platform redirect', async () => {
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
      HttpResponse.json({ enabled: false, configured: false, reason: 'missing_config' }),
    ),
  );
  const onConnect = vi.fn();
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);

  renderWithProviders(
    <Command>
      <CreateFactoryRepositoryRows
        query=""
        githubRedirecting={false}
        onConnect={onConnect}
        onManageConnection={vi.fn()}
        onSelectRepository={vi.fn()}
      />
    </Command>,
  );

  const github = await screen.findByRole('option', { name: /Connect GitHub/ });
  await userEvent.setup().click(github);
  expect(onConnect).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalledWith('https://projects.mastra.ai', expect.anything(), expect.anything());
});

it('starts a Nango connect session when the user picks the GitLab row', async () => {
  const connectSessions: string[] = [];
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

  const gitlab = await screen.findByRole('option', { name: /Connect GitLab/ });
  await userEvent.setup().click(gitlab);
  await vi.waitFor(() => expect(connectSessions).toEqual(['gitlab']));
  expect(open).not.toHaveBeenCalledWith('https://projects.mastra.ai', expect.anything(), expect.anything());
});

it('disables the GitLab row when the account is personal (organization_required)', async () => {
  const connectSessions: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
    ),
    // GitLab returns enabled:true but the connect-session would 403 with
    // organization_required, so the row must not attempt to start a session.
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

  const gitlab = await screen.findByRole('option', { name: /GitLab unavailable/ });
  expect(gitlab).toHaveAttribute('aria-disabled', 'true');
  expect(gitlab).toHaveTextContent(/Join an organization to connect GitLab repositories/);
  await userEvent.setup().click(gitlab);
  expect(connectSessions).toEqual([]);
});
