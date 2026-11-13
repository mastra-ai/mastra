/**
 * Coverage for the intake writes onboarding makes once the Factory project exists and the Work
 * step's switch is on: both hosts select the repository the same way, a GitLab project is routed
 * to the new Factory first, and a project another Factory already takes is refused before anything
 * is selected.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { IntakeBindingConflictError } from '../../../factory/services/intake';
import type { IntakeBindingWrite } from '../../../factory/services/intake';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import { applyCodeHostIntake } from '../onboardingIntake';
import type { GithubRepo, SourceControlRepository } from '../github';

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;

const githubRepo: GithubRepo = {
  id: 42,
  fullName: 'acme/widgets',
  name: 'widgets',
  owner: 'acme',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/widgets',
};

const gitlabProject: GitLabRepository = {
  provider: 'gitlab',
  id: 'gitlab-source-1',
  externalId: '4711',
  fullName: 'acme/platform',
  name: 'platform',
  owner: 'acme',
  defaultBranch: 'main',
  private: true,
  installationStorageId: 'inst-9',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/platform',
};

/** Stub both intake endpoints, so a write to either is recorded rather than reaching the network. */
function stubIntake(initial: Record<string, unknown> = {}) {
  const savedConfigs: unknown[] = [];
  const savedBindings: IntakeBindingWrite[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config: initial })),
    http.put(CONFIG_URL, async ({ request }) => {
      savedConfigs.push(await request.json());
      return HttpResponse.json({ config: {} });
    }),
    http.put<Record<string, never>, IntakeBindingWrite>(BINDINGS_URL, async ({ request }) => {
      savedBindings.push(await request.json());
      return HttpResponse.json({ bindings: [] });
    }),
  );
  return { savedConfigs, savedBindings };
}

const route = (repository: SourceControlRepository) =>
  applyCodeHostIntake(TEST_BASE_URL, { factoryProjectId: 'factory-1', repository });

describe('Code-host intake at the end of onboarding', () => {
  it('selects a GitHub repository as an issue source without routing it', async () => {
    const intake = stubIntake();

    await route(githubRepo);

    expect(intake.savedConfigs).toEqual([{ github: { enabled: true, sourceIds: ['acme/widgets'] } }]);
    expect(intake.savedBindings).toEqual([]);
  });

  it('routes a GitLab project to the new Factory and selects it', async () => {
    const intake = stubIntake();

    await route(gitlabProject);

    expect(intake.savedBindings).toEqual([
      { integrationId: 'gitlab', sourceId: 'gitlab-source-1', factoryProjectId: 'factory-1' },
    ]);
    expect(intake.savedConfigs).toEqual([{ gitlab: { enabled: true, sourceIds: ['gitlab-source-1'] } }]);
  });

  it('keeps sources other members picked and skips the write when the repository is already selected', async () => {
    const intake = stubIntake({ github: { enabled: true, sourceIds: ['acme/widgets', 'acme/other'] } });

    await route(githubRepo);

    expect(intake.savedConfigs).toEqual([]);
  });

  it('refuses a GitLab project another Factory already takes', async () => {
    const intake = stubIntake();
    server.use(
      http.put(BINDINGS_URL, () =>
        HttpResponse.json(
          {
            error: 'binding_conflict',
            message: 'Another factory already takes all issues from this source.',
            conflicts: [{ factoryProjectId: 'factory-other', labels: null }],
          },
          { status: 409 },
        ),
      ),
    );

    const failure = await route(gitlabProject).catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(IntakeBindingConflictError);
    expect((failure as IntakeBindingConflictError).conflicts).toEqual([
      { factoryProjectId: 'factory-other', labels: null },
    ]);
    expect(intake.savedConfigs).toEqual([]);
  });
});
