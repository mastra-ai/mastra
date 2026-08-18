import { describe, expect, it, vi } from 'vitest';

import type { ParsedGithubWebhook } from '../integrations/github/webhook.js';
import type { ProjectRepository } from '../storage/domains/source-control/base.js';
import {
  baseCheckpointIsStale,
  classifyDefaultBranchUpdate,
  createBaseCheckpointTriggers,
  withBaseCheckpointWebhookTrigger,
} from './base-checkpoint-triggers.js';
import { hashSetupCommand } from './base-checkpoint.js';

const projectRepository = (overrides: Partial<ProjectRepository> = {}): ProjectRepository => ({
  id: 'pr-1',
  connectionId: 'conn-1',
  repositoryId: 'repo-1',
  createdByUserId: 'user-1',
  branch: 'main',
  sandboxProvider: 'platform',
  sandboxWorkdir: '/workspace/acme/app',
  setupCommand: 'pnpm install',
  teardownCommand: null,
  baseCheckpoint: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const webhook = (event: string, payload: Record<string, unknown>): ParsedGithubWebhook => ({
  event,
  deliveryId: 'd-1',
  payload,
});

const repoPayload = {
  repository: { id: 42, default_branch: 'main' },
  installation: { id: 7 },
};

describe('classifyDefaultBranchUpdate', () => {
  it('matches a PR merged into the default branch', () => {
    const parsed = webhook('pull_request', {
      ...repoPayload,
      action: 'closed',
      pull_request: { merged: true, base: { ref: 'main' } },
    });
    expect(classifyDefaultBranchUpdate(parsed)).toEqual({
      installationExternalId: '7',
      repositoryExternalId: '42',
    });
  });

  it('ignores a closed-unmerged PR and merges into other branches', () => {
    expect(
      classifyDefaultBranchUpdate(
        webhook('pull_request', {
          ...repoPayload,
          action: 'closed',
          pull_request: { merged: false, base: { ref: 'main' } },
        }),
      ),
    ).toBeNull();
    expect(
      classifyDefaultBranchUpdate(
        webhook('pull_request', {
          ...repoPayload,
          action: 'closed',
          pull_request: { merged: true, base: { ref: 'develop' } },
        }),
      ),
    ).toBeNull();
  });

  it('matches a push to the default branch and ignores other refs', () => {
    expect(classifyDefaultBranchUpdate(webhook('push', { ...repoPayload, ref: 'refs/heads/main' }))).toEqual({
      installationExternalId: '7',
      repositoryExternalId: '42',
    });
    expect(classifyDefaultBranchUpdate(webhook('push', { ...repoPayload, ref: 'refs/heads/feature' }))).toBeNull();
  });

  it('ignores unrelated events and payloads missing ids', () => {
    expect(classifyDefaultBranchUpdate(webhook('issues', { ...repoPayload, action: 'opened' }))).toBeNull();
    expect(classifyDefaultBranchUpdate(webhook('push', { ref: 'refs/heads/main' }))).toBeNull();
  });
});

describe('baseCheckpointIsStale', () => {
  it('is stale when no checkpoint exists', () => {
    expect(baseCheckpointIsStale(projectRepository())).toBe(true);
  });

  it('is stale when the setup command changed since the build', () => {
    const row = projectRepository({
      baseCheckpoint: {
        name: 'repo-pr-1',
        sha: 'abc',
        builtAt: new Date(),
        setupCommandHash: hashSetupCommand('old command'),
      },
    });
    expect(baseCheckpointIsStale(row)).toBe(true);
  });

  it('is fresh when the setup command hash matches', () => {
    const row = projectRepository({
      baseCheckpoint: {
        name: 'repo-pr-1',
        sha: 'abc',
        builtAt: new Date(),
        setupCommandHash: hashSetupCommand('pnpm install'),
      },
    });
    expect(baseCheckpointIsStale(row)).toBe(false);
  });
});

function triggerHarness(options: { stale?: boolean } = {}) {
  const row = projectRepository(
    options.stale === false
      ? {
          baseCheckpoint: {
            name: 'repo-pr-1',
            sha: 'abc',
            builtAt: new Date(),
            setupCommandHash: hashSetupCommand('pnpm install'),
          },
        }
      : {},
  );
  const request = vi.fn(async () => {});
  const builder = { request } as any;
  const storage = {
    repositories: {
      get: vi.fn(async () => ({ id: 'repo-1', slug: 'acme/app', defaultBranch: 'main' })),
    },
    projectRepositories: {
      listByExternalRepository: vi.fn(async () => [
        { orgId: 'org-1', factoryProjectId: 'proj-1', projectRepository: row },
      ]),
      listConfiguredExternalKeys: vi.fn(async () => [{ installationExternalId: '7', repositoryExternalId: '42' }]),
    },
  } as any;
  const fleet = {
    enabled: true,
    computeWorkdir: (slug: string) => `/workspace/${slug}`,
  } as any;
  const github = {
    sourceControlStorage: storage,
    versionControl: {
      getRepositoryAccess: vi.fn(async () => ({
        cloneUrl: 'https://github.com/acme/app.git',
        authorization: { scheme: 'bearer' as const, token: 'tok' },
      })),
    },
  };
  const triggers = createBaseCheckpointTriggers({ builder, fleet, github });
  return { triggers, request, storage, row };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('createBaseCheckpointTriggers', () => {
  it('requests a build on repo connect', async () => {
    const { triggers, request } = triggerHarness();
    triggers.onProjectRepositoryLinked({ orgId: 'org-1', projectRepository: projectRepository() });
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    const job = (request.mock.calls[0] as unknown[])[0] as any;
    expect(job.projectRepositoryId).toBe('pr-1');
    expect(job.repoFullName).toBe('acme/app');
    expect(job.defaultBranch).toBe('main');
    expect(job.workdir).toBe('/workspace/acme/app');
    await expect(job.getToken()).resolves.toBe('tok');
  });

  it('requests a rebuild for a default-branch merge webhook', async () => {
    const { triggers, request, storage } = triggerHarness();
    triggers.onWebhookEvent(
      webhook('pull_request', {
        ...repoPayload,
        action: 'closed',
        pull_request: { merged: true, base: { ref: 'main' } },
      }),
    );
    await flush();
    expect(storage.projectRepositories.listByExternalRepository).toHaveBeenCalledWith({
      installationExternalId: '7',
      repositoryExternalId: '42',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ignores non-trigger webhooks', async () => {
    const { triggers, request } = triggerHarness();
    triggers.onWebhookEvent(webhook('issues', { ...repoPayload, action: 'opened' }));
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('sweep rebuilds only stale checkpoints', async () => {
    const stale = triggerHarness();
    await stale.triggers.sweep();
    expect(stale.request).toHaveBeenCalledTimes(1);

    const fresh = triggerHarness({ stale: false });
    await fresh.triggers.sweep();
    expect(fresh.request).not.toHaveBeenCalled();
  });

  it('does nothing when the fleet is disabled', async () => {
    const request = vi.fn(async () => {});
    const { storage } = triggerHarness();
    const triggers = createBaseCheckpointTriggers({
      builder: { request } as any,
      fleet: { enabled: false, computeWorkdir: () => '/w' } as any,
      github: {
        sourceControlStorage: storage,
        versionControl: {
          getRepositoryAccess: vi.fn(async () => ({
            cloneUrl: 'https://github.com/acme/app.git',
            authorization: { scheme: 'bearer' as const, token: 'tok' },
          })),
        },
      },
    });
    triggers.onProjectRepositoryLinked({ orgId: 'org-1', projectRepository: projectRepository() });
    await flush();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('withBaseCheckpointWebhookTrigger', () => {
  it('feeds triggers and preserves the wrapped ingest result', async () => {
    const onWebhookEvent = vi.fn();
    const ingest = vi.fn(async () => ({ status: 'committed' }));
    const wrapped = withBaseCheckpointWebhookTrigger(ingest, {
      onWebhookEvent,
      onProjectRepositoryLinked: vi.fn(),
      sweep: vi.fn(async () => {}),
    });
    const parsed = webhook('push', { ...repoPayload, ref: 'refs/heads/main' });
    await expect(wrapped!(parsed)).resolves.toEqual({ status: 'committed' });
    expect(onWebhookEvent).toHaveBeenCalledWith(parsed);
    expect(ingest).toHaveBeenCalledWith(parsed);
  });

  it('returns the original ingest when no triggers exist', () => {
    const ingest = async () => undefined;
    expect(withBaseCheckpointWebhookTrigger(ingest, undefined)).toBe(ingest);
  });
});
