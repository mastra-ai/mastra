/**
 * Coverage for the one intake write onboarding makes once the Factory project exists: the Work
 * step's switch either keeps the codebase step's repository selected — routing GitLab projects to
 * the new Factory, since a routed source needs a binding — or drops it, and a project another
 * Factory already takes is never selected at all.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { IntakeBindingConflictError } from '../../../factory/services/intake';
import type { IntakeConfig, IntakeSelection, IntakeBindingWrite } from '../../../factory/services/intake';
import type { GitLabRepository } from '../../../factory/services/gitlab';
import { applyCodeHostIntake, codeHostSourceId, withoutIntakeSource } from '../onboardingIntake';
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
  fullName: 'acme/widgets',
  name: 'widgets',
  owner: 'acme',
  defaultBranch: 'main',
  private: true,
  installationStorageId: 'inst-9',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/widgets',
};

function configWith(selection: Partial<Record<'github' | 'gitlab', IntakeSelection>>): IntakeConfig {
  const empty: IntakeSelection = { enabled: false, sourceIds: null };
  return {
    github: selection.github ?? empty,
    gitlab: selection.gitlab ?? empty,
    linear: empty,
    jira: empty,
    incidentio: empty,
  };
}

/** Stub both intake endpoints, recording every write in the order the server saw it. */
function stubIntake(config: IntakeConfig, bindings: IntakeBindingWrite[] = []) {
  let stored = config;
  const writes: string[] = [];
  const savedConfigs: Array<Record<string, IntakeSelection>> = [];
  const savedBindings: IntakeBindingWrite[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config: stored })),
    http.put<Record<string, never>, Record<string, IntakeSelection>>(CONFIG_URL, async ({ request }) => {
      const body = await request.json();
      writes.push('config');
      savedConfigs.push(body);
      stored = { ...stored, ...body };
      return HttpResponse.json({ config: stored });
    }),
    http.put<Record<string, never>, IntakeBindingWrite>(BINDINGS_URL, async ({ request }) => {
      const body = await request.json();
      writes.push('binding');
      savedBindings.push(body);
      bindings.push({ ...body, factoryProjectId: body.factoryProjectId ?? '' });
      return HttpResponse.json({ bindings });
    }),
  );
  return { writes, savedConfigs, savedBindings };
}

const apply = (repository: SourceControlRepository, enabled: boolean) =>
  applyCodeHostIntake(TEST_BASE_URL, { factoryProjectId: 'factory-1', repository, enabled });

describe('Code-host intake at the end of onboarding', () => {
  it('selects a repository by its slug and a GitLab project by its source id', () => {
    expect(codeHostSourceId(githubRepo)).toBe('acme/widgets');
    expect(codeHostSourceId(gitlabProject)).toBe('gitlab-source-1');
  });

  it('drops one source without touching the others or the switch itself', () => {
    const selection: IntakeSelection = { enabled: true, sourceIds: ['acme/widgets', 'acme/other'] };

    expect(withoutIntakeSource(selection, 'acme/widgets')).toEqual({
      enabled: true,
      sourceIds: ['acme/other'],
    });
    expect(withoutIntakeSource(selection, 'acme/missing')).toBe(selection);
    expect(withoutIntakeSource({ enabled: false, sourceIds: null }, 'acme/widgets')).toEqual({
      enabled: false,
      sourceIds: null,
    });
  });

  it('writes nothing when linking already selected the repository', async () => {
    const intake = stubIntake(configWith({ github: { enabled: true, sourceIds: ['acme/widgets'] } }));

    await apply(githubRepo, true);

    expect(intake.savedConfigs).toEqual([]);
    expect(intake.savedBindings).toEqual([]);
  });

  it('takes the repository out of the selected sources when the switch is off', async () => {
    const intake = stubIntake(configWith({ github: { enabled: true, sourceIds: ['acme/other', 'acme/widgets'] } }));

    await apply(githubRepo, false);

    expect(intake.savedConfigs).toEqual([{ github: { enabled: true, sourceIds: ['acme/other'] } }]);
    expect(intake.savedBindings).toEqual([]);
  });

  it('leaves nothing selected when the repository was the only source', async () => {
    const intake = stubIntake(configWith({ github: { enabled: true, sourceIds: ['acme/widgets'] } }));

    await apply(githubRepo, false);

    expect(intake.savedConfigs).toEqual([{ github: { enabled: true, sourceIds: null } }]);
  });

  it('writes nothing when the switch is off and the repository was never selected', async () => {
    const intake = stubIntake(configWith({}));

    await apply(githubRepo, false);

    expect(intake.savedConfigs).toEqual([]);
    expect(intake.savedBindings).toEqual([]);
  });

  it('routes a GitLab project to the new Factory before it is selected', async () => {
    const intake = stubIntake(configWith({}));

    await apply(gitlabProject, true);

    expect(intake.savedBindings).toEqual([
      { integrationId: 'gitlab', sourceId: 'gitlab-source-1', factoryProjectId: 'factory-1' },
    ]);
    expect(intake.savedConfigs).toEqual([{ gitlab: { enabled: true, sourceIds: ['gitlab-source-1'] } }]);
    expect(intake.writes).toEqual(['binding', 'config']);
  });

  it('routes nothing when a GitLab project is switched off', async () => {
    const intake = stubIntake(configWith({ gitlab: { enabled: true, sourceIds: ['gitlab-source-1'] } }));

    await apply(gitlabProject, false);

    expect(intake.savedBindings).toEqual([]);
    expect(intake.savedConfigs).toEqual([{ gitlab: { enabled: true, sourceIds: null } }]);
  });

  it('fails before selecting a GitLab project another Factory already takes', async () => {
    const intake = stubIntake(configWith({}));
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

    const failure = await apply(gitlabProject, true).catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(IntakeBindingConflictError);
    expect((failure as IntakeBindingConflictError).conflicts).toEqual([
      { factoryProjectId: 'factory-other', labels: null },
    ]);
    expect(intake.savedConfigs).toEqual([]);
  });
});
