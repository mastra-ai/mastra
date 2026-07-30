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
