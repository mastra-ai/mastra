import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockStore } from '../storage/mock';
import { Mastra } from './index';

const ORIGINAL_ENV = process.env.MASTRA_WORKERS;

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
      scheduler: { enabled: true },
      logger: false,
    });

    // Mock start()/init() on construction-time workers so we can record which
    // were started without running real worker side effects. The scheduler +
    // heartbeat workers are injected lazily inside startWorkers() — they
    // aren't visible here, so their real start() runs and isRunning reflects
    // whether they passed the MASTRA_WORKERS filter.
    const knownStarted: string[] = [];
    const knownWorkers = mastra.workers.map(w => w.name);
    for (const w of mastra.workers) {
      vi.spyOn(w, 'start').mockImplementation(async () => {
        knownStarted.push(w.name);
      });
      vi.spyOn(w, 'init').mockResolvedValue(undefined);
    }

    try {
      await mastra.startWorkers();

      // Lazily-injected workers (not in knownWorkers) report via isRunning.
      const lazyStarted = mastra.workers.filter(w => !knownWorkers.includes(w.name) && w.isRunning).map(w => w.name);
      const started = [...knownStarted, ...lazyStarted];
      expect(started.sort()).toEqual(['backgroundTasks', 'scheduler']);
      expect(started).not.toContain('orchestration');
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('starts all workers when MASTRA_WORKERS is unset', async () => {
    const mastra = new Mastra({
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      scheduler: { enabled: true },
      logger: false,
    });

    const preStarts = mastra.workers.map(w => ({
      name: w.name,
      spy: vi.spyOn(w, 'start').mockResolvedValue(undefined),
      initSpy: vi.spyOn(w, 'init').mockResolvedValue(undefined),
    }));

    await mastra.startWorkers();

    // Check pre-existing workers were started
    for (const s of preStarts) {
      expect(s.spy, `worker ${s.name} should have started`).toHaveBeenCalled();
    }
    // SchedulerWorker injected lazily should also be present
    expect(mastra.workers.some(w => w.name === 'scheduler')).toBe(true);
  });

  it('disables all workers when MASTRA_WORKERS=false', async () => {
    process.env.MASTRA_WORKERS = 'false';

    const mastra = new Mastra({
      backgroundTasks: { enabled: true },
      logger: false,
    });

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
    // Spy on workers known at construction time.
    const preStarts = mastra.workers.map(w => ({
      name: w.name,
      spy: vi.spyOn(w, 'start').mockResolvedValue(undefined),
      initSpy: vi.spyOn(w, 'init').mockResolvedValue(undefined),
    }));

    await mastra.startWorkers();
    // Should not throw, should not start any worker, and must have warned
    // about the empty filter so users know MASTRA_WORKERS was misspelled.
    for (const w of mastra.workers) {
      const pre = preStarts.find(p => p.name === w.name);
      if (pre) {
        expect(pre.spy).not.toHaveBeenCalled();
      }
      // Workers injected lazily by startWorkers() (e.g. SchedulerWorker)
      // won't have been started either since the filter matched nothing.
    }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MASTRA_WORKERS=nonexistent'));
  });
});
