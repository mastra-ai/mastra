import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { SessionRetirementCoordinator } from './session-retirement.js';
import { __clearSessionSandboxesForTests, getSessionSandbox, peekSessionSandbox } from './session-sandbox.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});

function workItem(sessionId: string): WorkItemRow {
  const session = { sessionId, branch: 'factory/issue-1', threadId: 'thread-1', startedBy: 'user-1' };
  return {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    externalSource: null,
    parentWorkItemId: null,
    title: 'Fix the bug',
    stages: ['done'],
    stageHistory: [],
    sessions: { work: session, review: session },
    metadata: null,
    revision: 2,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function workItems(item: WorkItemRow): Pick<WorkItemsStorage, 'get'> {
  return { get: async () => item };
}

function seedRepositoryLink(storage: SourceControlStorageInMemory, teardownCommand = 'pnpm local teardown'): void {
  const now = new Date();
  storage.installationsRows.push({
    id: 'install-1',
    integrationId: 'github',
    orgId: 'org-1',
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
    teardownCommand,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedSession(storage: SourceControlStorageInMemory): Promise<SourceControlSession> {
  return storage.sessions.create({
    sessionId: randomUUID(),
    projectRepositoryId: 'repo-link-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'factory/issue-1',
    baseBranch: 'main',
  });
}

/** Seed a live fake sandbox into the per-process session memo. */
function seedMemoSandbox(
  session: SourceControlSession,
  calls: string[],
  { teardownExitCode = 0, teardownStderr = 'teardown stderr', failStop = false } = {},
) {
  const fake = {
    id: `sbx-${session.id}`,
    provider: 'stub',
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {
      if (failStop) throw new Error('stop failed');
      calls.push('stop');
    }),
    destroy: vi.fn(async () => {
      if (failStop) throw new Error('destroy failed');
      calls.push('destroy');
    }),
    executeCommand: async (command: string, args?: string[]) => {
      const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
      calls.push(script);
      if (script.includes('pnpm local teardown')) {
        return { exitCode: teardownExitCode, stdout: 'teardown stdout', stderr: teardownStderr };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  };
  const entry = getSessionSandbox(session.id, 'acme/mastra', () => fake as never);
  // Model a sandbox whose first start already resolved the workdir.
  entry.workdir = '/workspace/mastra';
  return fake;
}

describe('SessionRetirementCoordinator', () => {
  it('runs remote teardown before stopping the sandbox, then invalidates', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const fake = seedMemoSandbox(session, calls);
    const invalidateSession = vi.fn(async () => calls.push('invalidate'));
    const coordinator = new SessionRetirementCoordinator({ invalidateSession });

    await coordinator.retireWorkItemSessions({
      workItems: workItems(workItem(session.sessionId)),
      sourceControl: storage,
      orgId: 'org-1',
      workItemId: 'item-1',
    });

    const teardownIndex = calls.findIndex(call => call.includes('pnpm local teardown'));
    expect(teardownIndex).toBeGreaterThanOrEqual(0);
    expect(calls.filter(call => call.includes('pnpm local teardown'))).toHaveLength(1);
    // Non-deleted sessions stop (VM can resume later); nothing destroys.
    expect(calls.indexOf('stop')).toBeGreaterThan(teardownIndex);
    expect(fake.destroy).not.toHaveBeenCalled();
    expect(calls.indexOf('invalidate')).toBeGreaterThan(calls.indexOf('stop'));
    // The memoized instance was dropped so a later open reconstructs.
    expect(peekSessionSandbox(session.id)).toBeUndefined();
    // The session row survives (deleteSession: false).
    expect(await storage.sessions.getBySessionId(session.sessionId)).not.toBeNull();
  });

  it('continues cleanup when the teardown command fails', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const fake = seedMemoSandbox(session, calls, {
      teardownExitCode: 17,
      teardownStderr: `failure-${'x'.repeat(3000)}`,
    });
    const warn = vi.fn();
    const coordinator = new SessionRetirementCoordinator({ invalidateSession: vi.fn(), warn });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });

    expect(warn).toHaveBeenCalledWith(
      'Factory teardown command failed',
      expect.objectContaining({
        sessionId: session.sessionId,
        projectRepositoryId: 'repo-link-1',
        error: expect.stringContaining('exit 17'),
      }),
    );
    expect((warn.mock.calls[0]?.[1] as { error: string }).error.length).toBeLessThanOrEqual(2000);
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(peekSessionSandbox(session.id)).toBeUndefined();
  });

  it('destroys the sandbox and deletes the session on destructive retirement', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const fake = seedMemoSandbox(session, calls);
    const coordinator = new SessionRetirementCoordinator({
      invalidateSession: vi.fn(async () => calls.push('invalidate')),
    });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    const teardownIndex = calls.findIndex(call => call.includes('pnpm local teardown'));
    expect(teardownIndex).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('destroy')).toBeGreaterThan(teardownIndex);
    expect(fake.stop).not.toHaveBeenCalled();
    expect(calls.indexOf('invalidate')).toBeGreaterThan(teardownIndex);
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
  });

  it('clears work-item session references when the session row is deleted, and leaves them when it is not', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const clearSessionReferences = vi.fn(async () => 1);
    const coordinator = new SessionRetirementCoordinator({ invalidateSession: vi.fn() });

    await coordinator.retireSession({
      sourceControl: storage,
      workItems: { clearSessionReferences },
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });
    expect(clearSessionReferences).not.toHaveBeenCalled();

    await coordinator.retireSession({
      sourceControl: storage,
      workItems: { clearSessionReferences },
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });
    expect(clearSessionReferences).toHaveBeenCalledWith({ orgId: 'org-1', sessionId: session.sessionId });
  });

  it('clears work-item references before the row dies, so a failed delete leaves nothing dangling', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const clearSessionReferences = vi.fn(async () => 1);
    vi.spyOn(storage.sessions, 'delete').mockRejectedValueOnce(new Error('db down'));
    const coordinator = new SessionRetirementCoordinator({ invalidateSession: vi.fn() });

    await expect(
      coordinator.retireSession({
        sourceControl: storage,
        workItems: { clearSessionReferences },
        orgId: 'org-1',
        sessionId: session.sessionId,
        deleteSession: true,
      }),
    ).rejects.toThrow('db down');

    expect(clearSessionReferences).toHaveBeenCalledTimes(1);
    expect(await storage.sessions.getBySessionId(session.sessionId)).not.toBeNull();
  });

  it('still invalidates and deletes when this process holds no sandbox for the session', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const invalidateSession = vi.fn();
    const coordinator = new SessionRetirementCoordinator({ invalidateSession });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(invalidateSession).toHaveBeenCalledWith(session.sessionId);
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
  });

  it('serializes duplicate retirement requests so teardown runs at most once', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    seedMemoSandbox(session, calls);
    const coordinator = new SessionRetirementCoordinator();
    const input = {
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    } as const;

    await Promise.all([coordinator.retireSession(input), coordinator.retireSession(input)]);

    expect(calls.filter(call => call.includes('pnpm local teardown'))).toHaveLength(1);
    expect(calls.filter(call => call === 'stop')).toHaveLength(1);
  });

  it('invalidates and deletes the session even when sandbox destruction fails', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const invalidateSession = vi.fn();
    const warn = vi.fn();
    seedMemoSandbox(session, [], { failStop: true });
    const coordinator = new SessionRetirementCoordinator({ invalidateSession, warn });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(warn).toHaveBeenCalledWith(
      'Factory session sandbox release failed',
      expect.objectContaining({ sessionId: session.sessionId }),
    );
    expect(invalidateSession).toHaveBeenCalledWith(session.sessionId);
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
  });
});
