import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraWorker } from './worker';
import type { WorkerDeps } from './worker';
import { BackgroundTaskWorker } from './workers/background-task-worker';
import { OrchestrationWorker } from './workers/orchestration-worker';
import { SchedulerWorker } from './workers/scheduler-worker';

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

  it('renews the delivery lease while a long event is handled, then acks', async () => {
    vi.useFakeTimers();
    try {
      const { WorkflowEventProcessor } = await import('../workflows/evented/workflow-event-processor');
      let finish!: () => void;
      const handleSpy = vi
        .spyOn(WorkflowEventProcessor.prototype, 'handle')
        .mockImplementation(() => new Promise(r => (finish = () => r({ ok: true }))));

      worker = new OrchestrationWorker({ leaseRenewIntervalMs: 100 });
      deps.mastra = { getWorkflow: vi.fn(), getLogger: vi.fn().mockReturnValue(deps._logger) } as any;
      await worker.init(deps);
      await worker.start();
      const cb = deps._pubsub.subscribe.mock.calls[0]![1];

      const ack = vi.fn().mockResolvedValue(undefined);
      const extend = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
      cb({ id: 'e1', type: 'workflow.step.run', runId: 'r1', data: {}, createdAt: new Date() }, ack, vi.fn(), extend);

      await vi.advanceTimersByTimeAsync(350);
      expect(extend).toHaveBeenCalledTimes(3);
      expect(ack).not.toHaveBeenCalled();

      finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(ack).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(500);
      expect(extend).toHaveBeenCalledTimes(3);
      handleSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
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

  it('creates a fresh manager when restarted after stop', async () => {
    const worker = new BackgroundTaskWorker();
    const deps = createMockDeps();
    deps._storage.getStore.mockResolvedValue({});
    deps.mastra = {
      getLogger: vi.fn().mockReturnValue(deps._logger),
      __hasInternalWorkflow: vi.fn().mockReturnValue(false),
      __registerInternalWorkflow: vi.fn(),
    } as any;

    await worker.init(deps);
    await worker.start();
    const firstManager = worker.manager;
    await worker.stop();
    await worker.start();

    expect(worker.isRunning).toBe(true);
    expect(worker.manager).not.toBe(firstManager);
    await worker.stop();
  });
});
