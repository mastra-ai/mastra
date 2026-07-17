import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';

// jsdom's `window.location.assign` is unforgeable (cannot be spied on), so the
// service-level navigation helper is stubbed; everything else stays real.
const connectGithubMock = vi.hoisted(() => vi.fn());
const manageGithubConnectionMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/github', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/github')>();
  return { ...actual, connectGithub: connectGithubMock, manageGithubConnection: manageGithubConnectionMock };
});
import { useFactoriesQuery } from '../../../../../../shared/hooks/useFactories';
import type { GithubRepo, GithubStatus } from '../../services/github';
import { loadFactories, saveFactories } from '../../services/factories';
import type { Factory } from '../../services/factories';
import { GithubConnectModal } from '../GithubConnectModal';

const ORIGIN = TEST_BASE_URL;

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 42, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

const repo: GithubRepo = {
  id: 100,
  fullName: 'mastra-ai/mastra',
  name: 'mastra',
  owner: 'mastra-ai',
  defaultBranch: 'main',
  private: false,
  installationId: 42,
};

const createdRepositoryPayload = {
  id: 'github-project-1',
  name: 'mastra-ai/mastra',
  source: 'github' as const,
  githubProjectId: 'github-project-1',
  createdAt: 1,
};

function renderModal(
  onFactoryCreated = vi.fn<(project: Factory) => void>(),
  client?: Parameters<typeof renderWithProviders>[1],
  status: GithubStatus = connectedStatus,
) {
  return {
    onFactoryCreated,
    ...renderWithProviders(
      createElement(GithubConnectModal, {
        status,
        onFactoryCreated,
        onClose: vi.fn(),
      }),
      client,
    ),
  };
}

describe('GithubConnectModal', () => {
  it('renders a skeleton placeholder while repositories load', async () => {
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, async () => {
        await delay(150);
        return HttpResponse.json({ repos: [repo] });
      }),
    );

    renderModal();

    expect(await screen.findByRole('status', { name: 'Loading repositories' })).toBeInTheDocument();
    expect(screen.queryByText(/Loading repositories/)).not.toBeInTheDocument();

    expect(await screen.findByText('mastra-ai/mastra')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading repositories' })).not.toBeInTheDocument();
  });

  it('loads connected repositories and re-queries when filtering', async () => {
    const requestedQueries: Array<string | null> = [];
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, ({ request }) => {
        const url = new URL(request.url);
        requestedQueries.push(url.searchParams.get('q'));
        return HttpResponse.json({ repos: [repo] });
      }),
    );

    renderModal();

    expect(await screen.findByText('mastra-ai/mastra')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Filter repositories…'), 'mastra');

    await waitFor(() => expect(requestedQueries).toContain('mastra'));
  });

  it('shows the repo loading error state', async () => {
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ error: 'unavailable' }, { status: 500 })),
    );

    renderModal();

    expect(await screen.findByText('Failed to list repos (500)')).toBeInTheDocument();
  });

  it('creates a GitHub project, persists it, notifies the caller, and refreshes projects query consumers', async () => {
    saveFactories([]);
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.post(`${ORIGIN}/web/github/repositories`, () => HttpResponse.json({ repository: createdRepositoryPayload })),
    );
    const projectsHook = renderHookWithProviders(() => useFactoriesQuery());
    const { onFactoryCreated } = renderModal(undefined, projectsHook.client);

    await userEvent.click(await screen.findByRole('button', { name: /mastra-ai\/mastra/i }));

    await waitFor(() => expect(loadFactories()).toHaveLength(1));
    const stored = loadFactories()[0]!;
    expect(stored).toMatchObject({
      name: 'mastra-ai/mastra',
      binding: { kind: 'github', githubProjectId: 'github-project-1' },
    });
    expect(stored.id).not.toBe('github-project-1');
    expect(onFactoryCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: stored.id,
        binding: expect.objectContaining({ kind: 'github', githubProjectId: 'github-project-1' }),
      }),
    );
    await waitFor(() => expect(projectsHook.result.current.data).toHaveLength(1));
  });

  it('shows create errors and does not persist the repo', async () => {
    saveFactories([]);
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.post(`${ORIGIN}/web/github/repositories`, () => HttpResponse.json({ error: 'failed' }, { status: 500 })),
    );

    renderModal();

    await userEvent.click(await screen.findByRole('button', { name: /mastra-ai\/mastra/i }));

    expect(await screen.findByText('Failed to create connected repository (500)')).toBeInTheDocument();
    expect(loadFactories()).toEqual([]);
  });

  it('offers a manage-connection button when connected that opens the GitHub install page', async () => {
    server.use(http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })));

    renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Manage GitHub connection' }));
    expect(manageGithubConnectionMock).toHaveBeenCalledWith(ORIGIN);
    expect(connectGithubMock).not.toHaveBeenCalled();
  });

  it('shows the missing-config callout with missing env var names and no connect button', () => {
    const missingConfigStatus: GithubStatus = {
      enabled: false,
      connected: false,
      installations: [],
      reason: 'missing_config',
      diagnostics: {
        githubAppConfigured: false,
        webAuthEnabled: true,
        appDbConfigured: true,
        stateSecretConfigured: true,
        sandboxEnabled: true,
        sandboxProvider: 'local',
        missingGithubAppEnvVars: ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'],
      },
    };

    renderModal(undefined, undefined, missingConfigStatus);

    expect(screen.getByText(/GitHub is disabled on the server/i)).toBeInTheDocument();
    expect(screen.getByText('GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY')).toBeInTheDocument();
    expect(screen.getByText(/restart/i)).toBeInTheDocument();
    // Connect button is hidden when the feature is disabled.
    expect(screen.queryByRole('button', { name: /Connect GitHub/i })).not.toBeInTheDocument();
  });

  it('shows the auth-required callout telling the user to sign in', () => {
    const authRequiredStatus: GithubStatus = {
      enabled: false,
      connected: false,
      installations: [],
      authRequired: true,
      reason: 'auth_required',
    };

    renderModal(undefined, undefined, authRequiredStatus);

    expect(screen.getByText(/sign in to use GitHub/i)).toBeInTheDocument();
  });

  it('shows the organization-required callout and no connect button', () => {
    const orgRequiredStatus: GithubStatus = {
      enabled: true,
      sandboxEnabled: true,
      organizationRequired: true,
      connected: false,
      installations: [],
      reason: 'organization_required',
    };

    renderModal(undefined, undefined, orgRequiredStatus);

    expect(screen.getByText(/no WorkOS organization/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect GitHub/i })).not.toBeInTheDocument();
  });

  it('shows the not-connected callout with the callback URL hint', () => {
    const notConnectedStatus: GithubStatus = {
      enabled: true,
      sandboxEnabled: true,
      connected: false,
      installations: [],
      reason: 'not_connected',
    };

    renderModal(undefined, undefined, notConnectedStatus);

    expect(screen.getByText(/isn't connected yet/i)).toBeInTheDocument();
    expect(screen.getByText('/auth/github/callback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect GitHub/i })).toBeInTheDocument();
  });

  it('shows the no-repos callout when connected but the repo list is empty', async () => {
    server.use(http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [] })));

    renderModal();

    expect(await screen.findByText(/installation may not have access/i)).toBeInTheDocument();
    expect(screen.getByText(/github.com\/settings\/installations/i)).toBeInTheDocument();
  });
});
