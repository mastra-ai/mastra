import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubStatus } from '../../../workspaces/services/github';
import { RepositoriesSection } from '../RepositoriesSection';
import { environmentPayload, environmentRepository } from './fixtures/environment';

const FACTORY_ID = 'fp-1';
const PRIMARY_PROJECT = 'rhys-group1/factory-validation-rhys-20260916/factory-gitlab-primary';

function repositoryEnvironment() {
  return environmentPayload({
    repositories: [environmentRepository({ projectRepositoryId: 'repo-1', slug: PRIMARY_PROJECT })],
  });
}

function renderRepositoriesSettings() {
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/repositories`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/repositories" element={<RepositoriesSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Repositories settings', () => {
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'factory-gitlab-primary' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, () =>
        HttpResponse.json({ environment: repositoryEnvironment() }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              integrationId: 'gitlab',
              installationId: 'inst-1',
              repositories: [
                {
                  id: 'repo-1',
                  branch: 'main',
                  sandboxWorkdir: '~/factory-gitlab-primary',
                  repository: { slug: PRIMARY_PROJECT, defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
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
        HttpResponse.json({
          enabled: true,
          configured: true,
          mode: 'platform',
          accounts: ['gitlab.com'],
          reauthRequired: false,
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/projects`, () => {
        return HttpResponse.json({
          projects: [
            {
              id: 'gitlab-project:control',
              name: 'rhys-group1/factory-validation-rhys-20260916/factory-gitlab-control',
              projectId: '20',
              projectPath: 'rhys-group1/factory-validation-rhys-20260916/factory-gitlab-control',
              installationStorageId: 'inst-1',
              accountLabel: 'gitlab.com',
              defaultBranch: 'main',
              sandboxProvider: 'custom',
              sandboxWorkdir: '~/factory-gitlab-control',
            },
          ],
        });
      }),
    );
  });

  it('keeps linked GitLab repositories visible while searching for another repository', async () => {
    const user = userEvent.setup();

    renderRepositoriesSettings();

    expect(await screen.findByText(PRIMARY_PROJECT)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Show settings for ${PRIMARY_PROJECT}` }));
    expect(screen.queryByRole('searchbox', { name: 'Search repositories' })).not.toBeInTheDocument();

    const addRepository = screen.getByRole<HTMLButtonElement>('button', { name: 'Add repository' });
    addRepository.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Add repository' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search repositories' })).toHaveFocus());
    expect(await screen.findByRole('button', { name: /Add .*factory-gitlab-control/ })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search repositories' }), 'no-match');
    expect(screen.getByText(PRIMARY_PROJECT)).toBeInTheDocument();
    expect(screen.getByText('No repositories match your search.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('searchbox', { name: 'Search repositories' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add repository' })).toHaveFocus();
    expect(screen.getByRole('switch', { name: `Clone ${PRIMARY_PROJECT} into every session` })).toBeChecked();
    await user.keyboard(' ');
    expect(await screen.findByRole('dialog', { name: 'Add repository' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage connections' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/connections`,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(addRepository).toHaveFocus());
    await user.click(addRepository);
    expect(await screen.findByRole('searchbox', { name: 'Search repositories' })).toHaveValue('');
  });

  it('keeps the drawer open through linking and a failed attempt, then refreshes the list after retry', async () => {
    const user = userEvent.setup();
    let releaseSave!: () => void;
    const savePending = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    let linked = false;
    let attempts = 0;
    const repository = {
      id: 'repo-2',
      branch: 'main',
      sandboxWorkdir: '~/widget',
      repository: { externalId: '42', slug: 'acme/widget', defaultBranch: 'main' },
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, installations: [], reason: 'ready' }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () =>
        HttpResponse.json({
          repos: [
            {
              id: 42,
              fullName: 'acme/widget',
              name: 'widget',
              owner: 'acme',
              defaultBranch: 'main',
              private: true,
              installationId: 1,
              installationStorageId: 'inst-1',
              sandboxProvider: 'custom',
              sandboxWorkdir: '~/widget',
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              integrationId: 'github',
              installationId: 'inst-1',
              repositories: linked ? [repository] : [],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, () =>
        HttpResponse.json({
          environment: environmentPayload({
            repositories: linked
              ? [environmentRepository({ projectRepositoryId: repository.id, slug: repository.repository.slug })]
              : [],
          }),
        }),
      ),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections/conn-1/repositories`,
        async () => {
          await savePending;
          attempts++;
          if (attempts === 1) return HttpResponse.json({ error: 'Link unavailable' }, { status: 503 });
          linked = true;
          return HttpResponse.json({ projectRepository: repository });
        },
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['acme/widget'] } } }),
      ),
    );

    renderRepositoriesSettings();
    await user.click(await screen.findByRole('button', { name: 'Add repository' }));
    await user.click(await screen.findByRole('button', { name: 'Add acme/widget' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('searchbox', { name: 'Search repositories' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Add repository' })).toBeInTheDocument();

    releaseSave();
    expect(await screen.findByText('Failed to link GitHub repository (503)')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add repository' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add acme/widget' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add repository' })).not.toBeInTheDocument());
    expect(await screen.findByRole('button', { name: 'Remove acme/widget' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add repository' })).toHaveFocus());
  });

  it('does not mistake an unsettled GitHub search or a failed request for an empty result', async () => {
    const user = userEvent.setup();
    let releaseSearch!: () => void;
    const searchPending = new Promise<void>(resolve => {
      releaseSearch = resolve;
    });
    const requests: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, installations: [], reason: 'ready' }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/repos`, async ({ request }) => {
        const query = new URL(request.url).searchParams.get('q') ?? '';
        requests.push(query);
        if (!query) return HttpResponse.json({ repos: [] });
        await searchPending;
        return HttpResponse.json({ error: 'Repository search unavailable' }, { status: 503 });
      }),
    );

    renderRepositoriesSettings();
    await user.click(await screen.findByRole('button', { name: 'Add repository' }));
    expect(await screen.findByRole('button', { name: /Add .*factory-gitlab-control/ })).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      const search = screen.getByRole('searchbox', { name: 'Search repositories' });
      fireEvent.change(search, { target: { value: 'r' } });
      fireEvent.change(search, { target: { value: 'rem' } });
      fireEvent.change(search, { target: { value: 'remote' } });
      expect(requests).toEqual(['']);
      expect(screen.getByRole('status', { name: 'Loading available repositories' })).toBeInTheDocument();
      expect(screen.queryByText(/No repositories match/)).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1000));
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(requests).toEqual(['', 'remote']));
    expect(screen.getByRole('status', { name: 'Loading available repositories' })).toBeInTheDocument();
    releaseSearch();
    expect(await screen.findByText(/Failed to list repos/)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading available repositories' })).not.toBeInTheDocument();
    expect(screen.queryByText(/No repositories match/)).not.toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search repositories' }));
    expect(screen.getByRole('button', { name: /Add .*factory-gitlab-control/ })).toBeInTheDocument();
    expect(screen.queryByText(/Failed to list repos/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading available repositories' })).not.toBeInTheDocument();
  });

  it('offers a GitLab retry instead of claiming no provider is configured when GitLab status fails', async () => {
    const user = userEvent.setup();
    let gitlabDown = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        gitlabDown
          ? HttpResponse.json({ error: 'GitLab status unavailable' }, { status: 503 })
          : HttpResponse.json({
              enabled: true,
              configured: true,
              mode: 'platform',
              accounts: ['gitlab.com'],
              reauthRequired: false,
              reason: 'ready',
            }),
      ),
    );

    renderRepositoriesSettings();
    await user.click(await screen.findByRole('button', { name: 'Add repository' }));
    expect(await screen.findByText('GitLab repositories could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/GitHub is disabled on the server/)).not.toBeInTheDocument();

    gitlabDown = false;
    await user.click(screen.getByRole('button', { name: 'Retry GitLab' }));
    expect(await screen.findByRole('button', { name: /Add .*factory-gitlab-control/ })).toBeInTheDocument();
    expect(screen.queryByText('GitLab repositories could not be loaded.')).not.toBeInTheDocument();
  });

  it('keeps GitHub repositories addable when an unusable install sits beside a usable one', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          installations: [{ installationId: 1, accountLogin: 'acme', accountType: 'Organization' }],
          unusableInstallations: [
            {
              installationId: 9,
              accountLogin: 'ada',
              accountType: 'User',
              unusableReason: 'linker_not_organization_member',
            },
          ],
          reason: 'ready',
        } satisfies GithubStatus),
      ),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () =>
        HttpResponse.json({
          repos: [
            {
              id: 42,
              fullName: 'acme/widget',
              name: 'widget',
              owner: 'acme',
              defaultBranch: 'main',
              private: true,
              installationId: 1,
              installationStorageId: 'inst-1',
              sandboxProvider: 'custom',
              sandboxWorkdir: '~/widget',
            },
          ],
        }),
      ),
    );

    renderRepositoriesSettings();
    await user.click(await screen.findByRole('button', { name: 'Add repository' }));
    expect(await screen.findByRole('button', { name: 'Add acme/widget' })).toBeEnabled();
    expect(screen.getByText(/The GitHub App on ada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install on a GitHub organization' })).not.toBeInTheDocument();
  });

  it.each([
    {
      situation: 'a hidden personal GitHub account install',
      status: {
        hiddenPersonalInstallReason: 'personal_install_requires_single_member_org',
        reason: 'personal_install_hidden',
      },
      action: 'Install on a GitHub organization',
    },
    {
      situation: 'an install with a reason this build does not know',
      status: {
        unusableInstallations: [
          {
            installationId: 9,
            accountLogin: 'ada',
            accountType: 'User',
            unusableReason: 'personal_installation_not_shared',
          },
        ],
        reason: 'installations_unusable',
      },
      action: 'Install on a GitHub organization',
    },
    {
      situation: 'an install whose linker membership could not be checked',
      status: {
        unusableInstallations: [
          {
            installationId: 9,
            accountLogin: 'ada',
            accountType: 'User',
            unusableReason: 'linker_membership_unavailable',
          },
        ],
        reason: 'installations_unusable',
      },
      action: 'Retry GitHub',
    },
  ] satisfies Array<{ situation: string; status: Partial<GithubStatus>; action: string }>)(
    'given only $situation, the picker explains it and offers $action instead of the generic connect hint',
    async ({ status, action }) => {
      const user = userEvent.setup();
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/status`, () =>
          HttpResponse.json({ enabled: true, connected: false, installations: [], ...status } satisfies GithubStatus),
        ),
        http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
          HttpResponse.json({ enabled: false, configured: false, reason: 'missing_config' }),
        ),
      );

      renderRepositoriesSettings();
      await user.click(await screen.findByRole('button', { name: 'Add repository' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add repository' });
      expect(await within(dialog).findByRole('button', { name: action })).toBeEnabled();
      expect(dialog).not.toHaveTextContent('undefined');
      expect(within(dialog).queryByText(/Connect GitHub or GitLab|No source-control provider/)).not.toBeInTheDocument();
    },
  );

  it('excludes a checkout without unlinking it, then removes only the requested repository with safe retry', async () => {
    const user = userEvent.setup();
    let linked = true;
    let environment = repositoryEnvironment();
    environment.repositories.push(
      environmentRepository({ projectRepositoryId: 'repo-2', slug: 'acme/other', position: 2 }),
    );
    const patches: unknown[] = [];
    let releaseRemoval!: () => void;
    const removalPending = new Promise<void>(resolve => {
      releaseRemoval = resolve;
    });
    let removals = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, () =>
        HttpResponse.json({ environment }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              integrationId: 'gitlab',
              installationId: 'inst-1',
              repositories: [
                ...(linked
                  ? [{ id: 'repo-1', branch: 'main', repository: { slug: PRIMARY_PROJECT, defaultBranch: 'main' } }]
                  : []),
                { id: 'repo-2', branch: 'main', repository: { slug: 'acme/other', defaultBranch: 'main' } },
              ],
            },
          ],
        }),
      ),
      http.patch(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, async ({ request }) => {
        patches.push(await request.json());
        environment = {
          ...environment,
          repositories: environment.repositories.map(repository =>
            repository.projectRepositoryId === 'repo-1' ? { ...repository, inEnvironment: false } : repository,
          ),
        };
        return HttpResponse.json({ environment });
      }),
      http.delete(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/repositories/repo-1`, async () => {
        removals++;
        if (removals === 1) {
          await removalPending;
          return HttpResponse.json({ error: 'Removal unavailable' }, { status: 503 });
        }
        linked = false;
        environment = {
          ...environment,
          repositories: environment.repositories.filter(repo => repo.projectRepositoryId !== 'repo-1'),
        };
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRepositoriesSettings();
    await user.click(await screen.findByRole('button', { name: `Show settings for ${PRIMARY_PROJECT}` }));
    const clone = screen.getByRole('switch', { name: `Clone ${PRIMARY_PROJECT} into every session` });
    await user.click(clone);
    await waitFor(() => expect(clone).not.toBeChecked());
    expect(screen.getByRole('button', { name: `Hide settings for ${PRIMARY_PROJECT}` })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(patches).toEqual([{ repositories: [{ projectRepositoryId: 'repo-1', inEnvironment: false }] }]);
    expect(removals).toBe(0);
    expect(screen.getByRole('button', { name: `Remove ${PRIMARY_PROJECT}` })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: `Remove ${PRIMARY_PROJECT}` })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Show settings for acme/other' }));
    await user.click(screen.getByRole('button', { name: `Remove ${PRIMARY_PROJECT}` }));
    expect(await screen.findByText('Removing…')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Clone acme/other into every session' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add repository' })).toBeDisabled();
    releaseRemoval();
    const primaryRow = screen.getByRole('group', { name: PRIMARY_PROJECT });
    expect(await within(primaryRow).findByText('Failed to unlink repository (503)')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'acme/other' })).queryByText(/Failed to unlink/),
    ).not.toBeInTheDocument();
    expect(clone).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: `Remove ${PRIMARY_PROJECT}` }));
    await waitFor(() => expect(screen.queryByText(PRIMARY_PROJECT)).not.toBeInTheDocument());
    expect(screen.getByText('acme/other')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add repository' })).toHaveFocus());
  });

  it('keeps the repositories on screen when refreshing the Factory list fails after a removal', async () => {
    const user = userEvent.setup();
    let environment = repositoryEnvironment();
    environment.repositories.push(
      environmentRepository({ projectRepositoryId: 'repo-2', slug: 'acme/other', position: 2 }),
    );
    let factoryRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => {
        factoryRequests++;
        return factoryRequests === 1
          ? HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'factory-gitlab-primary' }] })
          : HttpResponse.json({ error: 'Factories unavailable' }, { status: 503 });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, () =>
        HttpResponse.json({ environment }),
      ),
      http.delete(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/repositories/repo-1`, () => {
        environment = {
          ...environment,
          repositories: environment.repositories.filter(repo => repo.projectRepositoryId !== 'repo-1'),
        };
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRepositoriesSettings();
    await user.click(await screen.findByRole('button', { name: `Remove ${PRIMARY_PROJECT}` }));

    await waitFor(() => expect(factoryRequests).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add repository' })).toHaveFocus());
    expect(screen.queryByText(/Failed to list Factories/)).not.toBeInTheDocument();
    expect(screen.queryByText(PRIMARY_PROJECT)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'acme/other' })).toBeInTheDocument();
  });

  it('allows adding the first repository while configuration loads, and retries configuration failures without inventing rows', async () => {
    const user = userEvent.setup();
    let releaseEnvironment!: () => void;
    const environmentPending = new Promise<void>(resolve => {
      releaseEnvironment = resolve;
    });
    let fail = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, async () => {
        await environmentPending;
        return fail
          ? HttpResponse.json({ error: 'Repository configuration unavailable' }, { status: 503 })
          : HttpResponse.json({ environment: environmentPayload({ repositories: [] }) });
      }),
    );

    renderRepositoriesSettings();
    expect(await screen.findByRole('status', { name: 'Loading repository configuration' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add repository' }));
    expect(await screen.findByRole('button', { name: /Add .*factory-gitlab-control/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    releaseEnvironment();
    expect(await screen.findByText(/Failed to load environment/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add repository' })).toBeEnabled();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry repository configuration' }));
    await waitFor(() => expect(screen.queryByText(/Failed to load environment/)).not.toBeInTheDocument());
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add repository' })).toBeEnabled();
  });

  it('keeps linked repositories visible while repository discovery loads in the drawer', async () => {
    let releaseStatus!: () => void;
    const statusGate = new Promise<void>(resolve => (releaseStatus = resolve));
    let releaseRepos!: () => void;
    const reposGate = new Promise<void>(resolve => (releaseRepos = resolve));
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'personal-factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, () =>
        HttpResponse.json({
          environment: environmentPayload({
            repositories: [environmentRepository({ projectRepositoryId: 'repo-1', slug: 'octo/agent' })],
          }),
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              integrationId: 'github',
              installationId: 'inst-1',
              repositories: [
                {
                  id: 'repo-1',
                  branch: 'main',
                  sandboxWorkdir: '~/agent',
                  repository: { slug: 'octo/agent', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, async () => {
        await statusGate;
        return HttpResponse.json({ enabled: true, connected: true, reason: 'ready', installations: [] });
      }),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, accounts: [], reason: 'disabled' }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/pat`, () =>
        HttpResponse.json({ configured: false, reviewerConfigured: false }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/repos`, async () => {
        await reposGate;
        return HttpResponse.json({
          repos: [
            {
              id: 99,
              fullName: 'octo/hello',
              name: 'hello',
              owner: 'octo',
              defaultBranch: 'main',
              private: false,
              installationId: 7,
              installationStorageId: 'inst-7',
              sandboxProvider: 'none',
              sandboxWorkdir: '~/hello',
            },
          ],
        });
      }),
    );

    renderRepositoriesSettings();

    const linkedRepository = await screen.findByText('octo/agent');
    await userEvent.click(screen.getByRole('button', { name: 'Add repository' }));
    const drawer = within(await screen.findByRole('dialog', { name: 'Add repository' }));
    expect(drawer.getByRole('status', { name: 'Loading available repositories' })).toBeInTheDocument();
    expect(linkedRepository).toBeInTheDocument();

    releaseStatus();
    expect(await drawer.findByRole('button', { name: 'Refresh GitHub repositories' })).toBeInTheDocument();
    expect(drawer.getByRole('status', { name: 'Loading available repositories' })).toBeInTheDocument();

    releaseRepos();
    expect(await drawer.findByText('octo/hello')).toBeInTheDocument();
    expect(drawer.queryByRole('status', { name: 'Loading available repositories' })).not.toBeInTheDocument();
    expect(linkedRepository).toBeInTheDocument();
  });

  it('names the missing GitHub App env vars when no provider can list repositories', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: false, configured: false, accounts: [], reason: 'disabled' }),
      ),
    );
    const user = userEvent.setup();

    renderRepositoriesSettings();

    expect(await screen.findByRole('link', { name: 'Manage Factory' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/factory`,
    );
    await user.click(screen.getByRole('button', { name: 'Add repository' }));
    expect(
      await screen.findByText('GitHub is disabled on the server. Missing env vars: GITHUB_APP_ID.'),
    ).toBeInTheDocument();
  });
});
