import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { MaterializationSandbox } from './fleet.js';
import { SessionRetirementCoordinator } from './session-retirement.js';

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
  const session = await storage.sessions.create({
    sessionId: randomUUID(),
    projectRepositoryId: 'repo-link-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'factory/issue-1',
    baseBranch: 'main',
  });
  Object.assign(session, {
    sandboxId: 'sandbox-1',
    sandboxWorkdir: '/workspace/mastra',
    materializedAt: new Date(),
  });
  return session;
}

function sandbox(calls: string[], teardownExitCode = 0, teardownStderr = 'teardown stderr'): MaterializationSandbox {
  return {
    id: 'sandbox-1',
    start: async () => {},
    getInfo: async () => ({ metadata: {} }),
    executeCommand: async (command, args) => {
      const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
      calls.push(script);
      if (script.includes('pnpm local teardown')) {
        return { exitCode: teardownExitCode, stdout: 'teardown stdout', stderr: teardownStderr };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  };
}

describe('SessionRetirementCoordinator', () => {
  it('runs remote teardown once before scrub, pooling, and workspace invalidation', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const release = storage.sandboxPool.release;
    storage.sandboxPool.release = async input => {
      calls.push('pool');
      await release(input);
    };
    const invalidateSession = vi.fn(async () => calls.push('invalidate'));
    const reattachSandbox = vi.fn(async () => sandbox(calls));
    const coordinator = new SessionRetirementCoordinator({
      fleet: {
        provider: 'railway',
        reattachSandbox,
        teardownSandbox: vi.fn(),
      },
      invalidateSession,
    });

    await coordinator.retireWorkItemSessions({
      workItems: workItems(workItem(session.sessionId)),
      sourceControl: storage,
      orgId: 'org-1',
      workItemId: 'item-1',
    });

    expect(reattachSandbox).toHaveBeenCalledWith('sandbox-1', { actingUserId: 'user-1' });
    expect(calls.filter(call => call.includes('pnpm local teardown'))).toHaveLength(1);
    const teardownIndex = calls.findIndex(call => call.includes('pnpm local teardown'));
    const scrubIndex = calls.findIndex(call => call.includes('checkout -f') && call.includes('clean -fdx'));
    expect(teardownIndex).toBeGreaterThanOrEqual(0);
    expect(scrubIndex).toBeGreaterThan(teardownIndex);
    expect(calls.indexOf('pool')).toBeGreaterThan(scrubIndex);
    expect(calls.indexOf('invalidate')).toBeGreaterThan(calls.indexOf('pool'));
    expect(storage.sandboxPoolRows).toEqual([expect.objectContaining({ sandboxId: 'sandbox-1' })]);
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBeNull();
  });

  it('continues remote cleanup when teardown fails', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const warn = vi.fn();
    const coordinator = new SessionRetirementCoordinator({
      fleet: {
        provider: 'railway',
        reattachSandbox: vi.fn(async () => sandbox(calls, 17, `failure-${'x'.repeat(3000)}`)),
        teardownSandbox: vi.fn(),
      },
      invalidateSession: vi.fn(),
      warn,
    });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });

    expect(warn).toHaveBeenCalledWith(
      'Factory worktree teardown failed',
      expect.objectContaining({
        sessionId: session.sessionId,
        projectRepositoryId: 'repo-link-1',
        error: expect.stringContaining('exit 17'),
      }),
    );
    expect((warn.mock.calls[0]?.[1] as { error: string }).error.length).toBeLessThanOrEqual(2000);
    expect(storage.sandboxPoolRows).toHaveLength(1);
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBeNull();
  });

  it('runs local teardown before destroying the sandbox and deleting the session', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const liveSandbox = sandbox(calls);
    const teardownSandbox = vi.fn(async () => calls.push('destroy'));
    const coordinator = new SessionRetirementCoordinator({
      fleet: {
        provider: 'local',
        reattachSandbox: vi.fn(async () => liveSandbox),
        teardownSandbox,
      },
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
    expect(calls.indexOf('invalidate')).toBeGreaterThan(teardownIndex);
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
    expect(storage.sandboxPoolRows).toEqual([]);
  });

  it('still pools, clears, and invalidates when the remote sandbox cannot be reattached', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const warn = vi.fn();
    const invalidateSession = vi.fn();
    const coordinator = new SessionRetirementCoordinator({
      fleet: {
        provider: 'railway',
        reattachSandbox: vi.fn(async () => Promise.reject(new Error('sandbox not found'))),
        teardownSandbox: vi.fn(),
      },
      invalidateSession,
      warn,
    });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });

    expect(warn).toHaveBeenCalledWith(
      'Factory session sandbox could not be reattached for retirement',
      expect.objectContaining({ sessionId: session.sessionId, sandboxId: 'sandbox-1' }),
    );
    expect(storage.sandboxPoolRows).toEqual([expect.objectContaining({ sandboxId: 'sandbox-1' })]);
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBeNull();
    expect(invalidateSession).toHaveBeenCalledWith(session.sessionId);
  });

  it('serializes duplicate retirement requests so teardown is at most once per binding', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const coordinator = new SessionRetirementCoordinator({
      fleet: {
        provider: 'railway',
        reattachSandbox: vi.fn(async () => sandbox(calls)),
        teardownSandbox: vi.fn(),
      },
    });
    const input = {
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    } as const;

    await Promise.all([coordinator.retireSession(input), coordinator.retireSession(input)]);

    expect(calls.filter(call => call.includes('pnpm local teardown'))).toHaveLength(1);
    expect(storage.sandboxPoolRows).toHaveLength(1);
  });

  it('invalidates and deletes the session even when local sandbox destruction fails', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const invalidateSession = vi.fn();
    const warn = vi.fn();
    const coordinator = new SessionRetirementCoordinator({
      fleet: {
        provider: 'local',
        reattachSandbox: vi.fn(async () => sandbox([])),
        teardownSandbox: vi.fn(async () => Promise.reject(new Error('stop failed'))),
      },
      invalidateSession,
      warn,
    });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(warn).toHaveBeenCalledWith(
      'Factory local sandbox destruction failed',
      expect.objectContaining({ sessionId: session.sessionId }),
    );
    expect(invalidateSession).toHaveBeenCalledWith(session.sessionId);
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
  });
});
