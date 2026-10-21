import { randomUUID } from 'node:crypto';

import { MastraSandbox } from '@mastra/core/workspace';
import type { FactorySandbox, FactorySandboxContext, ProviderStatus, WorkspaceSandbox } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __clearSessionEnvironmentsForTests,
  recordSessionEnvironment,
} from '../session/environment-state-processor.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { SessionRetirementCoordinator } from './session-retirement.js';
import {
  __clearSessionSandboxesForTests,
  getSessionSandbox,
  hasFailedSetupCommand,
  peekSessionSandbox,
  recordFailedSetupCommand,
} from './session-sandbox.js';

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

/**
 * A real `MastraSandbox` subclass, so the base-class lifecycle (`_destroy()`
 * no-opping on `pending`, status transitions) is exercised, not faked.
 */
class RecordingSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'Recording sandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';
  readonly #calls: string[];
  readonly #label: string;
  readonly #destroyError: unknown;
  readonly #onDestroy: (() => void | Promise<void>) | undefined;

  constructor(
    calls: string[],
    label: string,
    options: { destroyError?: unknown; onDestroy?: () => void | Promise<void> } = {},
  ) {
    super({ name: 'Recording sandbox' });
    this.id = label;
    this.#calls = calls;
    this.#label = label;
    this.#destroyError = options.destroyError;
    this.#onDestroy = options.onDestroy;
  }

  async destroy(): Promise<void> {
    this.#calls.push(`destroy:${this.#label}`);
    await this.#onDestroy?.();
    if (this.#destroyError) throw this.#destroyError;
  }
}

/** A FactorySandbox whose `create()` hands recreate the given never-started instance. */
function detachedFactory(build: (ctx: FactorySandboxContext) => WorkspaceSandbox) {
  const create = vi.fn(build);
  return { provider: 'test', create } as never as FactorySandbox & { create: typeof create };
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const nextMacrotask = () => new Promise(resolve => setTimeout(resolve, 0));

describe('SessionRetirementCoordinator.recreateSessionSandbox', () => {
  async function seedStartedSession(storage: SourceControlStorageInMemory): Promise<SourceControlSession> {
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    await storage.sessions.setSandbox({ id: session.id, sandboxId: 'vm-old', sandboxWorkdir: '/workspace/mastra' });
    return (await storage.sessions.getBySessionId(session.sessionId))!;
  }

  async function persistedSandboxId(storage: SourceControlStorageInMemory, sessionId: string) {
    return (await storage.sessions.getBySessionId(sessionId))?.sandboxId;
  }

  function recreate(
    coordinator: SessionRetirementCoordinator,
    storage: SourceControlStorageInMemory,
    sessionId: string,
  ) {
    return coordinator.recreateSessionSandbox({ sourceControl: storage, orgId: 'org-1', sessionId });
  }

  it('destroys a never-started detached instance through its own destroy(), not the no-op lifecycle wrapper', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const detached = new RecordingSandbox(calls, 'detached');
    // Snapshot at call time: the in-memory store hands back a live row object.
    const constructedFrom: Array<Pick<FactorySandboxContext, 'sessionId' | 'sandboxId'>> = [];
    const coordinator = new SessionRetirementCoordinator({
      sandbox: detachedFactory(ctx => {
        constructedFrom.push({ sessionId: ctx.sessionId, sandboxId: ctx.sandboxId });
        return detached;
      }),
    });

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(detached).toBeInstanceOf(MastraSandbox);
    expect(constructedFrom).toEqual([{ sessionId: session.id, sandboxId: 'vm-old' }]);
    expect(calls).toEqual(['destroy:detached']);
    expect(await persistedSandboxId(storage, session.sessionId)).toBeNull();
  });

  it('destroys a pending memo instance directly and marks it destroyed so it cannot start again', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const memo = new RecordingSandbox(calls, 'memo');
    const lifecycleDestroy = vi.spyOn(memo, '_destroy');
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const detachedSandbox = detachedFactory(() => new RecordingSandbox([], 'detached'));
    const coordinator = new SessionRetirementCoordinator({ sandbox: detachedSandbox });

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(calls).toEqual(['destroy:memo']);
    expect(lifecycleDestroy).not.toHaveBeenCalled();
    expect(detachedSandbox.create).not.toHaveBeenCalled();
    expect(memo.status).toBe('destroyed');
    await expect(memo._start()).rejects.toThrow('Cannot start a destroyed sandbox');
  });

  it.each(['running', 'error'] as const)(
    'destroys a %s memo instance through the lifecycle wrapper, evicts it, and clears the persisted id',
    async status => {
      const storage = new SourceControlStorageInMemory();
      const session = await seedStartedSession(storage);
      const calls: string[] = [];
      const memo = new RecordingSandbox(calls, 'memo');
      memo.status = status;
      const lifecycleDestroy = vi.spyOn(memo, '_destroy');
      getSessionSandbox(session.id, 'acme/mastra', () => memo);
      const setSandbox = vi.spyOn(storage.sessions, 'setSandbox');
      const coordinator = new SessionRetirementCoordinator({
        sandbox: detachedFactory(() => new RecordingSandbox([], 'detached')),
      });

      await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

      expect(lifecycleDestroy).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(['destroy:memo']);
      expect(memo.status).toBe('destroyed');
      expect(peekSessionSandbox(session.id)).toBeUndefined();
      expect(setSandbox).toHaveBeenCalledWith({ id: session.id, sandboxId: null, sandboxWorkdir: '' });
      expect(await persistedSandboxId(storage, session.sessionId)).toBeNull();
    },
  );

  it('falls back to a detached destroy when the lifecycle destroy hangs, and releases the session lock', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const memo = new RecordingSandbox(calls, 'memo');
    memo.status = 'running';
    const hung = deferred();
    vi.spyOn(memo, '_destroy').mockReturnValue(hung.promise);
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const invalidateSession = vi.fn();
    const coordinator = new SessionRetirementCoordinator({
      invalidateSession,
      destroyTimeoutMs: 50,
      sandbox: detachedFactory(() => new RecordingSandbox(calls, 'detached')),
    });

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(calls).toEqual(['destroy:detached']);
    expect(memo.status).toBe('destroyed');
    expect(await persistedSandboxId(storage, session.sessionId)).toBeNull();

    // The lock was released: a retirement for the same session still runs.
    invalidateSession.mockClear();
    await coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });
    expect(invalidateSession).toHaveBeenCalledWith(session.sessionId);
    hung.resolve();
  });

  it('logs, without an unhandled rejection, when the abandoned lifecycle destroy rejects after the timeout', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const memo = new RecordingSandbox([], 'memo');
    memo.status = 'running';
    const hung = deferred();
    vi.spyOn(memo, '_destroy').mockReturnValue(hung.promise);
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const warn = vi.fn();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const coordinator = new SessionRetirementCoordinator({
        warn,
        destroyTimeoutMs: 50,
        sandbox: detachedFactory(() => new RecordingSandbox([], 'detached')),
      });
      await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

      hung.reject(new Error('late start failure'));
      await nextMacrotask();

      expect(warn).toHaveBeenCalledWith(
        'Factory sandbox destroy failed after recreate stopped waiting',
        expect.objectContaining({ sessionId: session.sessionId, error: 'late start failure' }),
      );
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('throws and keeps the persisted id when the lifecycle destroy times out and no detached sandbox can be built', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const memo = new RecordingSandbox([], 'memo');
    memo.status = 'running';
    const hung = deferred();
    vi.spyOn(memo, '_destroy').mockReturnValue(hung.promise);
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const setSandbox = vi.spyOn(storage.sessions, 'setSandbox');
    const coordinator = new SessionRetirementCoordinator({ destroyTimeoutMs: 50 });

    await expect(recreate(coordinator, storage, session.sessionId)).rejects.toThrow(/Timed out destroying/);

    expect(setSandbox).not.toHaveBeenCalled();
    expect(await persistedSandboxId(storage, session.sessionId)).toBe('vm-old');
    hung.resolve();
  });

  it.each([
    ['410', { status: 410 }],
    ['404 not_found', { status: 404, code: 'not_found' }],
    ['uncoded 404', { status: 404 }],
  ])('treats a %s from destroy as an already-gone VM', async (_label, destroyError) => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const memo = new RecordingSandbox([], 'memo', { destroyError });
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const coordinator = new SessionRetirementCoordinator();

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(memo.status).toBe('destroyed');
    expect(await persistedSandboxId(storage, session.sessionId)).toBeNull();
  });

  it('treats an already-gone VM reported through the lifecycle wrapper as destroyed, overriding its error status', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const memo = new RecordingSandbox([], 'memo', { destroyError: { status: 410 } });
    memo.status = 'running';
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const coordinator = new SessionRetirementCoordinator();

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(memo.status).toBe('destroyed');
    expect(await persistedSandboxId(storage, session.sessionId)).toBeNull();
  });

  it.each([
    ['routing 404', { status: 404, code: 'route_not_found' }],
    ['500', { status: 500 }],
    ['plain error', new Error('provider unavailable')],
  ])('propagates a %s from destroy and keeps the persisted id', async (_label, destroyError) => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const setSandbox = vi.spyOn(storage.sessions, 'setSandbox');
    const coordinator = new SessionRetirementCoordinator({
      sandbox: detachedFactory(() => new RecordingSandbox([], 'detached', { destroyError })),
    });

    await expect(recreate(coordinator, storage, session.sessionId)).rejects.toBe(destroyError);

    expect(setSandbox).not.toHaveBeenCalled();
    expect(await persistedSandboxId(storage, session.sessionId)).toBe('vm-old');
  });

  it('propagates a detached-construction failure and keeps the persisted id', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const coordinator = new SessionRetirementCoordinator({
      sandbox: detachedFactory(() => {
        throw new Error('environmentId is required');
      }),
    });

    await expect(recreate(coordinator, storage, session.sessionId)).rejects.toThrow('environmentId is required');
    expect(await persistedSandboxId(storage, session.sessionId)).toBe('vm-old');
  });

  it('never runs repository or environment teardown commands', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const fake = seedMemoSandbox(session, calls);
    recordSessionEnvironment(session.sessionId, { workingDirectory: '/workspace', repositories: [] }, [
      { slug: 'acme/mastra', dir: '/workspace/mastra', command: 'pnpm local teardown' },
    ]);
    const coordinator = new SessionRetirementCoordinator();

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(calls).toEqual(['destroy']);
    expect(fake.stop).not.toHaveBeenCalled();
  });

  it('invalidates before destroying and again after clearing the id, and survives an invalidation failure', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const invalidateSession = vi.fn(async (sessionId: string) => {
      calls.push(`invalidate:${sessionId}`);
      throw new Error('unregister failed');
    });
    const setSandbox = storage.sessions.setSandbox.bind(storage.sessions);
    vi.spyOn(storage.sessions, 'setSandbox').mockImplementation(async args => {
      calls.push('setSandbox');
      await setSandbox(args);
    });
    const warn = vi.fn();
    const coordinator = new SessionRetirementCoordinator({
      invalidateSession,
      warn,
      sandbox: detachedFactory(() => new RecordingSandbox(calls, 'detached')),
    });

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(calls).toEqual([
      `invalidate:${session.sessionId}`,
      'destroy:detached',
      'setSandbox',
      `invalidate:${session.sessionId}`,
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Factory session workspace cache invalidation failed',
      expect.objectContaining({ sessionId: session.sessionId, error: 'unregister failed' }),
    );
  });

  it('evicts a memo instance a concurrent resolve built while the destroy was running', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const memo = new RecordingSandbox(calls, 'memo', {
      onDestroy: () => {
        getSessionSandbox(session.id, 'acme/mastra', () => new RecordingSandbox(calls, 'rebuilt-from-old-id'));
      },
    });
    getSessionSandbox(session.id, 'acme/mastra', () => memo);
    const coordinator = new SessionRetirementCoordinator();

    await expect(recreate(coordinator, storage, session.sessionId)).resolves.toBe('recreated');

    expect(peekSessionSandbox(session.id)).toBeUndefined();
  });

  it('returns not-found for an unknown session or another org, destroying nothing', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const detachedSandbox = detachedFactory(() => new RecordingSandbox([], 'detached'));
    const coordinator = new SessionRetirementCoordinator({ sandbox: detachedSandbox });

    await expect(recreate(coordinator, storage, randomUUID())).resolves.toBe('not-found');
    await expect(
      coordinator.recreateSessionSandbox({ sourceControl: storage, orgId: 'org-2', sessionId: session.sessionId }),
    ).resolves.toBe('not-found');

    expect(detachedSandbox.create).not.toHaveBeenCalled();
    expect(await persistedSandboxId(storage, session.sessionId)).toBe('vm-old');
  });

  it('serializes with retirement of the same session', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const calls: string[] = [];
    const gate = deferred();
    const coordinator = new SessionRetirementCoordinator({
      invalidateSession: () => {
        calls.push('invalidate');
      },
      sandbox: detachedFactory(
        () =>
          new RecordingSandbox(calls, 'detached', {
            onDestroy: async () => {
              await gate.promise;
              calls.push('destroy-finished');
            },
          }),
      ),
    });

    const recreating = recreate(coordinator, storage, session.sessionId);
    const retiring = coordinator.retireSession({
      sourceControl: storage,
      orgId: 'org-1',
      sessionId: session.sessionId,
      deleteSession: false,
    });
    await nextMacrotask();
    expect(calls).toEqual(['invalidate', 'destroy:detached']);

    gate.resolve();
    await Promise.all([recreating, retiring]);

    expect(calls).toEqual(['invalidate', 'destroy:detached', 'destroy-finished', 'invalidate', 'invalidate']);
  });
});

/**
 * A sandbox backed by fake VMs: `start()` reattaches to its VM or provisions
 * a new one, `destroy()` deletes the VM, and commands report which VM ran
 * them. A real `MastraSandbox`, so `ensureRunning()` and the start hook run
 * as they do in production.
 */
class VmSandbox extends MastraSandbox {
  readonly id = 'vm-sandbox';
  readonly name = 'VM sandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';
  vmId: string | undefined;
  provisioned = 0;
  readonly deleted: string[] = [];
  destroyGate: Promise<void> | undefined;
  destroyError: unknown;
  startGate: Promise<void> | undefined;

  constructor(options: { vmId?: string; onStart?: () => Promise<void> } = {}) {
    super({ name: 'VM sandbox', onStart: options.onStart });
    this.vmId = options.vmId;
  }

  async start(): Promise<void> {
    await this.startGate;
    if (this.vmId) return;
    this.provisioned++;
    this.vmId = `vm-new-${this.provisioned}`;
  }

  async destroy(): Promise<void> {
    await this.destroyGate;
    if (this.destroyError) throw this.destroyError;
    if (this.vmId) this.deleted.push(this.vmId);
    this.vmId = undefined;
  }

  async executeCommand(): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    await this.ensureRunning();
    return { exitCode: 0, stdout: this.vmId ?? '', stderr: '' };
  }
}

describe('SessionRetirementCoordinator.resetSessionSandbox', () => {
  async function seedStartedSession(storage: SourceControlStorageInMemory): Promise<SourceControlSession> {
    seedRepositoryLink(storage);
    const session = await seedSession(storage);
    await storage.sessions.setSandbox({ id: session.id, sandboxId: 'vm-old', sandboxWorkdir: '/workspace/mastra' });
    return (await storage.sessions.getBySessionId(session.sessionId))!;
  }

  function reset(coordinator: SessionRetirementCoordinator, storage: SourceControlStorageInMemory, sessionId: string) {
    return coordinator.resetSessionSandbox({ sourceControl: storage, orgId: 'org-1', sessionId });
  }

  it('replaces the VM under the instance a run already holds, so its next command starts a fresh one and sets it up', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const setups: string[] = [];
    const sandbox: VmSandbox = new VmSandbox({
      vmId: 'vm-old',
      onStart: async () => {
        setups.push(sandbox.vmId!);
      },
    });
    const entry = getSessionSandbox(session.id, 'acme/mastra', () => sandbox);
    entry.workdir = '/workspace/mastra';
    expect((await sandbox.executeCommand()).stdout).toBe('vm-old');
    recordFailedSetupCommand(session.id, 'pnpm install');
    const invalidate = vi.fn();
    const coordinator = new SessionRetirementCoordinator({ invalidateSession: invalidate });

    await expect(reset(coordinator, storage, session.sessionId)).resolves.toBe('reset');

    expect(sandbox.deleted).toEqual(['vm-old']);
    expect(sandbox.status).toBe('stopped');
    expect(peekSessionSandbox(session.id)).toBe(entry);
    expect(entry.workdir).toBe('/workspace/mastra');
    expect(hasFailedSetupCommand(session.id, 'pnpm install')).toBe(false);
    const row = await storage.sessions.getBySessionId(session.sessionId);
    expect(row?.sandboxId).toBeNull();
    expect(row?.sandboxWorkdir).toBe('/workspace/mastra');
    // The start hook guards against retired sessions by generation; a reset must not retire it.
    expect(invalidate).not.toHaveBeenCalled();

    expect((await sandbox.executeCommand()).stdout).toBe('vm-new-1');
    expect(setups).toEqual(['vm-old', 'vm-new-1']);
  });

  it('replaces a VM whose start hook failed', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    let failSetup = true;
    const sandbox = new VmSandbox({
      vmId: 'vm-old',
      onStart: async () => {
        if (failSetup) throw new Error('The operation was aborted due to timeout');
      },
    });
    getSessionSandbox(session.id, 'acme/mastra', () => sandbox);
    await expect(sandbox.executeCommand()).rejects.toThrow('onStart hook failed');
    expect(sandbox.status).toBe('error');
    const coordinator = new SessionRetirementCoordinator();

    await expect(reset(coordinator, storage, session.sessionId)).resolves.toBe('reset');
    failSetup = false;

    expect((await sandbox.executeCommand()).stdout).toBe('vm-new-1');
  });

  it('waits for a start still running on the old VM before resetting, so it cannot overwrite the reset', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const hook = deferred();
    const sandbox = new VmSandbox({ vmId: 'vm-old', onStart: () => hook.promise });
    getSessionSandbox(session.id, 'acme/mastra', () => sandbox);
    const starting = sandbox.executeCommand();
    await nextMacrotask();
    const coordinator = new SessionRetirementCoordinator();

    const resetting = reset(coordinator, storage, session.sessionId);
    await nextMacrotask();
    expect(sandbox.deleted).toEqual(['vm-old']);
    // The old VM is gone, so its setup fails.
    hook.reject(new Error('sandbox not found'));
    await expect(starting).rejects.toThrow('onStart hook failed');

    await expect(resetting).resolves.toBe('reset');
    expect(sandbox.status).toBe('stopped');
  });

  it('deletes a VM that a start in flight provisioned after the old one was deleted', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const reattach = deferred();
    const sandbox = new VmSandbox({ vmId: 'vm-old' });
    sandbox.startGate = reattach.promise;
    getSessionSandbox(session.id, 'acme/mastra', () => sandbox);
    const starting = sandbox.executeCommand();
    await nextMacrotask();
    const coordinator = new SessionRetirementCoordinator();

    const resetting = reset(coordinator, storage, session.sessionId);
    await nextMacrotask();
    expect(sandbox.deleted).toEqual(['vm-old']);
    // The reattach finds the old VM gone and provisions a replacement.
    sandbox.startGate = undefined;
    reattach.resolve();
    expect((await starting).stdout).toBe('vm-new-1');

    await expect(resetting).resolves.toBe('reset');
    expect(sandbox.deleted).toEqual(['vm-old', 'vm-new-1']);
    expect(sandbox.status).toBe('stopped');
    expect((await sandbox.executeCommand()).stdout).toBe('vm-new-2');
  });

  it('treats a VM the provider already deleted as destroyed', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const sandbox = new VmSandbox({ vmId: 'vm-old' });
    sandbox.destroyError = Object.assign(new Error('Sandbox not found'), { status: 404, code: 'not_found' });
    getSessionSandbox(session.id, 'acme/mastra', () => sandbox);
    const coordinator = new SessionRetirementCoordinator();

    await expect(reset(coordinator, storage, session.sessionId)).resolves.toBe('reset');
    expect(sandbox.status).toBe('stopped');
  });

  it('fails, keeps the persisted id and releases the session lock when the destroy hangs', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const sandbox = new VmSandbox({ vmId: 'vm-old' });
    sandbox.destroyGate = new Promise(() => {});
    getSessionSandbox(session.id, 'acme/mastra', () => sandbox);
    const coordinator = new SessionRetirementCoordinator({ destroyTimeoutMs: 10 });

    await expect(reset(coordinator, storage, session.sessionId)).rejects.toThrow('Timed out destroying the sandbox');
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBe('vm-old');

    sandbox.destroyGate = undefined;
    await expect(reset(coordinator, storage, session.sessionId)).resolves.toBe('reset');
  });

  it('answers not-here without an instance in this process, and not-found for another org', async () => {
    const storage = new SourceControlStorageInMemory();
    const session = await seedStartedSession(storage);
    const coordinator = new SessionRetirementCoordinator();

    await expect(reset(coordinator, storage, session.sessionId)).resolves.toBe('not-here');
    getSessionSandbox(session.id, 'acme/mastra', () => new VmSandbox({ vmId: 'vm-old' }));
    await expect(
      coordinator.resetSessionSandbox({ sourceControl: storage, orgId: 'org-2', sessionId: session.sessionId }),
    ).resolves.toBe('not-found');
    expect((await storage.sessions.getBySessionId(session.sessionId))?.sandboxId).toBe('vm-old');
  });
});
