import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { NEEDS_APPROVAL_LABEL, reconcileGithubAcceptanceLabels } from './acceptance-labels.js';
import type { GithubIntegration } from './integration.js';

async function setup(metadata: Record<string, unknown>, source: 'issue' | 'pull-request' = 'issue') {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Project 1' } });
  const item = (
    await seeded.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'github', type: source, externalId: `github-${source}:42` },
        title: 'Issue 42',
        stages: ['triage'],
        sessions: {},
        metadata,
      },
    })
  ).item;
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '7',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace',
  });
  const removeIssueLabel = vi.fn().mockResolvedValue(undefined);
  const github = { removeIssueLabel } as unknown as GithubIntegration;
  const run = () =>
    reconcileGithubAcceptanceLabels(github, sourceControl, { orgId: 'org-1', factoryProjectId: project.id, item });
  return { removeIssueLabel, run };
}

describe('reconcileGithubAcceptanceLabels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the needs-approval label on the linked issue through the project installation', async () => {
    const { removeIssueLabel, run } = await setup({ githubRepositoryId: 10, githubIssueNumber: 42 });
    await run();
    expect(removeIssueLabel).toHaveBeenCalledWith(7, 'acme/repo', 42, NEEDS_APPROVAL_LABEL);
  });

  it('skips cards that are not GitHub issues or lack intake stamps', async () => {
    const pr = await setup({ githubRepositoryId: 10, githubPullRequestNumber: 42 }, 'pull-request');
    await pr.run();
    expect(pr.removeIssueLabel).not.toHaveBeenCalled();
    const unstamped = await setup({});
    await unstamped.run();
    expect(unstamped.removeIssueLabel).not.toHaveBeenCalled();
  });

  it('skips repositories the project is not connected to', async () => {
    const { removeIssueLabel, run } = await setup({ githubRepositoryId: 99, githubIssueNumber: 42 });
    await run();
    expect(removeIssueLabel).not.toHaveBeenCalled();
  });

  it('never throws: a missing label is silent and other failures only warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = await setup({ githubRepositoryId: 10, githubIssueNumber: 42 });
    missing.removeIssueLabel.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(missing.run()).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();

    const failing = await setup({ githubRepositoryId: 10, githubIssueNumber: 42 });
    failing.removeIssueLabel.mockRejectedValueOnce(new Error('boom'));
    await expect(failing.run()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
