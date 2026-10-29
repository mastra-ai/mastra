import { http, HttpResponse } from 'msw';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import type { IntakeConfig } from '../../ui/domains/factory/services/intake';
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
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
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
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/app',
};

function stubRepositoryLink() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [{ id: 'conn-1', installationId: 'inst-7', repositories: [] }] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () =>
      HttpResponse.json({
        projectRepository: {
          id: 'ghp_1',
          branch: 'main',
          sandboxWorkdir: '/workspace/hello',
          repository: { slug: 'octo/hello', defaultBranch: 'main' },
        },
      }),
    ),
  );
}

function stubIntakeConfig(initial: Partial<IntakeConfig>) {
  let config: Partial<IntakeConfig> = initial;
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put<never, IntakeConfig>(CONFIG_URL, async ({ request }) => {
      const next = await request.json();
      config = next;
      saved.push(next);
      return HttpResponse.json({ config });
    }),
  );
  return saved;
}

describe('useLinkRepositoryMutation', () => {
  it('links a GitLab project through its provider partition and feeds GitLab intake', async () => {
    const requests: unknown[] = [];
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
            sandboxProvider: 'local',
            sandboxWorkdir: '/workspace/app',
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
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-gl-1/repositories`,
        async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json({
            projectRepository: {
              id: 'glp-1',
              branch: 'main',
              sandboxWorkdir: '/workspace/app',
              repository: { slug: 'acme/app', defaultBranch: 'main' },
            },
          });
        },
      ),
    );
    const saved = stubIntakeConfig({ gitlab: { enabled: false, sourceIds: null } });
    const { client, result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo: gitlabRepo });

    await waitForMutationsIdle(client);
    expect(result.current.isSuccess).toBe(true);
    expect(requests).toEqual([
      { sourceId: 'gitlab-project:encoded' },
      { integrationId: 'gitlab', installationId: 'gitlab-inst-1' },
      {
        repository: { externalId: '10', slug: 'acme/app' },
        branch: 'main',
        sandboxProvider: 'local',
        sandboxWorkdir: '/workspace/app',
      },
    ]);
    expect(saved).toEqual([
      {
        github: { enabled: false, sourceIds: null },
        linear: { enabled: false, sourceIds: null },
        gitlab: { enabled: true, sourceIds: ['gitlab-project:encoded'] },
        jira: { enabled: false, sourceIds: null },
        incidentio: { enabled: false, sourceIds: null },
      },
    ]);
  });

  it('given a repository outside issue intake, when it is linked, then its issues feed the caller’s intake', async () => {
    stubRepositoryLink();
    const saved = stubIntakeConfig({
      github: { enabled: true, sourceIds: null },
      linear: { enabled: false, sourceIds: null },
      gitlab: { enabled: false, sourceIds: null },
      jira: { enabled: false, sourceIds: null },
      incidentio: { enabled: false, sourceIds: null },
    });

    const { client, result } = renderHookWithProviders(() => ({
      link: useLinkRepositoryMutation(),
      intake: useIntakeConfigQuery(),
    }));
    await waitForMutationsIdle(client);

    result.current.link.mutate({ factoryProjectId: 'fp-1', repo });

    await waitForMutationsIdle(client);
    expect(result.current.link.isSuccess).toBe(true);
    expect(saved).toEqual([
      {
        github: { enabled: true, sourceIds: ['octo/hello'] },
        linear: { enabled: false, sourceIds: null },
        gitlab: { enabled: false, sourceIds: null },
        jira: { enabled: false, sourceIds: null },
        incidentio: { enabled: false, sourceIds: null },
      },
    ]);
    expect(result.current.intake.data?.github.sourceIds).toEqual(['octo/hello']);
  });

  it('given GitHub intake switched off, when a repository is linked, then intake is switched back on for it', async () => {
    stubRepositoryLink();
    const saved = stubIntakeConfig({
      github: { enabled: false, sourceIds: ['octo/other'] },
      linear: { enabled: false, sourceIds: null },
      gitlab: { enabled: false, sourceIds: null },
      jira: { enabled: false, sourceIds: null },
      incidentio: { enabled: false, sourceIds: null },
    });

    const { client, result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo });

    await waitForMutationsIdle(client);
    expect(result.current.isSuccess).toBe(true);
    expect(saved).toEqual([
      {
        github: { enabled: true, sourceIds: ['octo/other', 'octo/hello'] },
        linear: { enabled: false, sourceIds: null },
        gitlab: { enabled: false, sourceIds: null },
        jira: { enabled: false, sourceIds: null },
        incidentio: { enabled: false, sourceIds: null },
      },
    ]);
  });

  it('given a repository already feeding issue intake, when it is linked again, then the selection is left alone', async () => {
    stubRepositoryLink();
    const saved = stubIntakeConfig({
      github: { enabled: true, sourceIds: ['octo/hello'] },
      linear: { enabled: false, sourceIds: null },
      gitlab: { enabled: false, sourceIds: null },
      jira: { enabled: false, sourceIds: null },
      incidentio: { enabled: false, sourceIds: null },
    });

    const { client, result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo });

    await waitForMutationsIdle(client);
    expect(result.current.isSuccess).toBe(true);
    expect(saved).toEqual([]);
  });

  it('given the intake write fails, when a repository is linked, then the error surfaces and the Factory repositories still refresh', async () => {
    let linked = false;
    const projectRepository = {
      id: 'ghp_1',
      branch: 'main',
      sandboxWorkdir: '/workspace/hello',
      repository: { slug: 'octo/hello', defaultBranch: 'main' },
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Acme' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({
          connections: [{ id: 'conn-1', installationId: 'inst-7', repositories: linked ? [projectRepository] : [] }],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () => {
        linked = true;
        return HttpResponse.json({ projectRepository });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/environment`, () =>
        HttpResponse.json({
          environment: environmentPayload({
            repositories: linked ? [environmentRepository({ projectRepositoryId: 'ghp_1', slug: 'octo/hello' })] : [],
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
    expect(result.current.environment.data?.repositories).toEqual([]);

    result.current.link.mutate({ factoryProjectId: 'fp-1', repo });

    await waitForMutationsIdle(client);
    expect(result.current.link.error?.message).toBe('invalid_config');
    expect(result.current.factory.data?.repositories.map(repository => repository.slug)).toEqual(['octo/hello']);
    expect(result.current.environment.data?.repositories.map(repository => repository.slug)).toEqual(['octo/hello']);
  });

  it('given a link, when the intake config is slow, then the Factory list refresh starts without waiting for it', async () => {
    let linked = false;
    const events: string[] = [];
    let markRefresh!: () => void;
    const refreshStarted = new Promise<void>(resolve => (markRefresh = resolve));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Factory' }] });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () => {
        if (linked) {
          events.push('list refresh');
          markRefresh();
        }
        return HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              installationId: 'inst-7',
              repositories: linked ? [{ id: 'ghp_1', repository: { slug: 'octo/hello' } }] : [],
            },
          ],
        });
      }),
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () => {
        linked = true;
        return HttpResponse.json({ projectRepository: { id: 'ghp_1', repository: { slug: 'octo/hello' } } });
      }),
      // Hold the intake read until the list refresh starts (or give up after 1s).
      http.get(CONFIG_URL, async () => {
        await Promise.race([refreshStarted, new Promise(resolve => setTimeout(resolve, 1_000))]);
        events.push('intake answered');
        return HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['octo/hello'] } } });
      }),
    );

    const { client, result } = renderHookWithProviders(() => ({
      link: useLinkRepositoryMutation(),
      factories: useFactoriesQuery(),
    }));
    await waitForMutationsIdle(client);

    await act(() => result.current.link.mutateAsync({ factoryProjectId: 'fp-1', repo }));

    expect(events.slice(0, 2)).toEqual(['list refresh', 'intake answered']);
    const factories = client.getQueryData<FactoryProject[]>(queryKeys.factories());
    expect(factories?.[0]?.repositories.map(repository => repository.slug)).toEqual(['octo/hello']);
  });
});
