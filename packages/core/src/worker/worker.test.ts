import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HarnessWakeupItem } from '../storage/domains/harness';
import { MastraWorker } from './worker';
import type { WorkerDeps } from './worker';
import { BackgroundTaskWorker } from './workers/background-task-worker';
import { HarnessWakeupWorker } from './workers/harness-wakeup-worker';
import { OrchestrationWorker } from './workers/orchestration-worker';
import { SchedulerWorker } from './workers/scheduler-worker';

function claimOpts(item: Pick<HarnessWakeupItem, 'claimId' | 'harnessName'>) {
  return expect.objectContaining({ claimId: item.claimId, harnessName: item.harnessName });
}

// Minimal mock for PubSub
function createMockPubSub() {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    getHistory: vi.fn().mockResolvedValue([]),
    subscribeWithReplay: vi.fn().mockResolvedValue(undefined),
    subscribeFromOffset: vi.fn().mockResolvedValue(undefined),
  };
}

// Minimal mock for storage
function createMockStorage() {
  return {
    id: 'test-storage',
    stores: {},
    disableInit: false,
    getStore: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
  };
}

// Minimal mock for logger
function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: vi.fn().mockReturnValue(new Map()),
    listLogs: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 0, perPage: 10, hasMore: false }),
    listLogsByRunId: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 0, perPage: 10, hasMore: false }),
  };
}

function createMockDeps(): WorkerDeps & { _pubsub: any; _storage: any; _logger: any } {
  const pubsub = createMockPubSub();
  const storage = createMockStorage();
  const logger = createMockLogger();
  return {
    pubsub: pubsub as any,
    storage: storage as any,
    logger: logger as any,
    _pubsub: pubsub,
    _storage: storage,
    _logger: logger,
  };
}

describe('MastraWorker (abstract)', () => {
  it('defines the expected interface', () => {
    // MastraWorker is abstract — verify it has the expected shape
    const worker = new OrchestrationWorker();
    expect(worker).toBeInstanceOf(MastraWorker);
    expect(worker.name).toBe('orchestration');
    expect(typeof worker.start).toBe('function');
    expect(typeof worker.stop).toBe('function');
    expect(typeof worker.__registerMastra).toBe('function');
  });
});

describe('OrchestrationWorker', () => {
  let worker: OrchestrationWorker;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it('requires Mastra for in-process mode', async () => {
    worker = new OrchestrationWorker();
    await expect(worker.init(deps)).rejects.toThrow('requires Mastra');
  });

  it('subscribes to PubSub in pull mode', async () => {
    worker = new OrchestrationWorker();
    const mastra = { getWorkflow: vi.fn(), getLogger: vi.fn().mockReturnValue(deps._logger) } as any;
    deps.mastra = mastra;
    await worker.init(deps);
    await worker.start();

    expect(worker.isRunning).toBe(true);
    expect(deps._pubsub.subscribe).toHaveBeenCalledWith('workflows', expect.any(Function), {
      group: 'mastra-orchestration',
    });
  });

  it('stop unsubscribes and is idempotent', async () => {
    worker = new OrchestrationWorker();
    const mastra = { getWorkflow: vi.fn(), getLogger: vi.fn().mockReturnValue(deps._logger) } as any;
    deps.mastra = mastra;
    await worker.init(deps);
    await worker.start();
    await worker.stop();
    expect(worker.isRunning).toBe(false);
    await worker.stop(); // idempotent
  });

  it('uses custom group', async () => {
    worker = new OrchestrationWorker({ group: 'my-group' });
    const mastra = { getWorkflow: vi.fn(), getLogger: vi.fn().mockReturnValue(deps._logger) } as any;
    deps.mastra = mastra;
    await worker.init(deps);
    await worker.start();

    expect(deps._pubsub.subscribe).toHaveBeenCalledWith('workflows', expect.any(Function), { group: 'my-group' });
  });
});

describe('SchedulerWorker', () => {
  it('gracefully skips when no schedules store', async () => {
    const worker = new SchedulerWorker();
    const deps = createMockDeps();
    await worker.init(deps);
    await worker.start();
    expect(worker.isRunning).toBe(true);
    expect(deps._logger.warn).toHaveBeenCalledWith(expect.stringContaining('no schedules store'));
  });

  it('start/stop are idempotent', async () => {
    const worker = new SchedulerWorker();
    const deps = createMockDeps();
    await worker.init(deps);
    await worker.start();
    await worker.start(); // idempotent
    await worker.stop();
    expect(worker.isRunning).toBe(false);
    await worker.stop(); // idempotent
  });
});

describe('BackgroundTaskWorker', () => {
  it('init constructs the manager but does not subscribe; start subscribes; stop tears down', async () => {
    const worker = new BackgroundTaskWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue({});
    deps.mastra = {
      getLogger: vi.fn().mockReturnValue(deps._logger),
      __hasInternalWorkflow: vi.fn().mockReturnValue(false),
      __registerInternalWorkflow: vi.fn(),
    } as any;

    await worker.init(deps);
    expect(worker.manager).toBeDefined();
    expect(worker.isRunning).toBe(false);
    // init() must not touch pubsub — that's what start() is for.
    expect(deps._pubsub.subscribe).not.toHaveBeenCalled();

    await worker.start();
    expect(worker.isRunning).toBe(true);
    // start() owns the manager here, so init(pubsub) ran and subscribed.
    expect(deps._pubsub.subscribe).toHaveBeenCalled();

    await worker.stop();
    expect(worker.isRunning).toBe(false);
    expect(deps._pubsub.unsubscribe).toHaveBeenCalled();
  });

  it('start() before init() throws', async () => {
    const worker = new BackgroundTaskWorker();
    await expect(worker.start()).rejects.toThrow('call init() before start()');
  });
});

describe('HarnessWakeupWorker', () => {
  it('rejects non-positive numeric configuration values', () => {
    const cases: Array<[string, ConstructorParameters<typeof HarnessWakeupWorker>[0]]> = [
      ['maxAttempts', { maxAttempts: 0 }],
      ['claimTtlMs', { claimTtlMs: 0 }],
      ['claimRenewMs', { claimRenewMs: 0 }],
      ['batchSize', { batchSize: 0 }],
      ['pollIntervalMs', { pollIntervalMs: 0 }],
      ['pollIntervalMs', { pollIntervalMs: Number.POSITIVE_INFINITY }],
      ['batchSize', { batchSize: 1.5 }],
    ];

    for (const [name, config] of cases) {
      expect(() => new HarnessWakeupWorker(config)).toThrow(`${name} must be a positive integer`);
    }
    expect(() => new HarnessWakeupWorker({ claimTtlMs: 10, claimRenewMs: 10 })).toThrow(
      'claimRenewMs must be less than claimTtlMs',
    );
    expect(() => new HarnessWakeupWorker({ claimTtlMs: 500 })).not.toThrow();
  });

  it('rejects invalid custom retry backoff results before persisting retry metadata', async () => {
    const item = sampleWakeup({ attempts: 2 });
    const storage = createWakeupStorage([item]);
    const worker = new HarnessWakeupWorker({ retryBackoffMs: () => Number.POSITIVE_INFINITY });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: vi
              .fn()
              .mockRejectedValue(Object.assign(new Error('locked'), { name: 'HarnessSessionLockedError' })),
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'unknown', retryable: false }),
      }),
      claimOpts(item),
    );
  });

  it('claims wakeups and marks them queued after durable queue admission', async () => {
    const item = sampleWakeup({
      failedAt: 100,
      deadAt: 101,
      nextAttemptAt: 102,
      lastError: { code: 'session_locked', message: 'locked', retryable: true },
    });
    const storage = createWakeupStorage([item]);
    const admit = vi.fn().mockResolvedValue({ accepted: true, queuedItemId: 'queued-1', duplicate: false });
    const worker = new HarnessWakeupWorker({ pollIntervalMs: 60_000 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: admit,
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await expect(worker.runOnce()).resolves.toBe(1);

    expect(storage.claimHarnessWakeupItems).toHaveBeenCalledWith(
      expect.objectContaining({ harnessName: 'default', statuses: ['due', 'failed', 'claimed'] }),
    );
    expect(admit).toHaveBeenCalledWith(expect.objectContaining({ admissionId: item.admissionId }));
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'queued',
        queuedItemId: 'queued-1',
        failedAt: undefined,
        deadAt: undefined,
        nextAttemptAt: undefined,
        lastError: undefined,
        claimId: undefined,
        claimExpiresAt: undefined,
        claimedAt: undefined,
      }),
      claimOpts(item),
    );
  });

  it('resolves wakeup sessions with both session and thread identity when available', async () => {
    const item = sampleWakeup();
    const storage = createWakeupStorage([item]);
    const session = vi.fn().mockResolvedValue({
      resourceId: item.resourceId,
      threadId: item.threadId,
      _admitWakeupQueue: vi.fn().mockResolvedValue({ accepted: true, queuedItemId: 'queued-1', duplicate: false }),
    });
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session,
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.loadSessionByThread).toHaveBeenCalledWith({
      harnessName: item.harnessName,
      threadId: item.threadId,
      resourceId: item.resourceId,
    });
    expect(session).toHaveBeenCalledWith({
      sessionId: item.sessionId,
      resourceId: item.resourceId,
    });
  });

  it('does not create sessions when stale wakeups have no active thread record', async () => {
    const item = sampleWakeup({ sessionId: 'stale-session' });
    const storage = createWakeupStorage([item]);
    storage.loadSessionByThread.mockResolvedValueOnce(null);
    const session = vi.fn();
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session,
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(session).not.toHaveBeenCalled();
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'worker_unavailable', retryable: false }),
      }),
      claimOpts(item),
    );
  });

  it('fails closed when a wakeup session resolves to a different thread', async () => {
    const item = sampleWakeup();
    const storage = createWakeupStorage([item]);
    const admit = vi.fn().mockResolvedValue({ accepted: true, queuedItemId: 'queued-1', duplicate: false });
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: 'other-thread',
            _admitWakeupQueue: admit,
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(admit).not.toHaveBeenCalled();
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'worker_unavailable', retryable: false }),
      }),
      claimOpts(item),
    );
  });

  it('does not retry wakeups that reference missing sessions', async () => {
    const item = sampleWakeup();
    const storage = createWakeupStorage([item]);
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi
            .fn()
            .mockRejectedValue(Object.assign(new Error('missing session'), { name: 'HarnessSessionNotFoundError' })),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'worker_unavailable', retryable: false }),
        nextAttemptAt: undefined,
      }),
      claimOpts(item),
    );
  });

  it('does not create sessions for wakeups without a session id', async () => {
    const item = sampleWakeup({ sessionId: undefined });
    const storage = createWakeupStorage([item]);
    const session = vi.fn();
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session,
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(session).not.toHaveBeenCalled();
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'worker_unavailable', retryable: false }),
      }),
      claimOpts(item),
    );
  });

  it('does not retry invalid persisted wakeup payloads', async () => {
    const item = sampleWakeup();
    const storage = createWakeupStorage([item]);
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: vi
              .fn()
              .mockRejectedValue(
                Object.assign(new Error('invalid wakeup payload'), { name: 'HarnessValidationError' }),
              ),
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'provider_payload_invalid', retryable: false }),
        nextAttemptAt: undefined,
      }),
      claimOpts(item),
    );
  });

  it('does not retry wakeups with unavailable attachment references', async () => {
    const item = sampleWakeup();
    const storage = createWakeupStorage([item]);
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: vi
              .fn()
              .mockRejectedValue(
                Object.assign(new Error('attachment missing'), { name: 'HarnessAttachmentUnavailableError' }),
              ),
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({ code: 'provider_payload_invalid', retryable: false }),
        nextAttemptAt: undefined,
      }),
      claimOpts(item),
    );
  });

  it('continues processing later harnesses when one harness claim fails', async () => {
    const item = sampleWakeup({ harnessName: 'good' });
    const badStorage = createWakeupStorage([]);
    badStorage.claimHarnessWakeupItems.mockRejectedValueOnce(new Error('bad storage unavailable'));
    const goodStorage = createWakeupStorage([item]);
    const admit = vi.fn().mockResolvedValue({ accepted: true, queuedItemId: 'queued-good', duplicate: false });
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps.mastra = {
      getHarnesses: () => ({
        bad: {
          _internalGetSessionStorage: () => badStorage,
          session: vi.fn(),
        },
        good: {
          _internalGetSessionStorage: () => goodStorage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: admit,
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await expect(worker.runOnce()).resolves.toBe(1);

    expect(deps._logger.error).toHaveBeenCalledWith(
      'HarnessWakeupWorker: failed to process harness wakeups',
      expect.objectContaining({ harnessName: 'bad' }),
    );
    expect(goodStorage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id, status: 'queued', queuedItemId: 'queued-good' }),
      claimOpts(item),
    );
  });

  it('fails closed when the internal wakeup admission path is unavailable', async () => {
    const item = sampleWakeup({
      attachments: [{ kind: 'url', name: 'remote.txt', mimeType: 'text/plain', url: 'https://example.test/a.txt' }],
    });
    const storage = createWakeupStorage([item]);
    const worker = new HarnessWakeupWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({ resourceId: item.resourceId, threadId: item.threadId }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        deadAt: expect.any(Number),
        lastError: expect.objectContaining({ code: 'worker_unavailable', retryable: false }),
      }),
      claimOpts(item),
    );
  });

  it('marks retryable failures failed with a later retry time', async () => {
    const item = sampleWakeup({ attempts: 2 });
    const storage = createWakeupStorage([item]);
    const retryBackoffMs = vi.fn(() => 1234);
    const worker = new HarnessWakeupWorker({ retryBackoffMs, maxAttempts: 5 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: vi
              .fn()
              .mockRejectedValue(Object.assign(new Error('locked'), { name: 'HarnessSessionLockedError' })),
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'failed',
        attempts: 2,
        nextAttemptAt: expect.any(Number),
        lastError: expect.objectContaining({ code: 'session_locked', retryable: true }),
        claimId: undefined,
      }),
      claimOpts(item),
    );
    // Storage increments attempts when the row is claimed; the worker must
    // persist the claimed attempt count instead of double-counting failures.
    expect(retryBackoffMs).toHaveBeenCalledWith(2);
  });

  it('renews ownership before admitting a claimed wakeup', async () => {
    const item = sampleWakeup();
    const storage = createWakeupStorage([item]);
    storage.renewHarnessWakeupClaim.mockRejectedValueOnce(new Error('expired claim'));
    const admit = vi.fn().mockResolvedValue({ accepted: true, queuedItemId: 'queued-late', duplicate: false });
    const worker = new HarnessWakeupWorker({ retryBackoffMs: () => 1234, maxAttempts: 5 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: admit,
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.renewHarnessWakeupClaim).toHaveBeenCalledWith(
      expect.objectContaining({ wakeupItemId: item.id, claimId: item.claimId }),
    );
    expect(admit).not.toHaveBeenCalled();
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'failed',
        lastError: expect.objectContaining({ code: 'unknown', retryable: true }),
      }),
      claimOpts(item),
    );
  });

  it('does not mark a wakeup failed after queue admission succeeds', async () => {
    const item = sampleWakeup({ attempts: 10 });
    const storage = createWakeupStorage([item]);
    storage.updateHarnessWakeupItem.mockRejectedValueOnce(new Error('lost claim after admission'));
    const admit = vi
      .fn()
      .mockResolvedValue({ accepted: true, queuedItemId: 'queued-after-update-loss', duplicate: false });
    const worker = new HarnessWakeupWorker({ maxAttempts: 10 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: admit,
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(admit).toHaveBeenCalledTimes(1);
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledTimes(1);
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id, status: 'queued', queuedItemId: 'queued-after-update-loss' }),
      claimOpts(item),
    );
    expect(deps._logger.error).toHaveBeenCalledWith(
      'HarnessWakeupWorker: failed to mark admitted wakeup queued',
      expect.objectContaining({ wakeupItemId: item.id, queuedItemId: 'queued-after-update-loss' }),
    );
  });

  it('reconciles existing durable queue admission before hydrating a session', async () => {
    const item = sampleWakeup({ admissionHash: 'admission-hash-1', attempts: 2 });
    const storage = createWakeupStorage([item]);
    storage.resolveOperationAdmissionEvidence.mockResolvedValueOnce({
      status: 'duplicate',
      storedAdmissionHash: item.admissionHash,
      evidence: {
        admissionId: item.admissionId,
        admissionHash: item.admissionHash,
        queuedItemId: 'queued-existing',
      },
    });
    const session = vi.fn().mockRejectedValue(new Error('session should not be hydrated for duplicate evidence'));
    const worker = new HarnessWakeupWorker({ maxAttempts: 10 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session,
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(session).not.toHaveBeenCalled();
    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id, status: 'queued', queuedItemId: 'queued-existing' }),
      claimOpts(item),
    );
  });

  it('dead-letters duplicate queue evidence that has no queued item id', async () => {
    const item = sampleWakeup({ admissionHash: 'admission-hash-1' });
    const storage = createWakeupStorage([item]);
    storage.resolveOperationAdmissionEvidence.mockResolvedValueOnce({
      status: 'duplicate',
      storedAdmissionHash: item.admissionHash,
      evidence: {
        admissionId: item.admissionId,
        admissionHash: item.admissionHash,
      },
    });
    const worker = new HarnessWakeupWorker({ maxAttempts: 10 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn(),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'dead',
        lastError: expect.objectContaining({
          code: 'provider_payload_invalid',
          retryable: false,
        }),
      }),
      claimOpts(item),
    );
    expect(storage.updateHarnessWakeupItem.mock.calls[0]?.[0].queuedItemId).toBeUndefined();
  });

  it('renews unprocessed wakeups while a claimed batch is waiting', async () => {
    vi.useFakeTimers();
    try {
      const first = sampleWakeup();
      const second = sampleWakeup({
        id: 'wakeup-2',
        sourceId: 'source-2',
        fireId: 'fire-2',
        idempotencyKey: 'wake-key-2',
        payloadHash: 'payload-hash-2',
        admissionId: 'wake-admission-2',
      });
      const storage = createWakeupStorage([first, second]);
      const admit = vi.fn().mockImplementation(async (item: HarnessWakeupItem) => {
        if (item.id === first.id) {
          await vi.advanceTimersByTimeAsync(2);
        }
        return { accepted: true, queuedItemId: `queued-${item.id}`, duplicate: false };
      });
      const worker = new HarnessWakeupWorker({ claimRenewMs: 1 });
      const deps = createMockDeps();
      deps._storage.getStore.mockResolvedValue(storage);
      deps.mastra = {
        getHarnesses: () => ({
          default: {
            _internalGetSessionStorage: () => storage,
            session: vi.fn().mockResolvedValue({
              resourceId: first.resourceId,
              threadId: first.threadId,
              _admitWakeupQueue: admit,
            }),
          },
        }),
      } as any;

      await worker.init(deps);
      await worker.runOnce();

      expect(storage.renewHarnessWakeupClaim).toHaveBeenCalledWith(
        expect.objectContaining({ wakeupItemId: second.id, claimId: second.claimId }),
      );
      expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: second.id, status: 'queued', queuedItemId: 'queued-wakeup-2' }),
        claimOpts(second),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs claim renewal loss after queue admission instead of failing admitted work', async () => {
    vi.useFakeTimers();
    try {
      const item = sampleWakeup();
      const storage = createWakeupStorage([item]);
      storage.renewHarnessWakeupClaim
        .mockResolvedValueOnce({ claimExpiresAt: Date.now() + 30_000, storageNow: Date.now() })
        .mockRejectedValueOnce(new Error('lost during admission'));
      const admit = vi.fn().mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(1);
        return { accepted: true, queuedItemId: 'queued-renewal-lost', duplicate: false };
      });
      const worker = new HarnessWakeupWorker({ claimRenewMs: 1 });
      const deps = createMockDeps();
      deps._storage.getStore.mockResolvedValue(storage);
      deps.mastra = {
        getHarnesses: () => ({
          default: {
            _internalGetSessionStorage: () => storage,
            session: vi.fn().mockResolvedValue({
              resourceId: item.resourceId,
              threadId: item.threadId,
              _admitWakeupQueue: admit,
            }),
          },
        }),
      } as any;

      await worker.init(deps);
      await worker.runOnce();

      expect(admit).toHaveBeenCalledTimes(1);
      expect(deps._logger.warn).toHaveBeenCalledWith(
        'HarnessWakeupWorker: wakeup claim renewal failed after queue admission',
        expect.objectContaining({ wakeupItemId: item.id, queuedItemId: 'queued-renewal-lost' }),
      );
      expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: item.id, status: 'queued', queuedItemId: 'queued-renewal-lost' }),
        claimOpts(item),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks exhausted or non-recoverable wakeups dead', async () => {
    const item = sampleWakeup({ attempts: 10 });
    const storage = createWakeupStorage([item]);
    const worker = new HarnessWakeupWorker({ maxAttempts: 10 });
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue(storage);
    deps.mastra = {
      getHarnesses: () => ({
        default: {
          _internalGetSessionStorage: () => storage,
          session: vi.fn().mockResolvedValue({
            resourceId: item.resourceId,
            threadId: item.threadId,
            _admitWakeupQueue: vi
              .fn()
              .mockRejectedValue(Object.assign(new Error('closed'), { name: 'HarnessSessionClosedError' })),
          }),
        },
      }),
    } as any;

    await worker.init(deps);
    await worker.runOnce();

    expect(storage.updateHarnessWakeupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'dead',
        deadAt: expect.any(Number),
        lastError: expect.objectContaining({ code: 'session_closed', retryable: false }),
        nextAttemptAt: undefined,
      }),
      claimOpts(item),
    );
  });

  it('start and stop manage polling without running before init', async () => {
    vi.useFakeTimers();
    try {
      const worker = new HarnessWakeupWorker({ pollIntervalMs: 10 });
      await expect(worker.start()).rejects.toThrow('call init() before start()');
      const deps = createMockDeps();
      deps.mastra = { getHarnesses: () => ({}) } as any;
      await worker.init(deps);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      vi.advanceTimersByTime(20);
      expect(deps._storage.getStore).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not keep an old polling loop alive across stop and restart', async () => {
    vi.useFakeTimers();
    try {
      let resolveClaim!: (items: HarnessWakeupItem[]) => void;
      const firstClaim = new Promise<HarnessWakeupItem[]>(resolve => {
        resolveClaim = resolve;
      });
      const storage = createWakeupStorage([]);
      storage.claimHarnessWakeupItems.mockReturnValueOnce(firstClaim).mockResolvedValue([]);
      const worker = new HarnessWakeupWorker({ pollIntervalMs: 1_000 });
      const deps = createMockDeps();
      deps._storage.getStore.mockResolvedValue(storage);
      deps.mastra = {
        getHarnesses: () => ({
          default: {
            _internalGetSessionStorage: () => storage,
            session: vi.fn(),
          },
        }),
      } as any;

      await worker.init(deps);
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(storage.claimHarnessWakeupItems).toHaveBeenCalledTimes(1);

      await worker.stop();
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);

      resolveClaim([]);
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);

      await worker.stop();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

function createWakeupStorage(items: HarnessWakeupItem[]) {
  return {
    claimHarnessWakeupItems: vi.fn().mockResolvedValue(items),
    renewHarnessWakeupClaim: vi.fn().mockResolvedValue({ claimExpiresAt: Date.now() + 30_000, storageNow: Date.now() }),
    resolveOperationAdmissionEvidence: vi.fn().mockResolvedValue({ status: 'none' }),
    loadSessionByThread: vi
      .fn()
      .mockImplementation(
        async ({ threadId, resourceId }: { harnessName?: string; threadId: string; resourceId: string }) => {
          const item = items.find(candidate => candidate.threadId === threadId && candidate.resourceId === resourceId);
          return item?.sessionId ? { id: item.sessionId, threadId, resourceId } : null;
        },
      ),
    updateHarnessWakeupItem: vi.fn().mockResolvedValue(undefined),
  };
}

function sampleWakeup(overrides: Partial<HarnessWakeupItem> = {}): HarnessWakeupItem {
  const now = Date.now();
  return {
    id: 'wakeup-1',
    harnessName: 'default',
    source: 'proactive',
    sourceId: 'source-1',
    fireId: 'fire-1',
    idempotencyKey: 'wake-key-1',
    payloadHash: 'payload-hash-1',
    admissionId: 'wake-admission-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionId: 'session-1',
    dueAt: now - 1,
    createdAt: now - 10,
    updatedAt: now,
    claimedAt: now,
    status: 'claimed',
    mode: 'default',
    attempts: 1,
    claimId: 'claim-1',
    claimExpiresAt: now + 30_000,
    requestContext: { metadata: { source: 'test' } },
    content: 'scheduled work',
    attachments: [],
    ...overrides,
  };
}
