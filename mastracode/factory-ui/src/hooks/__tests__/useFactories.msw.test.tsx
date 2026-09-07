/**
 * BDD coverage for the repository link mutation. Every place that links a
 * repository to a Factory (onboarding, the wizard, Settings › Repositories)
 * routes through it, so this is where "a linked repository feeds the board"
 * is guaranteed.
 *
 * Drives the real services + React Query cache; only the network is mocked
 * (MSW) on the ApiConfig base URL the test providers inject.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { IntakeConfig } from '../../ui/domains/factory/services/intake';
import type { GithubRepo } from '../../ui/domains/workspaces/services/github';
import { useLinkRepositoryMutation } from '../useFactories';
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

/** Stateful intake config: each PUT becomes what the next GET returns. */
function stubIntakeConfig(initial: IntakeConfig) {
  let config = initial;
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put<never, IntakeConfig>(CONFIG_URL, async ({ request }) => {
      config = await request.json();
      saved.push(config);
      return HttpResponse.json({ config });
    }),
  );
  return saved;
}

describe('useLinkRepositoryMutation', () => {
  it('given a repository outside issue intake, when it is linked, then its issues feed the caller’s intake', async () => {
    stubRepositoryLink();
    const saved = stubIntakeConfig({
      github: { enabled: true, sourceIds: null },
      linear: { enabled: false, sourceIds: null },
    });

    const { result } = renderHookWithProviders(() => ({
      link: useLinkRepositoryMutation(),
      intake: useIntakeConfigQuery(),
    }));
    await waitFor(() => expect(result.current.intake.data).toBeDefined());

    result.current.link.mutate({ factoryProjectId: 'fp-1', repo });

    await waitFor(() => expect(result.current.link.isSuccess).toBe(true));
    expect(saved).toEqual([
      { github: { enabled: true, sourceIds: ['octo/hello'] }, linear: { enabled: false, sourceIds: null } },
    ]);
    expect(result.current.intake.data?.github.sourceIds).toEqual(['octo/hello']);
  });

  it('given GitHub intake switched off, when a repository is linked, then intake is switched back on for it', async () => {
    stubRepositoryLink();
    const saved = stubIntakeConfig({
      github: { enabled: false, sourceIds: ['octo/other'] },
      linear: { enabled: false, sourceIds: null },
    });

    const { result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saved).toEqual([
      {
        github: { enabled: true, sourceIds: ['octo/other', 'octo/hello'] },
        linear: { enabled: false, sourceIds: null },
      },
    ]);
  });

  it('given a repository already feeding issue intake, when it is linked again, then the selection is left alone', async () => {
    stubRepositoryLink();
    const saved = stubIntakeConfig({
      github: { enabled: true, sourceIds: ['octo/hello'] },
      linear: { enabled: false, sourceIds: null },
    });

    const { result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saved).toEqual([]);
  });

  it('given the intake write fails, when a repository is linked, then the link surfaces that error', async () => {
    stubRepositoryLink();
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json({ config: { github: { enabled: true, sourceIds: null } } })),
      http.put(CONFIG_URL, () => HttpResponse.json({ error: 'invalid_config' }, { status: 400 })),
    );

    const { result } = renderHookWithProviders(() => useLinkRepositoryMutation());

    result.current.mutate({ factoryProjectId: 'fp-1', repo });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('invalid_config');
  });
});
