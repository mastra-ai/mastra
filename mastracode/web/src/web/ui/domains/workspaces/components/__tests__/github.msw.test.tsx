import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { useFactoriesQuery } from '../../../../../../shared/hooks/useFactories';
import { commitChanges, createUserSession, openPullRequest, pushBranch } from '../../services/github';
import type { GithubStatus, GitOpError } from '../../services/github';
import { isServerFactory, loadFactories } from '../../services/factories';
import type { ServerFactory } from '../../services/factories';
import { ConnectRepositoriesPanel } from '../ConnectRepositoriesPanel';

// The git-op helpers take the ApiConfig base URL explicitly, so handlers match
// against the same base the app injects (`TEST_BASE_URL` in the jsdom suite).
const ORIGIN = TEST_BASE_URL;
const PROJECT = 'proj-1';

function gitOpUrl(action: string): string {
  return `${ORIGIN}/web/github/projects/${PROJECT}/${action}`;
}

describe('github git-op helpers', () => {
  it('createUserSession posts branch/baseBranch and returns session metadata', async () => {
    let received: unknown;
    server.use(
      http.post(gitOpUrl('sessions'), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          session: {
            id: 'stored-session',
            sessionId: 'session-feat-x',
            projectRepositoryId: PROJECT,
            orgId: 'org-1',
            userId: 'user-1',
            branch: 'feat-x',
            baseBranch: 'main',
            sandboxId: null,
            sandboxWorkdir: null,
            materializedAt: null,
            createdAt: '2026-07-22T00:00:00.000Z',
            updatedAt: '2026-07-22T00:00:00.000Z',
          },
        });
      }),
    );

    const result = await createUserSession(TEST_BASE_URL, PROJECT, 'feat-x', 'main');

    expect(received).toEqual({ branch: 'feat-x', baseBranch: 'main' });
    expect(result.sessionId).toBe('session-feat-x');
    expect(result.branch).toBe('feat-x');
    expect(result.baseBranch).toBe('main');
  });

  it('commitChanges reports committed=false when nothing changed', async () => {
    server.use(http.post(gitOpUrl('commit'), () => HttpResponse.json({ committed: false })));
    const result = await commitChanges(TEST_BASE_URL, PROJECT, 'msg', 'session-feat-x');
    expect(result.committed).toBe(false);
  });

  it('pushBranch returns the pushed branch', async () => {
    let received: unknown;
    server.use(
      http.post(gitOpUrl('push'), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ pushed: true, branch: 'feat-x' });
      }),
    );
    const result = await pushBranch(TEST_BASE_URL, PROJECT, 'feat-x', 'session-feat-x');
    expect(received).toEqual({ branch: 'feat-x', sessionId: 'session-feat-x' });
    expect(result.pushed).toBe(true);
  });

  it('openPullRequest carries the originating session so the created PR is subscribed', async () => {
    let received: unknown;
    server.use(
      http.post(gitOpUrl('pr'), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ url: 'https://github.com/o/r/pull/7' });
      }),
    );
    const result = await openPullRequest(TEST_BASE_URL, PROJECT, {
      branch: 'feat-x',
      title: 'My PR',
      sessionId: 'session-1',
    });
    expect(received).toEqual({
      branch: 'feat-x',
      title: 'My PR',
      sessionId: 'session-1',
    });
    expect(result.url).toBe('https://github.com/o/r/pull/7');
  });

  it('surfaces the server error code/message on failure', async () => {
    server.use(
      http.post(gitOpUrl('sessions'), () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );
    await expect(createUserSession(TEST_BASE_URL, PROJECT, 'bad ref')).rejects.toMatchObject({
      code: 'Invalid branch',
      message: 'branch name is invalid',
      status: 400,
    });
  });

  it('flags authRequired on a 401', async () => {
    server.use(http.post(gitOpUrl('push'), () => new HttpResponse(null, { status: 401 })));
    let caught: GitOpError | undefined;
    try {
      await pushBranch(TEST_BASE_URL, PROJECT, 'feat-x', 'session-feat-x');
    } catch (e) {
      caught = e as GitOpError;
    }
    expect(caught?.authRequired).toBe(true);
    expect(caught?.status).toBe(401);
  });
});

/**
 * Cross-flow journey: a server-backed Factory starts with zero linked
 * repositories → the user links a GitHub repo from `ConnectRepositoriesPanel`
 * (ensure connection, then link) → hydration merges the new repository into
 * the stored factory by `projectRepositoryId`. This is the same wiring the
 * Board's empty state and Factory settings compose in the app.
 */
describe('factory repo-linking journey', () => {
  const connectedStatus: GithubStatus = {
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

  const emptyFactory: ServerFactory = {
    id: 'factory-1',
    name: 'My Factory',
    createdAt: 1,
    binding: {
      kind: 'factory',
      factoryProjectId: 'fp-1',
      repositories: [],
    },
  };

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Renders the panel against the live factories query so the link mutation's
   * invalidation flows back into the panel, like the Board empty state does.
   */
  function Journey() {
    const factories = useFactoriesQuery();
    const factory = factories.data?.filter(isServerFactory).find(candidate => candidate.id === emptyFactory.id);
    if (!factory) return <span>(no factory)</span>;
    return <ConnectRepositoriesPanel factory={factory} />;
  }

  it('given a connected user, when they link a repo, then the repository is linked under the Factory and persisted', async () => {
    localStorage.setItem('mastracode-factories', JSON.stringify([emptyFactory]));
    const linked: Array<{
      id: string;
      branch: string;
      sandboxWorkdir: string;
      repository: { slug: string; defaultBranch: string };
    }> = [];
    server.use(
      http.get(`${ORIGIN}/web/github/status`, () => HttpResponse.json(connectedStatus)),
      http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.get(`${ORIGIN}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'My Factory' }] }),
      ),
      http.get(`${ORIGIN}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({
          connections: linked.length > 0 ? [{ id: 'conn-1', installationId: 'inst-7', repositories: linked }] : [],
        }),
      ),
      http.post(`${ORIGIN}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connection: { id: 'conn-1' } }),
      ),
      http.post(
        `${ORIGIN}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
        async ({ request }) => {
          const body = (await request.json()) as { repositoryId: string; branch: string; sandboxWorkdir: string };
          expect(body.repositoryId).toBe('repo-99');
          const projectRepository = {
            id: 'ghp_1',
            branch: body.branch,
            sandboxWorkdir: body.sandboxWorkdir,
            repository: { slug: 'octo/hello', defaultBranch: 'main' },
          };
          linked.push(projectRepository);
          return HttpResponse.json({ projectRepository });
        },
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<Journey />);

    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    // The linked repo shows up in the panel's linked list (with unlink).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlink' })).toBeInTheDocument());

    // Hydration merged the repository into the stored factory by projectRepositoryId.
    await waitFor(() => {
      const stored = loadFactories().find(factory => factory.id === emptyFactory.id);
      expect(stored).toMatchObject({
        binding: {
          kind: 'factory',
          factoryProjectId: 'fp-1',
          repositories: [
            { projectRepositoryId: 'ghp_1', slug: 'octo/hello', gitBranch: 'main', sandboxWorkdir: '/workspace/hello' },
          ],
        },
      });
    });
  });
});
