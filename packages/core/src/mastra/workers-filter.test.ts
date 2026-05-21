import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PubSub } from '../events/pubsub';
import type { Event, EventCallback, SubscribeOptions } from '../events/types';
import { Harness } from '../harness/v1/harness';
import { InMemoryHarness } from '../storage/domains/harness/inmemory';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { MockStore } from '../storage/mock';
import { HarnessWakeupWorker, MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';
import { Mastra } from './index';

const ORIGINAL_ENV = process.env.MASTRA_WORKERS;

class StartupCleanupPubSub extends PubSub {
  failSubscribeTopic?: string;
  failNextUnsubscribeTopic?: string;
  gateSubscribeTopic?: string;
  readonly subscribeCalls: string[] = [];
  readonly unsubscribeCalls: string[] = [];
  #subscribeGateStarted?: () => void;
  #releaseSubscribeGate?: () => void;
  subscribeGateStarted = Promise.resolve();

  override get supportedModes(): ReadonlyArray<'push'> {
    return ['push'];
  }

  resetSubscribeGate(): void {
    this.subscribeGateStarted = new Promise<void>(resolve => {
      this.#subscribeGateStarted = resolve;
    });
  }

  releaseSubscribeGate(): void {
    this.#releaseSubscribeGate?.();
  }

  async publish(_topic: string, _event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {}

  async subscribe(topic: string, _cb: EventCallback, _options?: SubscribeOptions): Promise<void> {
    this.subscribeCalls.push(topic);
    if (topic === this.gateSubscribeTopic) {
      this.#subscribeGateStarted?.();
      await new Promise<void>(resolve => {
        this.#releaseSubscribeGate = resolve;
      });
    }
    if (topic === this.failSubscribeTopic) {
      throw new Error(`subscribe failed: ${topic}`);
    }
  }

  async unsubscribe(topic: string, _cb: EventCallback): Promise<void> {
    this.unsubscribeCalls.push(topic);
    if (topic === this.failNextUnsubscribeTopic) {
      this.failNextUnsubscribeTopic = undefined;
      throw new Error(`unsubscribe failed: ${topic}`);
    }
  }

  async flush(): Promise<void> {}
}

class ControllableWorker extends MastraWorker {
  readonly name: string;
  running = false;
  initCalls = 0;
  startCalls = 0;
  stopCalls = 0;
  onInit?: (call: number) => Promise<void>;
  onStart?: (call: number) => Promise<void>;

  constructor(name = 'controllable') {
    super();
    this.name = name;
  }

  override async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.initCalls += 1;
    await this.onInit?.(this.initCalls);
  }

  async start(): Promise<void> {
    this.startCalls += 1;
    if (this.onStart) {
      await this.onStart(this.startCalls);
      return;
    }
    this.running = true;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }
}

describe('Mastra workers filter (MASTRA_WORKERS env)', () => {
  beforeEach(() => {
    delete process.env.MASTRA_WORKERS;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.MASTRA_WORKERS;
    } else {
      process.env.MASTRA_WORKERS = ORIGINAL_ENV;
    }
    vi.restoreAllMocks();
  });

  it('starts only the named workers when MASTRA_WORKERS=a,b is set', async () => {
    process.env.MASTRA_WORKERS = 'scheduler,backgroundTasks';

    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });

    // Spy on each worker's start method.
    const starts = mastra.workers.map(w => ({
      name: w.name,
      spy: vi.spyOn(w, 'start').mockResolvedValue(undefined),
      initSpy: vi.spyOn(w, 'init').mockResolvedValue(undefined),
    }));

    await mastra.startWorkers();

    const started = starts.filter(s => s.spy.mock.calls.length > 0).map(s => s.name);
    expect(started.sort()).toEqual(['backgroundTasks', 'scheduler']);

    // orchestration was not started
    const orchestration = starts.find(s => s.name === 'orchestration');
    expect(orchestration?.spy).not.toHaveBeenCalled();
  });

  it('starts all workers when MASTRA_WORKERS is unset', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });

    const starts = mastra.workers.map(w => ({
      name: w.name,
      spy: vi.spyOn(w, 'start').mockResolvedValue(undefined),
      initSpy: vi.spyOn(w, 'init').mockResolvedValue(undefined),
    }));

    await mastra.startWorkers();

    for (const s of starts) {
      expect(s.spy, `worker ${s.name} should have started`).toHaveBeenCalled();
    }
  });

  it('does not start an initial worker whose init completes after stopWorkers begins', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to hold startWorkers in flight');
    }

    let resolveInit!: () => void;
    const init = vi.spyOn(initialWorker, 'init').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInit = resolve;
        }),
    );
    const start = vi.spyOn(initialWorker, 'start').mockResolvedValue(undefined);

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });

    const stopping = mastra.stopWorkers();
    resolveInit();
    await Promise.all([starting, stopping]);

    expect(start).not.toHaveBeenCalled();
  });

  it('times out shutdown waiting for an initial worker startup that never settles', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to hold startWorkers in flight');
    }

    let resolveInit!: () => void;
    const init = vi.spyOn(initialWorker, 'init').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInit = resolve;
        }),
    );
    const start = vi.spyOn(initialWorker, 'start').mockResolvedValue(undefined);

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });

    vi.useFakeTimers();
    try {
      const stopping = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await stopping;

      resolveInit();
      await starting;
      expect(start).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('can retry all-worker startup after shutdown times out waiting for a pending startup', async () => {
    const worker = new ControllableWorker();
    let resolveOldInit!: () => void;
    worker.onInit = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveOldInit = resolve;
        });
      }
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const oldStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(worker.initCalls).toBe(1);
    });

    vi.useFakeTimers();
    try {
      const stopping = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await stopping;
    } finally {
      vi.useRealTimers();
    }

    await mastra.startWorkers();
    expect(worker.initCalls).toBe(2);
    expect(worker.startCalls).toBe(1);
    expect(worker.running).toBe(true);

    resolveOldInit();
    await oldStart;
    expect(worker.startCalls).toBe(1);
    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not keep timed-out init starts in later shutdown tracking after retry succeeds', async () => {
    const worker = new ControllableWorker();
    worker.onInit = async call => {
      if (call === 1) {
        await new Promise<void>(() => {});
      }
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    void mastra.startWorkers();
    await vi.waitFor(() => {
      expect(worker.initCalls).toBe(1);
    });

    vi.useFakeTimers();
    try {
      const timedOutStop = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await timedOutStop;

      await mastra.startWorkers();
      expect(worker.initCalls).toBe(2);
      expect(worker.startCalls).toBe(1);
      expect(worker.running).toBe(true);

      const finalStop = mastra.stopWorkers();
      await vi.runOnlyPendingTimersAsync();
      await expect(finalStop).resolves.toBeUndefined();
      expect(worker.stopCalls).toBe(1);
      expect(worker.running).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start a named worker whose init resolves after a shutdown timeout', async () => {
    const worker = new ControllableWorker();
    let resolveOldInit!: () => void;
    worker.onInit = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveOldInit = resolve;
        });
      }
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const oldStart = mastra.startWorkers('controllable');
    await vi.waitFor(() => {
      expect(worker.initCalls).toBe(1);
    });

    vi.useFakeTimers();
    try {
      const stopping = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await stopping;
    } finally {
      vi.useRealTimers();
    }

    await mastra.startWorkers('controllable');
    expect(worker.initCalls).toBe(2);
    expect(worker.startCalls).toBe(1);
    expect(worker.running).toBe(true);

    resolveOldInit();
    await oldStart;
    expect(worker.startCalls).toBe(1);
    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not retry all-worker startup while an old worker start call is still pending', async () => {
    const worker = new ControllableWorker();
    let resolveOldStart!: () => void;
    worker.onStart = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveOldStart = resolve;
        });
      }
      worker.running = true;
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const oldStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(worker.startCalls).toBe(1);
    });

    vi.useFakeTimers();
    try {
      const stopping = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await stopping;
    } finally {
      vi.useRealTimers();
    }

    const retryWhileOldStartPending = mastra.startWorkers();
    const retryState = await Promise.race([
      retryWhileOldStartPending.then(() => 'settled' as const),
      new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
    ]);
    expect(retryState).toBe('pending');
    expect(worker.startCalls).toBe(1);

    resolveOldStart();
    await oldStart;
    await retryWhileOldStartPending;
    await vi.waitFor(() => {
      expect(worker.stopCalls).toBe(1);
    });
    expect(worker.running).toBe(false);

    await mastra.startWorkers();
    expect(worker.startCalls).toBe(2);
    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('queues a named startup retry until an old worker start call settles', async () => {
    const worker = new ControllableWorker();
    let resolveOldStart!: () => void;
    worker.onStart = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveOldStart = resolve;
        });
      }
      worker.running = true;
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const oldStart = mastra.startWorkers('controllable');
    await vi.waitFor(() => {
      expect(worker.startCalls).toBe(1);
    });

    vi.useFakeTimers();
    try {
      const stopping = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await stopping;
    } finally {
      vi.useRealTimers();
    }

    const retryWhileOldStartPending = mastra.startWorkers('controllable');
    const retryState = await Promise.race([
      retryWhileOldStartPending.then(() => 'settled' as const),
      new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
    ]);
    expect(retryState).toBe('pending');
    expect(worker.startCalls).toBe(1);

    resolveOldStart();
    await oldStart;
    await retryWhileOldStartPending;
    expect(worker.stopCalls).toBe(1);
    expect(worker.startCalls).toBe(2);
    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('cleans up a timed-out named startup after a filtered all-worker startup', async () => {
    process.env.MASTRA_WORKERS = 'worker-b';
    const workerA = new ControllableWorker('worker-a');
    const workerB = new ControllableWorker('worker-b');
    let resolveOldStart!: () => void;
    workerA.onStart = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveOldStart = resolve;
        });
      }
      workerA.running = true;
    };
    const mastra = new Mastra({
      workers: [workerA, workerB],
      logger: false,
    });

    const oldStart = mastra.startWorkers('worker-a');
    await vi.waitFor(() => {
      expect(workerA.startCalls).toBe(1);
    });

    vi.useFakeTimers();
    try {
      const stopping = expect(mastra.stopWorkers()).rejects.toThrow('Timed out waiting for worker');
      await vi.advanceTimersByTimeAsync(30_000);
      await stopping;
    } finally {
      vi.useRealTimers();
    }

    await mastra.startWorkers();
    expect(workerB.running).toBe(true);
    expect(workerA.running).toBe(false);

    resolveOldStart();
    await oldStart;
    await vi.waitFor(() => {
      expect(workerA.stopCalls).toBe(1);
    });
    expect(workerA.running).toBe(false);
    expect(workerB.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not cancel a named startup in init when a filtered all-worker startup runs', async () => {
    process.env.MASTRA_WORKERS = 'worker-b';
    const workerA = new ControllableWorker('worker-a');
    const workerB = new ControllableWorker('worker-b');
    let resolveWorkerAInit!: () => void;
    workerA.onInit = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveWorkerAInit = resolve;
        });
      }
    };
    const mastra = new Mastra({
      workers: [workerA, workerB],
      logger: false,
    });

    const namedStart = mastra.startWorkers('worker-a');
    await vi.waitFor(() => {
      expect(workerA.initCalls).toBe(1);
    });

    await mastra.startWorkers();
    expect(workerB.running).toBe(true);
    expect(workerA.startCalls).toBe(0);

    resolveWorkerAInit();
    await namedStart;

    expect(workerA.startCalls).toBe(1);
    expect(workerA.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not stop an excluded named worker when filtered all-worker startup fails', async () => {
    process.env.MASTRA_WORKERS = 'worker-b';
    const workerA = new ControllableWorker('worker-a');
    const workerB = new ControllableWorker('worker-b');
    let resolveWorkerAStart!: () => void;
    let rejectWorkerBStart!: () => void;
    workerA.onStart = async () => {
      await new Promise<void>(resolve => {
        resolveWorkerAStart = resolve;
      });
      workerA.running = true;
    };
    workerB.onStart = async () => {
      await new Promise<void>((_resolve, reject) => {
        rejectWorkerBStart = reject;
      });
    };
    const mastra = new Mastra({
      workers: [workerA, workerB],
      logger: false,
    });

    const namedStart = mastra.startWorkers('worker-a');
    await vi.waitFor(() => {
      expect(workerA.startCalls).toBe(1);
    });

    const filteredStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(workerB.startCalls).toBe(1);
    });

    resolveWorkerAStart();
    await namedStart;
    expect(workerA.running).toBe(true);

    rejectWorkerBStart(new Error('filtered startup failed'));
    await expect(filteredStart).rejects.toThrow('filtered startup failed');
    expect(workerA.stopCalls).toBe(0);
    expect(workerA.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not stop a pending named worker when overlapping all-worker startup fails', async () => {
    const workerA = new ControllableWorker('a');
    const workerB = new ControllableWorker('b');
    let resolveNamedWorkerStart!: () => void;
    workerA.onStart = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveNamedWorkerStart = resolve;
        });
      }
      workerA.running = true;
    };
    let rejectWorkerBStart!: (error: Error) => void;
    workerB.onStart = async () =>
      new Promise<void>((_resolve, reject) => {
        rejectWorkerBStart = reject;
      });
    const mastra = new Mastra({
      workers: [workerA, workerB],
      logger: false,
    });

    const namedStart = mastra.startWorkers('a');
    await vi.waitFor(() => {
      expect(workerA.startCalls).toBe(1);
    });

    const allStart = mastra.startWorkers();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(workerA.startCalls).toBe(1);

    resolveNamedWorkerStart();
    await namedStart;
    expect(workerA.running).toBe(true);

    await vi.waitFor(() => {
      expect(workerB.startCalls).toBe(1);
    });

    rejectWorkerBStart(new Error('all-worker startup failed'));
    await expect(allStart).rejects.toThrow('all-worker startup failed');

    expect(workerA.stopCalls).toBe(0);
    expect(workerA.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('deduplicates overlapping named startup calls for the same worker', async () => {
    const worker = new ControllableWorker();
    let resolveStart!: () => void;
    worker.onStart = async () => {
      await new Promise<void>(resolve => {
        resolveStart = resolve;
      });
      worker.running = true;
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const firstStart = mastra.startWorkers('controllable');
    await vi.waitFor(() => {
      expect(worker.startCalls).toBe(1);
    });
    const secondStart = mastra.startWorkers('controllable');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(worker.startCalls).toBe(1);

    resolveStart();
    await Promise.all([firstStart, secondStart]);

    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('stops an initial worker whose start completes after stopWorkers begins', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to hold startWorkers in flight');
    }

    let running = false;
    let resolveStart!: () => void;
    vi.spyOn(initialWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(initialWorker, 'isRunning', 'get').mockImplementation(() => running);
    const start = vi.spyOn(initialWorker, 'start').mockImplementation(async () => {
      await new Promise<void>(resolve => {
        resolveStart = resolve;
      });
      running = true;
    });
    const stop = vi.spyOn(initialWorker, 'stop').mockImplementation(async () => {
      running = false;
    });

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });

    const stopping = mastra.stopWorkers();
    resolveStart();
    await Promise.all([starting, stopping]);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(running).toBe(false);
  });

  it('cleans up already-running workers when a pending startup rejects during stopWorkers', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const [firstWorker, secondWorker] = mastra.workers;
    if (!firstWorker || !secondWorker) {
      throw new Error('expected at least two workers to model partial startup cleanup');
    }

    let firstRunning = false;
    vi.spyOn(firstWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(firstWorker, 'isRunning', 'get').mockImplementation(() => firstRunning);
    vi.spyOn(firstWorker, 'start').mockImplementation(async () => {
      firstRunning = true;
    });
    const firstStop = vi.spyOn(firstWorker, 'stop').mockImplementation(async () => {
      firstRunning = false;
    });

    let rejectSecondStart!: (error: Error) => void;
    vi.spyOn(secondWorker, 'init').mockResolvedValue(undefined);
    const secondStart = vi.spyOn(secondWorker, 'start').mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSecondStart = reject;
        }),
    );

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(secondStart).toHaveBeenCalledTimes(1);
    });

    const stopping = mastra.stopWorkers();
    rejectSecondStart(new Error('worker startup failed'));

    await expect(starting).rejects.toThrow('worker startup failed');
    await expect(stopping).rejects.toThrow('worker startup failed');
    expect(firstStop).toHaveBeenCalledTimes(1);
    expect(firstRunning).toBe(false);
  });

  it('cleans up already-running initial workers when all-worker startup fails', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const [firstWorker, secondWorker] = mastra.workers;
    if (!firstWorker || !secondWorker) {
      throw new Error('expected at least two workers to model failed startup cleanup');
    }

    let firstRunning = false;
    vi.spyOn(firstWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(firstWorker, 'isRunning', 'get').mockImplementation(() => firstRunning);
    vi.spyOn(firstWorker, 'start').mockImplementation(async () => {
      firstRunning = true;
    });
    const firstStop = vi.spyOn(firstWorker, 'stop').mockImplementation(async () => {
      firstRunning = false;
    });

    vi.spyOn(secondWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(secondWorker, 'start').mockRejectedValue(new Error('worker startup failed'));

    await expect(mastra.startWorkers()).rejects.toThrow('worker startup failed');

    expect(firstStop).toHaveBeenCalledTimes(1);
    expect(firstRunning).toBe(false);
  });

  it('stops a worker that becomes running before its startup rejects', async () => {
    const worker = new ControllableWorker();
    worker.onStart = async () => {
      worker.running = true;
      throw new Error('partial startup failed');
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    await expect(mastra.startWorkers()).rejects.toThrow('partial startup failed');

    expect(worker.stopCalls).toBe(1);
    expect(worker.running).toBe(false);
  });

  it('deduplicates concurrent all-worker startup calls', async () => {
    const worker = new ControllableWorker();
    let resolveStart!: () => void;
    worker.onStart = async () => {
      await new Promise<void>(resolve => {
        resolveStart = resolve;
      });
      worker.running = true;
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const oldStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(worker.startCalls).toBe(1);
    });
    const concurrentStart = mastra.startWorkers();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(worker.startCalls).toBe(1);
    resolveStart();
    await Promise.all([oldStart, concurrentStart]);

    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
    expect(worker.stopCalls).toBe(1);
    expect(worker.running).toBe(false);
  });

  it('waits for an in-flight shutdown before starting all workers again', async () => {
    const worker = new ControllableWorker();
    let resolveStop!: () => void;
    worker.onStart = async () => {
      worker.running = true;
    };
    const originalStop = worker.stop.bind(worker);
    worker.stop = async () => {
      if (worker.stopCalls === 0) {
        worker.stopCalls += 1;
        await new Promise<void>(resolve => {
          resolveStop = resolve;
        });
        worker.running = false;
        return;
      }
      await originalStop();
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    await mastra.startWorkers();
    expect(worker.startCalls).toBe(1);

    const stopping = mastra.stopWorkers();
    await vi.waitFor(() => {
      expect(worker.stopCalls).toBe(1);
    });
    const starting = mastra.startWorkers();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(worker.startCalls).toBe(1);

    resolveStop();
    await Promise.all([stopping, starting]);

    expect(worker.startCalls).toBe(2);
    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not let a failed repeated all-worker startup stop already-running workers', async () => {
    const pubsub = new StartupCleanupPubSub();
    const worker = new ControllableWorker();
    const mastra = new Mastra({
      workers: [worker],
      pubsub,
      events: {
        first: async () => {},
      },
      logger: false,
    });

    await mastra.startWorkers();
    expect(worker.running).toBe(true);
    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first']);

    worker.onStart = async () => {
      throw new Error('repeat startup failed');
    };
    await expect(mastra.startWorkers()).rejects.toThrow('repeat startup failed');

    expect(worker.stopCalls).toBe(0);
    expect(worker.running).toBe(true);
    expect(pubsub.unsubscribeCalls).toEqual([]);

    worker.onStart = undefined;
    await mastra.stopWorkers();
    expect(worker.stopCalls).toBe(1);
    expect(worker.running).toBe(false);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first']);
  });

  it('still cleans up all-worker-owned starts after an overlapping named start fails', async () => {
    const workerA = new ControllableWorker('a');
    const workerB = new ControllableWorker('b');
    let rejectWorkerBStart!: (error: Error) => void;
    workerA.onStart = async call => {
      if (call === 2) {
        throw new Error('named startup failed');
      }
      workerA.running = true;
    };
    workerB.onStart = async () =>
      new Promise<void>((_resolve, reject) => {
        rejectWorkerBStart = reject;
      });
    const mastra = new Mastra({
      workers: [workerA, workerB],
      logger: false,
    });

    const allStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(workerB.startCalls).toBe(1);
    });
    expect(workerA.running).toBe(true);

    await expect(mastra.startWorkers('a')).rejects.toThrow('named startup failed');
    expect(workerA.running).toBe(true);

    rejectWorkerBStart(new Error('all-worker startup failed'));
    await expect(allStart).rejects.toThrow('all-worker startup failed');

    expect(workerA.stopCalls).toBe(1);
    expect(workerA.running).toBe(false);
  });

  it('does not restore the started flag when stopWorkers interrupts a repeated all-worker startup', async () => {
    const harnessWakeupsInit = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    const harnessWakeupsStart = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    const worker = mastra.workers[0];
    if (!worker) {
      throw new Error('expected an initial worker to model repeated startup shutdown');
    }
    let workerRunning = false;
    let resolveRepeatStart!: () => void;
    let workerStartCalls = 0;
    vi.spyOn(worker, 'init').mockResolvedValue(undefined);
    vi.spyOn(worker, 'isRunning', 'get').mockImplementation(() => workerRunning);
    vi.spyOn(worker, 'start').mockImplementation(async () => {
      workerStartCalls += 1;
      if (workerStartCalls === 2) {
        await new Promise<void>(resolve => {
          resolveRepeatStart = resolve;
        });
      }
      workerRunning = true;
    });
    vi.spyOn(worker, 'stop').mockImplementation(async () => {
      workerRunning = false;
    });

    await mastra.startWorkers();
    expect(workerRunning).toBe(true);

    const repeatedStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(workerStartCalls).toBe(2);
    });
    const stopping = mastra.stopWorkers();
    resolveRepeatStart();
    await Promise.all([repeatedStart, stopping]);

    mastra.setStorage(new MockStore());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(harnessWakeupsInit).not.toHaveBeenCalled();
    expect(harnessWakeupsStart).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent all-worker startup calls while init is pending', async () => {
    const worker = new ControllableWorker();
    let resolveOldInit!: () => void;
    worker.onInit = async call => {
      if (call === 1) {
        await new Promise<void>(resolve => {
          resolveOldInit = resolve;
        });
      }
    };
    const mastra = new Mastra({
      workers: [worker],
      logger: false,
    });

    const oldStart = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(worker.initCalls).toBe(1);
    });
    const concurrentStart = mastra.startWorkers();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(worker.initCalls).toBe(1);
    expect(worker.startCalls).toBe(0);

    resolveOldInit();
    await Promise.all([oldStart, concurrentStart]);

    expect(worker.startCalls).toBe(1);
    expect(worker.running).toBe(true);

    await mastra.stopWorkers();
  });

  it('cleans up push and user event subscriptions when all-worker startup fails', async () => {
    const pubsub = new StartupCleanupPubSub();
    pubsub.failSubscribeTopic = 'second';
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
      events: {
        first: async () => {},
        second: async () => {},
      },
    });

    await expect(mastra.startWorkers()).rejects.toThrow('subscribe failed: second');

    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first', 'second']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first', 'second']);

    pubsub.failSubscribeTopic = undefined;
    await mastra.startWorkers();
    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first', 'second', 'workflows', 'first', 'second']);

    await mastra.stopWorkers();
  });

  it('does not retain a failed workflow push subscription when startup cleanup also fails', async () => {
    const pubsub = new StartupCleanupPubSub();
    pubsub.failSubscribeTopic = 'workflows';
    pubsub.failNextUnsubscribeTopic = 'workflows';
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
    });

    await expect(mastra.startWorkers()).rejects.toThrow('subscribe failed: workflows');
    expect(pubsub.subscribeCalls).toEqual(['workflows']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows']);

    pubsub.failSubscribeTopic = undefined;
    await mastra.startWorkers();
    expect(pubsub.subscribeCalls).toEqual(['workflows', 'workflows']);

    await mastra.stopWorkers();
  });

  it('does not retain a failed user event subscription when startup cleanup also fails', async () => {
    const pubsub = new StartupCleanupPubSub();
    pubsub.failSubscribeTopic = 'second';
    pubsub.failNextUnsubscribeTopic = 'second';
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
      events: {
        first: async () => {},
        second: async () => {},
      },
    });

    await expect(mastra.startWorkers()).rejects.toThrow('subscribe failed: second');
    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first', 'second']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first', 'second']);

    pubsub.failSubscribeTopic = undefined;
    await mastra.startWorkers();
    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first', 'second', 'workflows', 'first', 'second']);

    await mastra.stopWorkers();
  });

  it('cleans up a push workflow subscription when stopWorkers runs during startup subscribe', async () => {
    const pubsub = new StartupCleanupPubSub();
    pubsub.gateSubscribeTopic = 'workflows';
    pubsub.resetSubscribeGate();
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
    });

    const starting = mastra.startWorkers();
    await pubsub.subscribeGateStarted;

    await mastra.stopWorkers();
    pubsub.failNextUnsubscribeTopic = 'workflows';
    pubsub.releaseSubscribeGate();
    await expect(starting).rejects.toThrow('unsubscribe failed: workflows');

    expect(pubsub.subscribeCalls).toEqual(['workflows']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'workflows', 'workflows']);

    await mastra.stopWorkers();
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'workflows', 'workflows']);
  });

  it('retains a push workflow subscription for retry cleanup when stop-during-startup unsubscribe fails', async () => {
    const pubsub = new StartupCleanupPubSub();
    pubsub.gateSubscribeTopic = 'workflows';
    pubsub.failNextUnsubscribeTopic = 'workflows';
    pubsub.resetSubscribeGate();
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
    });

    const starting = mastra.startWorkers();
    await pubsub.subscribeGateStarted;

    await expect(mastra.stopWorkers()).rejects.toThrow('unsubscribe failed: workflows');
    pubsub.releaseSubscribeGate();
    await starting;

    expect(pubsub.subscribeCalls).toEqual(['workflows']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'workflows']);

    pubsub.gateSubscribeTopic = undefined;
    await mastra.startWorkers();
    await mastra.stopWorkers();
  });

  it('cleans up a user event subscription when stopWorkers runs during startup subscribe', async () => {
    const pubsub = new StartupCleanupPubSub();
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
      events: {
        first: async () => {},
      },
    });

    pubsub.gateSubscribeTopic = 'first';
    pubsub.resetSubscribeGate();
    const starting = mastra.startWorkers();
    await pubsub.subscribeGateStarted;

    await mastra.stopWorkers();
    pubsub.failNextUnsubscribeTopic = 'first';
    pubsub.releaseSubscribeGate();
    await expect(starting).rejects.toThrow('unsubscribe failed: first');

    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first', 'first', 'workflows', 'first']);

    await mastra.stopWorkers();
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first', 'first', 'workflows', 'first']);
  });

  it('cleans up a user event subscription on retry when stop-during-startup unsubscribe fails', async () => {
    const pubsub = new StartupCleanupPubSub();
    const mastra = new Mastra({
      workers: false,
      pubsub,
      logger: false,
      events: {
        first: async () => {},
      },
    });

    pubsub.gateSubscribeTopic = 'first';
    pubsub.failNextUnsubscribeTopic = 'first';
    pubsub.resetSubscribeGate();
    const starting = mastra.startWorkers();
    await pubsub.subscribeGateStarted;

    await expect(mastra.stopWorkers()).rejects.toThrow('unsubscribe failed: first');
    pubsub.releaseSubscribeGate();
    await starting;

    expect(pubsub.subscribeCalls).toEqual(['workflows', 'first']);
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first', 'first']);

    pubsub.gateSubscribeTopic = undefined;
    await mastra.startWorkers();
    await mastra.stopWorkers();
    expect(pubsub.unsubscribeCalls).toEqual(['workflows', 'first', 'first', 'workflows', 'first']);
  });

  it('stops already-running workers before waiting for later pending startups', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const [firstWorker, secondWorker] = mastra.workers;
    if (!firstWorker || !secondWorker) {
      throw new Error('expected at least two workers to model partial startup shutdown');
    }

    let firstRunning = false;
    vi.spyOn(firstWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(firstWorker, 'isRunning', 'get').mockImplementation(() => firstRunning);
    vi.spyOn(firstWorker, 'start').mockImplementation(async () => {
      firstRunning = true;
    });
    const firstStop = vi.spyOn(firstWorker, 'stop').mockImplementation(async () => {
      firstRunning = false;
    });

    let secondRunning = false;
    let resolveSecondStart!: () => void;
    vi.spyOn(secondWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(secondWorker, 'isRunning', 'get').mockImplementation(() => secondRunning);
    const secondStart = vi.spyOn(secondWorker, 'start').mockImplementation(async () => {
      await new Promise<void>(resolve => {
        resolveSecondStart = resolve;
      });
      secondRunning = true;
    });
    const secondStop = vi.spyOn(secondWorker, 'stop').mockImplementation(async () => {
      secondRunning = false;
    });

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(secondStart).toHaveBeenCalledTimes(1);
    });

    const stopping = mastra.stopWorkers();
    await vi.waitFor(() => {
      expect(firstStop).toHaveBeenCalledTimes(1);
    });
    expect(firstRunning).toBe(false);

    resolveSecondStart();
    await Promise.all([starting, stopping]);

    expect(secondStop).toHaveBeenCalledTimes(1);
    expect(secondRunning).toBe(false);
  });

  it('keeps pending startup rejection evidence when it settles during a slow stop', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      logger: false,
    });
    const [firstWorker, secondWorker] = mastra.workers;
    if (!firstWorker || !secondWorker) {
      throw new Error('expected at least two workers to model startup rejection during slow stop');
    }

    let firstRunning = false;
    let resolveFirstStop!: () => void;
    vi.spyOn(firstWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(firstWorker, 'isRunning', 'get').mockImplementation(() => firstRunning);
    vi.spyOn(firstWorker, 'start').mockImplementation(async () => {
      firstRunning = true;
    });
    const firstStop = vi.spyOn(firstWorker, 'stop').mockImplementation(async () => {
      await new Promise<void>(resolve => {
        resolveFirstStop = resolve;
      });
      firstRunning = false;
    });

    let rejectSecondStart!: (error: Error) => void;
    vi.spyOn(secondWorker, 'init').mockResolvedValue(undefined);
    const secondStart = vi.spyOn(secondWorker, 'start').mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSecondStart = reject;
        }),
    );

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(secondStart).toHaveBeenCalledTimes(1);
    });

    const stopping = mastra.stopWorkers();
    await vi.waitFor(() => {
      expect(firstStop).toHaveBeenCalledTimes(1);
    });
    rejectSecondStart(new Error('worker startup failed during stop'));
    resolveFirstStop();

    await expect(starting).rejects.toThrow('worker startup failed during stop');
    await expect(stopping).rejects.toThrow('worker startup failed during stop');
    expect(firstRunning).toBe(false);
  });

  it('registers harness wakeup worker for harness session storage without top-level storage', () => {
    const mastra = new Mastra({
      harnesses: {
        default: new Harness({
          modes: [],
          sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
        }),
      },
      logger: false,
    });

    expect(mastra.workers.map(worker => worker.name)).toContain('harnessWakeups');
  });

  it('registers harness wakeup worker when storage is attached after construction', () => {
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });

    expect(mastra.workers.map(worker => worker.name)).not.toContain('harnessWakeups');

    mastra.setStorage(new MockStore());

    expect(mastra.workers.map(worker => worker.name)).toContain('harnessWakeups');
  });

  it('starts a late-registered harness wakeup worker when workers are already running', async () => {
    const init = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    const start = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });

    await mastra.startWorkers();
    mastra.setStorage(new MockStore());

    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('starts a late-registered harness wakeup worker while workers are still starting', async () => {
    const init = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    const start = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to hold startWorkers in flight');
    }
    let releaseStart!: () => void;
    vi.spyOn(initialWorker, 'init').mockResolvedValue(undefined);
    const initialStart = vi.spyOn(initialWorker, 'start').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          releaseStart = resolve;
        }),
    );

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(initialStart).toHaveBeenCalledTimes(1);
    });
    mastra.setStorage(new MockStore());

    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
    expect(init).toHaveBeenCalledTimes(1);

    releaseStart();
    await starting;
    expect(start).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not start a late-registered harness wakeup worker after workers are stopped', async () => {
    const init = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    const start = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });

    await mastra.startWorkers();
    await mastra.stopWorkers();
    mastra.setStorage(new MockStore());

    expect(mastra.workers.map(worker => worker.name)).toContain('harnessWakeups');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(init).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('does not keep late worker startup armed after all-worker startup fails', async () => {
    const init = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    const start = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to fail startWorkers');
    }
    vi.spyOn(initialWorker, 'init').mockResolvedValue(undefined);
    vi.spyOn(initialWorker, 'start').mockRejectedValue(new Error('worker startup failed'));

    await expect(mastra.startWorkers()).rejects.toThrow('worker startup failed');
    mastra.setStorage(new MockStore());

    expect(mastra.workers.map(worker => worker.name)).toContain('harnessWakeups');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(init).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('stops a late-started harness wakeup worker when all-worker startup fails', async () => {
    let harnessWakeupsRunning = false;
    vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(HarnessWakeupWorker.prototype, 'isRunning', 'get').mockImplementation(() => harnessWakeupsRunning);
    let resolveHarnessWakeupsStart!: () => void;
    const harnessWakeupsStart = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockImplementation(async () => {
      await new Promise<void>(resolve => {
        resolveHarnessWakeupsStart = resolve;
      });
      harnessWakeupsRunning = true;
    });
    const harnessWakeupsStop = vi.spyOn(HarnessWakeupWorker.prototype, 'stop').mockImplementation(async () => {
      harnessWakeupsRunning = false;
    });

    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to fail startWorkers');
    }

    let resolveInitialInit!: () => void;
    vi.spyOn(initialWorker, 'init').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInitialInit = resolve;
        }),
    );
    vi.spyOn(initialWorker, 'start').mockRejectedValue(new Error('worker startup failed'));

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(initialWorker.init).toHaveBeenCalledTimes(1);
    });

    mastra.setStorage(new MockStore());
    await vi.waitFor(() => {
      expect(harnessWakeupsStart).toHaveBeenCalledTimes(1);
    });

    resolveInitialInit();
    await expect(starting).rejects.toThrow('worker startup failed');
    expect(harnessWakeupsStop).not.toHaveBeenCalled();

    resolveHarnessWakeupsStart();
    await vi.waitFor(() => {
      expect(harnessWakeupsStop).toHaveBeenCalledTimes(1);
    });
    expect(harnessWakeupsRunning).toBe(false);
  });

  it('stops an old late-started harness wakeup worker when startup is retried before it settles', async () => {
    let harnessWakeupsRunning = false;
    vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(HarnessWakeupWorker.prototype, 'isRunning', 'get').mockImplementation(() => harnessWakeupsRunning);
    let harnessWakeupsStartCalls = 0;
    let resolveOldHarnessWakeupsStart!: () => void;
    const harnessWakeupsStart = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockImplementation(async () => {
      harnessWakeupsStartCalls += 1;
      if (harnessWakeupsStartCalls === 1) {
        await new Promise<void>(resolve => {
          resolveOldHarnessWakeupsStart = resolve;
        });
      }
      harnessWakeupsRunning = true;
    });
    const harnessWakeupsStop = vi.spyOn(HarnessWakeupWorker.prototype, 'stop').mockImplementation(async () => {
      harnessWakeupsRunning = false;
    });

    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to fail startWorkers');
    }

    let initialInitCalls = 0;
    let resolveInitialInit!: () => void;
    vi.spyOn(initialWorker, 'init').mockImplementation(() => {
      initialInitCalls += 1;
      if (initialInitCalls === 1) {
        return new Promise<void>(resolve => {
          resolveInitialInit = resolve;
        });
      }
      return Promise.resolve();
    });

    let initialStartCalls = 0;
    let resolveRetryInitialStart!: () => void;
    vi.spyOn(initialWorker, 'start').mockImplementation(() => {
      initialStartCalls += 1;
      if (initialStartCalls === 1) {
        return Promise.reject(new Error('worker startup failed'));
      }
      return new Promise<void>(resolve => {
        resolveRetryInitialStart = resolve;
      });
    });

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(initialWorker.init).toHaveBeenCalledTimes(1);
    });

    mastra.setStorage(new MockStore());
    await vi.waitFor(() => {
      expect(harnessWakeupsStart).toHaveBeenCalledTimes(1);
    });

    resolveInitialInit();
    await expect(starting).rejects.toThrow('worker startup failed');

    const retrying = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(initialStartCalls).toBe(2);
    });

    resolveOldHarnessWakeupsStart();
    await vi.waitFor(() => {
      expect(harnessWakeupsStop).toHaveBeenCalledTimes(1);
    });
    expect(harnessWakeupsRunning).toBe(false);

    resolveRetryInitialStart();
    await retrying;
    expect(harnessWakeupsStart).toHaveBeenCalledTimes(2);
    expect(harnessWakeupsRunning).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not stop a newer harness wakeup worker when an old late start settles after retry', async () => {
    let harnessWakeupsRunning = false;
    vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(HarnessWakeupWorker.prototype, 'isRunning', 'get').mockImplementation(() => harnessWakeupsRunning);
    let harnessWakeupsStartCalls = 0;
    let resolveOldHarnessWakeupsStart!: () => void;
    const harnessWakeupsStart = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockImplementation(async () => {
      harnessWakeupsStartCalls += 1;
      if (harnessWakeupsStartCalls === 1) {
        await new Promise<void>(resolve => {
          resolveOldHarnessWakeupsStart = resolve;
        });
      }
      harnessWakeupsRunning = true;
    });
    const harnessWakeupsStop = vi.spyOn(HarnessWakeupWorker.prototype, 'stop').mockImplementation(async () => {
      harnessWakeupsRunning = false;
    });

    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    const initialWorker = mastra.workers[0];
    if (!initialWorker) {
      throw new Error('expected an initial worker to fail startWorkers');
    }

    let resolveInitialInit!: () => void;
    vi.spyOn(initialWorker, 'init').mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveInitialInit = resolve;
        }),
    );
    vi.spyOn(initialWorker, 'start')
      .mockRejectedValueOnce(new Error('worker startup failed'))
      .mockResolvedValue(undefined);

    const starting = mastra.startWorkers();
    await vi.waitFor(() => {
      expect(initialWorker.init).toHaveBeenCalledTimes(1);
    });
    mastra.setStorage(new MockStore());
    await vi.waitFor(() => {
      expect(harnessWakeupsStart).toHaveBeenCalledTimes(1);
    });

    resolveInitialInit();
    await expect(starting).rejects.toThrow('worker startup failed');

    const retrying = mastra.startWorkers();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(harnessWakeupsStart).toHaveBeenCalledTimes(1);

    resolveOldHarnessWakeupsStart();
    await retrying;

    expect(harnessWakeupsStop).toHaveBeenCalledTimes(1);
    expect(harnessWakeupsStart).toHaveBeenCalledTimes(2);
    expect(harnessWakeupsRunning).toBe(true);

    await mastra.stopWorkers();
  });

  it('does not start a late-registered harness wakeup worker while workers are stopping', async () => {
    let resolveInit!: () => void;
    const init = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInit = resolve;
        }),
    );
    const start = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });

    await mastra.startWorkers();
    mastra.setStorage(new MockStore());
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });

    const stopped = mastra.stopWorkers();
    resolveInit();
    await stopped;

    expect(start).not.toHaveBeenCalled();
  });

  it('does not fail shutdown when a late-registered harness wakeup worker startup fails', async () => {
    const startupError = new Error('late harness startup failed');
    let rejectInit!: (error: Error) => void;
    const init = vi.spyOn(HarnessWakeupWorker.prototype, 'init').mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectInit = reject;
        }),
    );
    const start = vi.spyOn(HarnessWakeupWorker.prototype, 'start').mockResolvedValue(undefined);
    const error = vi.fn();
    const mastra = new Mastra({
      harnesses: { default: new Harness({ modes: [] }) },
      logger: false,
    });
    mastra.setLogger({
      logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error, trackException: vi.fn() } as any,
    });

    await mastra.startWorkers();
    mastra.setStorage(new MockStore());
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });

    const stopped = mastra.stopWorkers();
    rejectInit(startupError);
    await expect(stopped).resolves.toBeUndefined();

    expect(start).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Failed to start worker "harnessWakeups"', startupError);
  });

  it('disables all workers when MASTRA_WORKERS=false', async () => {
    process.env.MASTRA_WORKERS = 'false';

    const mastra = new Mastra({
      backgroundTasks: { enabled: true },
      logger: false,
    });

    expect(mastra.workers).toEqual([]);
    mastra.setStorage(new MockStore());
    expect(mastra.workers).toEqual([]);
  });

  it('warns when MASTRA_WORKERS filter matches no workers', async () => {
    process.env.MASTRA_WORKERS = 'nonexistent';

    const warn = vi.fn();
    const mastra = new Mastra({
      backgroundTasks: { enabled: true },
      logger: false,
    });
    mastra.setLogger({
      logger: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
    });
    for (const w of mastra.workers) {
      vi.spyOn(w, 'start').mockResolvedValue(undefined);
      vi.spyOn(w, 'init').mockResolvedValue(undefined);
    }

    await mastra.startWorkers();
    // Should not throw, should not start any worker, and must have warned
    // about the empty filter so users know MASTRA_WORKERS was misspelled.
    for (const w of mastra.workers) {
      expect((w as any).start.mock.calls.length).toBe(0);
    }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MASTRA_WORKERS=nonexistent'));
  });
});
