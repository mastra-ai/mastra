import { describe, it, expect, vi } from 'vitest';
import { MastraWorker } from '../worker';
import { Mastra } from './index';

class FakeWorker extends MastraWorker {
  #running = false;

  constructor(readonly name: string) {
    super();
  }

  async start() {
    this.#running = true;
  }

  async stop() {
    this.#running = false;
  }

  get isRunning() {
    return this.#running;
  }
}

describe('Mastra workers option (merge semantics)', () => {
  it('merges custom workers with the auto-created defaults', () => {
    const poller = new FakeWorker('github-poller');
    const registerSpy = vi.spyOn(poller, '__registerMastra');

    const mastra = new Mastra({ logger: false, workers: [poller] });

    const names = mastra.workers.map(w => w.name);
    // Default orchestration worker survives the merge...
    expect(names).toContain('orchestration');
    // ...and the custom worker is appended and registered.
    expect(names).toContain('github-poller');
    expect(registerSpy).toHaveBeenCalledWith(mastra);
    expect(mastra.getWorker('github-poller')).toBe(poller);
  });

  it('a custom worker replaces the default sharing its name', () => {
    const custom = new FakeWorker('orchestration');

    const mastra = new Mastra({ logger: false, workers: [custom] });

    const orchestrators = mastra.workers.filter(w => w.name === 'orchestration');
    expect(orchestrators).toEqual([custom]);
  });

  it('reports the active worker configuration for the Mastra instance', async () => {
    const orchestration = new FakeWorker('orchestration');
    const scheduler = new FakeWorker('scheduler');
    const backgroundTasks = new FakeWorker('backgroundTasks');
    const cleanup = new FakeWorker('cleanup-jobs');
    const mastra = new Mastra({
      logger: false,
      workers: [orchestration, scheduler, backgroundTasks, cleanup],
      scheduler: {
        enabled: true,
        tickIntervalMs: 5_000,
        batchSize: 25,
        onError: vi.fn(),
      },
      backgroundTasks: {
        enabled: true,
        mode: 'worker',
        globalConcurrency: 20,
        defaultRetries: { maxRetries: 3, retryableErrors: vi.fn() },
        onTaskComplete: vi.fn(),
      },
    });

    await orchestration.start();
    await backgroundTasks.start();
    await cleanup.start();

    expect(mastra.getWorkerConfig()).toEqual({
      version: 1,
      orchestration: { enabled: true },
      scheduler: { tickIntervalMs: 5_000, batchSize: 25, enabled: false },
      backgroundTasks: {
        mode: 'worker',
        globalConcurrency: 20,
        defaultRetries: { maxRetries: 3 },
        enabled: true,
      },
      custom: ['cleanup-jobs'],
    });
  });

  it('throws on duplicate names within the custom workers array', () => {
    expect(() => new Mastra({ logger: false, workers: [new FakeWorker('dup'), new FakeWorker('dup')] })).toThrow(
      /Duplicate worker name "dup"/,
    );
  });

  it('workers: false still disables all workers', () => {
    const mastra = new Mastra({ logger: false, workers: false });
    expect(mastra.workers).toEqual([]);
  });
});
