import { http, HttpResponse } from 'msw';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import type { IntakeConfig, IntakeSelection } from '../../ui/domains/factory/services/intake';
import type { GitLabRepository } from '../../ui/domains/factory/services/gitlab';
import type { FactoryProject, GithubRepo } from '../../ui/domains/workspaces/services/github';
import {
  environmentPayload,
  environmentRepository,
} from '../../ui/domains/settings/components/__tests__/fixtures/environment';
import { useFactoryEnvironmentQuery } from '../useFactoryEnvironment';
import { useFactoriesQuery, useFactoryQuery, useLinkRepositoryMutation } from '../useFactories';
import { useIntakeConfigQuery } from '../useIntakeConfig';

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;

const repo: GithubRepo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
};

const gitlabRepo: GitLabRepository = {
  provider: 'gitlab',
  id: 'gitlab-project:encoded',
  externalId: '10',
  fullName: 'acme/app',
  name: 'app',
  owner: 'acme',
  defaultBranch: 'main',
  private: true,
};

const GITLAB_LINK_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-gl-1/repositories`;

/** Answers the GitLab registration, connection and link calls; `requests` collects their bodies in order. */
function stubGitlabLink(requests: unknown[], onLink: () => void = () => {}) {
  server.use(
    http.post(`${TEST_BASE_URL}/web/gitlab/projects/registration`, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({
        project: {
          id: 'gitlab-project:encoded',
          name: 'acme/app',
          projectId: '10',
          projectPath: 'acme/app',
          installationStorageId: 'gitlab-inst-1',
          defaultBranch: 'main',
        },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({ connection: { id: 'conn-gl-1' } }, { status: 201 });
    }),
    http.post(GITLAB_LINK_URL, async ({ request }) => {
      requests.push(await request.json());
      onLink();
      return HttpResponse.json({
        projectRepository: { id: 'glp-1', branch: 'main', repository: { slug: 'acme/app', defaultBranch: 'main' } },
      });
    }),
  );
}

function stubIntakeConfig(initial: Partial<IntakeConfig>) {
  let config: Partial<IntakeConfig> = initial;
  const saved: Array<Record<string, IntakeSelection>> = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put<never, Record<string, IntakeSelection>>(CONFIG_URL, async ({ request }) => {
      const next = await request.json();
      config = { ...config, ...next };
      saved.push(next);
      return HttpResponse.json({ config });
    }),
  );
  return {
    saved,
    /** What the server's link route does when it selects a GitHub repository itself. */
    serverSelects: (selection: IntakeSelection) => {
      config = { ...config, github: selection };
    },
  };
}

describe('useLinkRepositoryMutation', () => {
  it('links a GitLab project through its provider partition and feeds GitLab intake', async () => {
    const requests: unknown[] = [];
    stubGitlabLink(requests);
    const { saved } = stubIntakeConfig({ gitlab: { enabled: false, sourceIds: null } });
    const { client, result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo: gitlabRepo });

    await waitForMutationsIdle(client);
    expect(result.current.isSuccess).toBe(true);
    expect(requests).toEqual([
      { sourceId: 'gitlab-project:encoded' },
      { integrationId: 'gitlab', installationId: 'gitlab-inst-1' },
      { repository: { externalId: '10', slug: 'acme/app' }, branch: 'main', selectIntake: true },
    ]);
    expect(saved).toEqual([{ gitlab: { enabled: true, sourceIds: ['gitlab-project:encoded'] } }]);
  });

  it.each([
    { selectIntake: true, shown: ['octo/other', 'octo/hello'] },
    { selectIntake: false, shown: ['octo/other'] },
  ])(
    'given a GitHub repository linked with selectIntake $selectIntake, then the server owns the selection and the page shows its answer',
    async ({ selectIntake, shown }) => {
      const linkBodies: unknown[] = [];
      const intake = stubIntakeConfig({ github: { enabled: true, sourceIds: ['octo/other'] } });
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
          HttpResponse.json({ connections: [{ id: 'conn-1', installationId: 'inst-7', repositories: [] }] }),
        ),
        http.post(
          `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
          async ({ request }) => {
            const body = await request.json();
            linkBodies.push(body);
            if (selectIntake) intake.serverSelects({ enabled: true, sourceIds: ['octo/other', 'octo/hello'] });
            return HttpResponse.json({
              projectRepository: { id: 'ghp_1', branch: 'main', repository: { slug: 'octo/hello' } },
            });
          },
        ),
      );
      const { client, result } = renderHookWithProviders(() => ({
        link: useLinkRepositoryMutation(),
        intake: useIntakeConfigQuery(),
      }));
      await waitForMutationsIdle(client);

      result.current.link.mutate({ factoryProjectId: 'fp-1', repo, selectIntake });

      await waitForMutationsIdle(client);
      expect(result.current.link.isSuccess).toBe(true);
      expect(linkBodies).toEqual([
        { repository: { externalId: '99', slug: 'octo/hello' }, branch: 'main', selectIntake },
      ]);
      expect(intake.saved).toEqual([]);
      await waitFor(() => expect(result.current.intake.data?.github.sourceIds).toEqual(shown));
    },
  );

  it('given the GitLab intake write fails, when a project is linked, then the error surfaces and the Factory repositories still refresh', async () => {
    let linked = false;
    stubGitlabLink([], () => (linked = true));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({
          projects: [
            {
              id: 'fp-1',
              name: 'Acme',
              repositories: linked ? [listedRepository('glp-1', 'acme/app', { integrationId: 'gitlab' })] : [],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/environment`, () =>
        HttpResponse.json({
          environment: environmentPayload({
            repositories: linked ? [environmentRepository({ projectRepositoryId: 'glp-1', slug: 'acme/app' })] : [],
          }),
        }),
      ),
      http.get(CONFIG_URL, () => HttpResponse.json({ config: {} })),
      http.put(CONFIG_URL, () => HttpResponse.json({ error: 'invalid_config' }, { status: 400 })),
    );

    const { client, result } = renderHookWithProviders(() => ({
      link: useLinkRepositoryMutation(),
      factory: useFactoryQuery('fp-1'),
      environment: useFactoryEnvironmentQuery('fp-1'),
    }));
    await waitForMutationsIdle(client);
    expect(result.current.factory.data?.repositories).toEqual([]);

    result.current.link.mutate({ factoryProjectId: 'fp-1', repo: gitlabRepo });

    await waitForMutationsIdle(client);
    expect(result.current.link.error?.message).toBe('invalid_config');
    expect(result.current.factory.data?.repositories.map(repository => repository.slug)).toEqual(['acme/app']);
    expect(result.current.environment.data?.repositories.map(repository => repository.slug)).toEqual(['acme/app']);
  });

  it('given a GitLab link, when the intake config is slow, then the Factory list refresh starts without waiting for it', async () => {
    let linked = false;
    const events: string[] = [];
    let markRefresh!: () => void;
    const refreshStarted = new Promise<void>(resolve => (markRefresh = resolve));
    stubGitlabLink([], () => (linked = true));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, async () => {
        if (linked) {
          events.push('list refresh');
          markRefresh();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({
          projects: [
            {
              id: 'fp-1',
              name: 'Factory',
              repositories: linked ? [listedRepository('glp-1', 'acme/app', { integrationId: 'gitlab' })] : [],
            },
          ],
        });
      }),
      // Hold the intake read until the list refresh starts (or give up after 1s).
      http.get(CONFIG_URL, async () => {
        await Promise.race([refreshStarted, new Promise(resolve => setTimeout(resolve, 1_000))]);
        events.push('intake answered');
        return HttpResponse.json({ config: { gitlab: { enabled: true, sourceIds: ['gitlab-project:encoded'] } } });
      }),
    );

    const { client, result } = renderHookWithProviders(() => ({
      link: useLinkRepositoryMutation(),
      factories: useFactoriesQuery(),
    }));
    await waitForMutationsIdle(client);

    await act(() => result.current.link.mutateAsync({ factoryProjectId: 'fp-1', repo: gitlabRepo }));

    expect(events.slice(0, 2)).toEqual(['list refresh', 'intake answered']);
    const factories = client.getQueryData<FactoryProject[]>(queryKeys.factories());
    expect(factories?.[0]?.repositories.map(repository => repository.slug)).toEqual(['acme/app']);
  });
});

describe('useFactoriesQuery', () => {
  it('loads every Factory with its linked repositories from the project list alone', async () => {
    const requested: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      requested.push(new URL(request.url).pathname);
    };
    server.events.on('request:start', onRequest);
    onTestFinished(() => server.events.removeListener('request:start', onRequest));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({
          projects: [
            {
              id: 'fp-1',
              name: 'Acme',
              repositories: [
                listedRepository('ghp_1', 'octo/hello', { branch: 'release', externalId: '99' }),
                listedRepository('glp_1', 'acme/app', {
                  integrationId: 'gitlab',
                  connectionId: 'conn-gl-1',
                  defaultBranch: 'trunk',
                  externalId: '10',
                }),
                listedRepository('ghp_2', 'unused', { slug: null, defaultBranch: null }),
              ],
            },
            { id: 'fp-2', name: 'Empty', repositories: [] },
          ],
        }),
      ),
    );

    const { result } = renderHookWithProviders(() => useFactoriesQuery());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(({ id, repositories }) => ({ id, repositories }))).toEqual([
      {
        id: 'fp-1',
        repositories: [
          {
            projectRepositoryId: 'ghp_1',
            provider: 'github',
            externalId: '99',
            slug: 'octo/hello',
            gitBranch: 'release',
          },
          {
            projectRepositoryId: 'glp_1',
            provider: 'gitlab',
            externalId: '10',
            slug: 'acme/app',
            gitBranch: 'trunk',
          },
          {
            projectRepositoryId: 'ghp_2',
            provider: 'github',
            externalId: undefined,
            slug: 'Acme',
            gitBranch: undefined,
          },
        ],
      },
      { id: 'fp-2', repositories: [] },
    ]);
    expect(requested).toEqual(['/web/factory/projects']);
  });
});
