/**
 * The org admin's move from the legacy GitHub App to the Mastra Factory apps.
 * Drives the real services and React Query stack; only the network (and the
 * Nango popup) is mocked.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { PlatformProviderConnection } from '../../../factory/services/platformConnect';
import type { GithubStatus } from '../../../workspaces/services/github';
import type { GithubSwitchMissing, GithubSwitchStatus } from '../../../workspaces/services/githubApps';
import { SourceControlConnections } from '../SourceControlConnections';

const authCalls: string[] = [];
vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string) {
      authCalls.push(integrationId);
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

const SWITCH_URL = `${TEST_BASE_URL}/web/integrations/platform/github/switch`;

const noneMissing = (): GithubSwitchMissing => ({ apps: [], accounts: [], repositories: [], unreadable: [] });

const legacyStatus: GithubStatus = {
  enabled: true,
  mode: 'legacy',
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
  reason: 'ready',
};

interface World {
  githubStatus: GithubStatus;
  switchStatus: GithubSwitchStatus | 'forbidden';
  /** Answers the switch POST; defaults to switching. */
  onSwitch?: () => Response;
}

function serve(world: World) {
  const calls = { switches: 0, sessions: [] as string[], switchReads: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(world.githubStatus)),
    http.get(SWITCH_URL, () => {
      calls.switchReads += 1;
      return world.switchStatus === 'forbidden'
        ? HttpResponse.json({ error: 'forbidden' }, { status: 403 })
        : HttpResponse.json(world.switchStatus);
    }),
    http.post(SWITCH_URL, () => {
      calls.switches += 1;
      if (world.onSwitch) return world.onSwitch();
      world.switchStatus = { mode: 'connect', switchedAt: 1, connections: [] };
      world.githubStatus = {
        ...world.githubStatus,
        mode: 'connect',
        installations: [{ installationId: 900, accountLogin: 'acme', accountType: 'Organization' }],
      };
      return HttpResponse.json({ switched: true, mode: 'connect', switchedAt: 1 });
    }),
    http.post(`${TEST_BASE_URL}/web/integrations/platform/:provider/connect-session`, ({ params }) => {
      const provider = String(params.provider);
      calls.sessions.push(provider);
      return HttpResponse.json(
        {
          connectionId: `new-${provider}`,
          integrationId: provider,
          connectUrl: 'https://example.com/consent',
          sessionToken: 'session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        { status: 201 },
      );
    }),
    http.get(`${TEST_BASE_URL}/web/integrations/platform/:provider/connections`, ({ params }) => {
      const provider = String(params.provider);
      const connections: PlatformProviderConnection[] = [
        { id: `new-${provider}`, integrationId: provider, status: 'active', accountLabel: 'acme' },
      ];
      return HttpResponse.json({ connections });
    }),
  );
  return calls;
}

function renderSourceControl() {
  return renderWithProviders(
    <MemoryRouter>
      <SourceControlConnections />
    </MemoryRouter>,
  );
}

const sourceControl = () => screen.getByRole('region', { name: 'Source control' });
const rowOf = (text: string) => {
  const row = within(sourceControl()).getByText(text).closest<HTMLElement>('[data-slot="settings-item"]');
  if (!row) throw new Error(`${text} row is missing`);
  return row;
};

describe('Switching GitHub to the Mastra Factory apps', () => {
  beforeEach(() => {
    authCalls.length = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ error: 'unavailable' }, { status: 404 }),
      ),
    );
  });

  it('shows nothing to a member who may not switch the org', async () => {
    const calls = serve({ githubStatus: legacyStatus, switchStatus: 'forbidden' });
    renderSourceControl();

    expect(await within(sourceControl()).findByText('acme')).toBeInTheDocument();
    await waitFor(() => expect(calls.switchReads).toBe(1));
    expect(within(sourceControl()).queryByText('Switch to the Mastra Factory apps')).not.toBeInTheDocument();
  });

  it('never asks a server without the switch, or an org that has already switched', async () => {
    for (const mode of [undefined, 'connect'] as const) {
      const calls = serve({ githubStatus: { ...legacyStatus, mode }, switchStatus: 'forbidden' });
      const { unmount } = renderSourceControl();
      expect(await within(sourceControl()).findByText('acme')).toBeInTheDocument();
      expect(calls.switchReads).toBe(0);
      expect(within(sourceControl()).queryByText('Switch to the Mastra Factory apps')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('asks for the Reviews app first, and installs it through a connect session', async () => {
    const calls = serve({
      githubStatus: legacyStatus,
      switchStatus: {
        mode: 'legacy',
        switchedAt: null,
        connections: [{ id: 'conn-github', app: 'factory-github', status: 'active', accountLogin: 'acme' }],
        plan: { ready: false, missing: { ...noneMissing(), apps: ['factory-reviews-github'] } },
      },
    });
    renderSourceControl();

    await within(sourceControl()).findByText('Switch to the Mastra Factory apps');
    const switchRow = rowOf('Switch to the Mastra Factory apps');
    expect(within(switchRow).getByText('Install the Mastra Factory Reviews GitHub app first.')).toBeInTheDocument();
    expect(within(switchRow).getByRole('button', { name: 'Switch' })).toBeDisabled();
    expect(within(rowOf('Mastra Factory GitHub app')).getByText('acme')).toBeInTheDocument();

    const reviewsRow = rowOf('Mastra Factory Reviews GitHub app');
    expect(within(reviewsRow).getByText('Not installed')).toBeInTheDocument();
    await userEvent.click(
      within(reviewsRow).getByRole('button', { name: 'Connect Mastra Factory Reviews GitHub app' }),
    );

    await waitFor(() => expect(calls.sessions).toEqual(['factory-reviews-github']));
    expect(authCalls).toEqual(['factory-reviews-github']);
    expect(calls.switches).toBe(0);
  });

  it('lists the accounts and repositories still out of reach', async () => {
    serve({
      githubStatus: legacyStatus,
      switchStatus: {
        mode: 'legacy',
        switchedAt: null,
        connections: [],
        plan: {
          ready: false,
          missing: {
            ...noneMissing(),
            accounts: [{ accountLogin: 'globex', apps: ['factory-github', 'factory-reviews-github'] }],
            repositories: [
              { slug: 'acme/api', githubRepositoryId: '102', accountLogin: 'acme', apps: ['factory-reviews-github'] },
            ],
          },
        },
      },
    });
    renderSourceControl();

    const blockers = await screen.findByRole('list', { name: 'Before you can switch' });
    expect(
      within(blockers)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual([
      'Install the Mastra Factory GitHub app and Mastra Factory Reviews GitHub app on globex',
      'Give the Mastra Factory Reviews GitHub app access to acme/api',
    ]);
    expect(within(rowOf('Switch to the Mastra Factory apps')).getByRole('button', { name: 'Switch' })).toBeDisabled();
  });

  it('switches once confirmed, then shows the org on the new apps', async () => {
    const calls = serve({
      githubStatus: legacyStatus,
      switchStatus: {
        mode: 'legacy',
        switchedAt: null,
        connections: [
          { id: 'conn-github', app: 'factory-github', status: 'active', accountLogin: 'acme' },
          { id: 'conn-reviews', app: 'factory-reviews-github', status: 'active', accountLogin: 'acme' },
        ],
        plan: { ready: true, missing: noneMissing() },
      },
    });
    renderSourceControl();

    await within(sourceControl()).findByText('Switch to the Mastra Factory apps');
    const switchRow = rowOf('Switch to the Mastra Factory apps');
    expect(within(switchRow).getByText('Both apps reach every repository linked to a project.')).toBeInTheDocument();
    await userEvent.click(within(switchRow).getByRole('button', { name: 'Switch' }));

    const dialog = await screen.findByRole('dialog', { name: 'Switch GitHub to the Mastra Factory apps?' });
    expect(calls.switches).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Switch' }));

    await waitFor(() =>
      expect(within(sourceControl()).queryByText('Switch to the Mastra Factory apps')).not.toBeInTheDocument(),
    );
    expect(calls.switches).toBe(1);
    expect(
      within(rowOf('acme')).getByRole('link', { name: 'Manage Mastra Factory GitHub app connection' }),
    ).toBeInTheDocument();
    expect(within(sourceControl()).queryByRole('button', { name: 'Manage GitHub connection' })).not.toBeInTheDocument();
  });

  it('keeps the org on the legacy app when the server refuses the switch', async () => {
    const calls = serve({
      githubStatus: legacyStatus,
      switchStatus: {
        mode: 'legacy',
        switchedAt: null,
        connections: [],
        plan: { ready: true, missing: noneMissing() },
      },
      onSwitch: () => HttpResponse.json({ error: 'switch_blocked' }, { status: 409 }),
    });
    renderSourceControl();

    await within(sourceControl()).findByText('Switch to the Mastra Factory apps');
    const switchRow = rowOf('Switch to the Mastra Factory apps');
    await userEvent.click(within(switchRow).getByRole('button', { name: 'Switch' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Switch' }));

    await waitFor(() => expect(calls.switches).toBe(1));
    expect(within(sourceControl()).getByText('Switch to the Mastra Factory apps')).toBeInTheDocument();
    expect(within(rowOf('acme')).getByRole('button', { name: 'Manage GitHub connection' })).toBeInTheDocument();
  });
});
