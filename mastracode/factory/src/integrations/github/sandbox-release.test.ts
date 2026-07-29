import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import type { MaterializationSandbox } from '../../sandbox/fleet.js';
import type { SourceControlSession } from '../../storage/domains/source-control/base.js';
import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { releaseWorkItemSandboxes } from './sandbox-release.js';

function workItem(sessions: Record<string, { sessionId: string }>): WorkItemRow {
  return {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    externalSource: null,
    parentWorkItemId: null,
    title: 'Fix the bug',
    stages: ['done'],
    stageHistory: [],
    sessions: Object.fromEntries(
      Object.entries(sessions).map(([role, session]) => [
        role,
        { ...session, branch: 'factory/issue-1', threadId: 'thread-1', startedBy: 'user-1' },
      ]),
    ),
    metadata: null,
    revision: 2,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function workItems(item: WorkItemRow | null): Pick<WorkItemsStorage, 'get'> {
  return { get: async () => item };
}

function fakeSandbox(calls: string[]): MaterializationSandbox {
  return {
    id: 'logical-id',
    start: async () => {},
    getInfo: async () => ({ metadata: {} }),
    executeCommand: async (command, args) => {
      calls.push(command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' '));
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  };
}

function fakeFleet(calls: string[]) {
  return { reattachSandbox: vi.fn(async () => fakeSandbox(calls)) };
}

/** Seed the installation → repository → connection → link chain behind a session. */
function seedRepositoryLink(storage: SourceControlStorageInMemory, { orgId = 'org-1' } = {}): void {
  const now = new Date();
  storage.installationsRows.push({
    id: 'install-1',
    integrationId: 'github',
    orgId,
    connectedByUserId: 'user-1',
    externalId: '7',
    accountName: 'acme',
    accountType: 'Organization',
    providerMetadata: {},
    createdAt: now,
  });
  storage.repositoriesRows.push({
    id: 'repo-1',
    installationId: 'install-1',
    externalId: '10',
    slug: 'acme/repo',
    defaultBranch: 'main',
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
  });
  storage.connectionsRows.push({
    id: 'connection-1',
    factoryProjectId: 'project-1',
    integrationId: 'github',
    installationId: 'install-1',
    createdByUserId: 'user-1',
    createdAt: now,
  });
  storage.projectRepositoriesRows.push({
    id: 'repo-link-1',
    connectionId: 'connection-1',
    repositoryId: 'repo-1',
    createdByUserId: 'user-1',
    branch: null,
    sandboxProvider: 'railway',
    sandboxWorkdir: '/workspace/mastra',
    setupCommand: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedSession(
  storage: SourceControlStorageInMemory,
  overrides: Partial<SourceControlSession> = {},
): Promise<SourceControlSession> {
  const session = await storage.sessions.create({
    sessionId: overrides.sessionId ?? randomUUID(),
    projectRepositoryId: overrides.projectRepositoryId ?? 'repo-link-1',
    orgId: overrides.orgId ?? 'org-1',
    userId: overrides.userId ?? 'user-1',
    branch: overrides.branch ?? 'factory/issue-1',
    baseBranch: 'main',
  });
  Object.assign(session, {
    sandboxId: overrides.sandboxId ?? null,
    sandboxWorkdir: overrides.sandboxWorkdir ?? null,
    materializedAt: overrides.materializedAt ?? null,
  });
  return session;
}

describe('releaseWorkItemSandboxes', () => {
  it('pools the sandboxes of every item session and clears their bindings', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage, {
      sandboxId: 'sandbox-1',
      sandboxWorkdir: '/workspace/mastra',
    });
    const item = workItem({
      triage: { sessionId: session.sessionId },
      work: { sessionId: session.sessionId },
    });

    await releaseWorkItemSandboxes({
      workItems: workItems(item),
      sourceControl: storage,
      fleet: fakeFleet([]),
      orgId: 'org-1',
      workItemId: item.id,
    });

    expect(storage.sandboxPoolRows).toEqual([
      expect.objectContaining({
        orgId: 'org-1',
        projectRepositoryId: 'repo-link-1',
        userId: 'user-1',
        sandboxId: 'sandbox-1',
        sandboxWorkdir: '/workspace/mastra',
      }),
    ]);
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBeNull();
  });

  it('scrubs the released workdir back to the default branch before pooling', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage, {
      sandboxId: 'sandbox-1',
      sandboxWorkdir: '/workspace/mastra',
    });
    const calls: string[] = [];
    const fleet = fakeFleet(calls);

    await releaseWorkItemSandboxes({
      workItems: workItems(workItem({ work: { sessionId: session.sessionId } })),
      sourceControl: storage,
      fleet,
      orgId: 'org-1',
      workItemId: 'item-1',
    });

    expect(fleet.reattachSandbox).toHaveBeenCalledWith('sandbox-1');
    expect(calls.some(script => script.includes('checkout -f') && script.includes('main'))).toBe(true);
    expect(calls.some(script => script.includes('reset --hard') && script.includes('clean -fdx'))).toBe(true);
    expect(storage.sandboxPoolRows).toHaveLength(1);
  });

  it('still pools the sandbox when the scrub cannot reach the VM', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage, {
      sandboxId: 'sandbox-reaped',
      sandboxWorkdir: '/workspace/mastra',
    });
    const fleet = { reattachSandbox: vi.fn(async () => Promise.reject(new Error('sandbox not found'))) };

    await releaseWorkItemSandboxes({
      workItems: workItems(workItem({ work: { sessionId: session.sessionId } })),
      sourceControl: storage,
      fleet,
      orgId: 'org-1',
      workItemId: 'item-1',
    });

    expect(fleet.reattachSandbox).toHaveBeenCalledWith('sandbox-reaped');
    expect(storage.sandboxPoolRows).toEqual([expect.objectContaining({ sandboxId: 'sandbox-reaped' })]);
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBeNull();
  });

  it('skips sessions without a sandbox binding, foreign-org sessions, and missing items', async () => {
    const storage = new SourceControlStorageInMemory();
    const unbound = await seedSession(storage, { branch: 'factory/issue-2' });
    const foreign = await seedSession(storage, {
      orgId: 'org-2',
      branch: 'factory/issue-3',
      sandboxId: 'sandbox-foreign',
      sandboxWorkdir: '/workspace/mastra',
    });
    const item = workItem({
      triage: { sessionId: unbound.sessionId },
      work: { sessionId: foreign.sessionId },
      review: { sessionId: 'missing-session' },
    });
    const fleet = fakeFleet([]);

    await releaseWorkItemSandboxes({
      workItems: workItems(item),
      sourceControl: storage,
      fleet,
      orgId: 'org-1',
      workItemId: item.id,
    });
    await releaseWorkItemSandboxes({
      workItems: workItems(null),
      sourceControl: storage,
      fleet,
      orgId: 'org-1',
      workItemId: 'missing-item',
    });

    expect(fleet.reattachSandbox).not.toHaveBeenCalled();
    expect(storage.sandboxPoolRows).toEqual([]);
    expect((await storage.sessions.getBySessionId(foreign.sessionId))?.sandboxId).toBe('sandbox-foreign');
  });
});
