/**
 * Coverage for the one intake write onboarding makes once the Factory project exists: a GitLab
 * project is routed to the new Factory, since routed intake needs a binding to feed its board, and
 * a project another Factory already takes is refused rather than routed.
 *
 * GitHub needs nothing here, because the link already selected the repository — and when the Work
 * step's switch is off the link skips that selection, so neither endpoint is written at all.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { IntakeBindingConflictError } from '../../../factory/services/intake';
import type { IntakeBindingWrite } from '../../../factory/services/intake';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import { routeCodeHostIntake } from '../onboardingIntake';
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
function stubIntake() {
  const savedConfigs: unknown[] = [];
  const savedBindings: IntakeBindingWrite[] = [];
  server.use(
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
  routeCodeHostIntake(TEST_BASE_URL, { factoryProjectId: 'factory-1', repository });

describe('Code-host intake at the end of onboarding', () => {
  it('writes nothing for a GitHub repository, which the link already selected', async () => {
    const intake = stubIntake();

    await route(githubRepo);

    expect(intake.savedConfigs).toEqual([]);
    expect(intake.savedBindings).toEqual([]);
  });

  it('routes a GitLab project to the new Factory', async () => {
    const intake = stubIntake();

    await route(gitlabProject);

    expect(intake.savedBindings).toEqual([
      { integrationId: 'gitlab', sourceId: 'gitlab-source-1', factoryProjectId: 'factory-1' },
    ]);
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
