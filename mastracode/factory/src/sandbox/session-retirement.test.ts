import { randomUUID } from 'node:crypto';

import type { FactorySandbox } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __clearSessionEnvironmentsForTests,
  recordSessionEnvironment,
} from '../session/environment-state-processor.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { SessionRetirementCoordinator } from './session-retirement.js';
import { __clearSessionSandboxesForTests, getSessionSandbox, peekSessionSandbox } from './session-sandbox.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
  __clearSessionEnvironmentsForTests();
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

/** A FactorySandbox whose created instances record what is called on them. */
function fakeFactorySandbox(calls: string[], { failDestroy = false } = {}) {
  const create = vi.fn((ctx: { sessionId: string; sandboxId?: string }) => ({
    status: 'pending',
    start: vi.fn(async () => {
      calls.push('start');
    }),
    _destroy: vi.fn(async () => {
      calls.push('_destroy');
    }),
    destroy: vi.fn(async () => {
      if (failDestroy) throw new Error('kill failed');
      calls.push(`destroy:${ctx.sessionId}:${ctx.sandboxId}`);
    }),
  }));
  return { provider: 'stub', create } as never as FactorySandbox & { create: typeof create };
}

describe('SessionRetirementCoordinator detached sandboxes', () => {
  async function materializedSession(storage: SourceControlStorageInMemory) {
    const session = await seedSession(storage);
    await storage.sessions.setSandbox({ id: session.id, sandboxId: 'vm-1', sandboxWorkdir: '/workspace/repo' });
    return (await storage.sessions.getBySessionId(session.sessionId))!;
  }

  it('destroys a deleted session VM this process never attached to', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await materializedSession(storage);
    const calls: string[] = [];
    const sandbox = fakeFactorySandbox(calls);

    await new SessionRetirementCoordinator({ sandbox }).retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(calls).toEqual([`destroy:${session.id}:vm-1`]);
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
    expect(peekSessionSandbox(session.id)).toBeUndefined();
  });

  it('does not construct a sandbox for a session that never materialized', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const sandbox = fakeFactorySandbox([]);

    await new SessionRetirementCoordinator({ sandbox }).retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(sandbox.create).not.toHaveBeenCalled();
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
  });

  it('does not construct a sandbox when the session is only retired', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await materializedSession(storage);
    const sandbox = fakeFactorySandbox([]);

    await new SessionRetirementCoordinator({ sandbox }).retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });

    expect(sandbox.create).not.toHaveBeenCalled();
    expect(await storage.sessions.getBySessionId(session.sessionId)).not.toBeNull();
  });

  it('still deletes the row when the detached destroy fails', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await materializedSession(storage);
    const warn = vi.fn();

    await new SessionRetirementCoordinator({
      sandbox: fakeFactorySandbox([], { failDestroy: true }),
      warn,
    }).retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(warn).toHaveBeenCalledWith(
      'Factory detached session sandbox destroy failed',
      expect.objectContaining({ error: 'kill failed' }),
    );
    expect(await storage.sessions.getBySessionId(session.sessionId)).toBeNull();
  });

  it('destroys a memoized sandbox that was constructed but never started here', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage, '');
    const session = await materializedSession(storage);
    const calls: string[] = [];
    const instance = fakeFactorySandbox(calls).create({ sessionId: session.id, sandboxId: 'vm-1' });
    getSessionSandbox(session.id, 'acme/repo', () => instance as never);

    await new SessionRetirementCoordinator().retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: true,
    });

    expect(calls).toEqual([`destroy:${session.id}:vm-1`]);
    expect(peekSessionSandbox(session.id)).toBeUndefined();
  });
});

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

  it('tears every environment repository down in position order, each in its own directory, and keeps going on failure', async () => {
    const storage = new SourceControlStorageInMemory();
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    const calls: string[] = [];
    const fake = seedMemoSandbox(session, calls);
    fake.executeCommand = async (command: string, args?: string[]) => {
      const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
      calls.push(script);
      if (script.includes('docs teardown')) return { exitCode: 3, stdout: '', stderr: 'docs failed' };
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    recordSessionEnvironment(session.sessionId, { workingDirectory: '/workspace', repositories: [] }, [
      { slug: 'acme/docs', dir: '/workspace/docs', command: 'docs teardown' },
      { slug: 'acme/mastra', dir: '/workspace/mastra', command: 'pnpm local teardown' },
    ]);
    const warn = vi.fn();
    const coordinator = new SessionRetirementCoordinator({ invalidateSession: vi.fn(), warn });

    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });

    const teardowns = calls.filter(call => call.includes('teardown'));
    expect(teardowns).toHaveLength(2);
    // Each command runs inside its own repository directory, docs first.
    expect(teardowns[0]).toMatch(/^cd '\/workspace\/docs' && \{ docs teardown/);
    expect(teardowns[1]).toMatch(/^cd '\/workspace\/mastra' && \{ pnpm local teardown/);
    expect(warn).toHaveBeenCalledWith(
      'Factory teardown command failed',
      expect.objectContaining({ repository: 'acme/docs', error: expect.stringContaining('exit 3') }),
    );
    expect(calls.indexOf('stop')).toBeGreaterThan(calls.findIndex(call => call.includes('pnpm local teardown')));
    expect(peekSessionSandbox(session.id)).toBeUndefined();
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
