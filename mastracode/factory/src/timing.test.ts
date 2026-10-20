import { FactoryStorage, FactoryStorageDomain } from '@mastra/core/storage';
import type { FactoryStorageOps, MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

class TestFactoryStorage extends FactoryStorage {
  readonly ops = {} as FactoryStorageOps;
  getMastraStorage(): MastraCompositeStore {
    throw new Error('not used');
  }
  protected async initStorage(): Promise<void> {}
  async ensureCollections(): Promise<void> {}
  withTransaction<T>(fn: (ops: FactoryStorageOps) => Promise<T>): Promise<T> {
    return fn(this.ops);
  }
  async close(): Promise<void> {}
}

class NotesDomain extends FactoryStorageDomain {
  constructor() {
    super('notes');
  }
  async list(): Promise<string[]> {
    return ['n1'];
  }
  async dangerouslyClearAll(): Promise<void> {}
}

function timingLines(write: MockInstance): string[] {
  return write.mock.calls
    .map(([chunk]) => String(chunk))
    .filter(line => line.startsWith('[factory:timing] '))
    .map(line => line.slice('[factory:timing] '.length).trimEnd());
}

async function loadTiming(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv('FACTORY_TIMING', flag ?? '');
  return import('./timing.js');
}

describe('FACTORY_TIMING instrumentation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs method durations in place, preserving identity and results, when enabled', async () => {
    const { instrumentMethods } = await loadTiming('1');
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const sandbox = {
      prefix: 'out:',
      async executeCommand(cmd: string) {
        return `${this.prefix}${cmd}`;
      },
    };

    const result = instrumentMethods(sandbox, 'sandbox(s1)', ['executeCommand']);

    expect(result).toBe(sandbox);
    await expect(sandbox.executeCommand('pwd')).resolves.toBe('out:pwd');
    expect(write).toHaveBeenCalledWith(
      expect.stringMatching(/^\[factory:timing\] sandbox\(s1\)\.executeCommand \d+ms\n$/),
    );
  });

  it('times calls on the handle registerDomain returns and on getDomain, which are the same object', async () => {
    const { instrumentAsyncMethods } = await loadTiming('true');
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const storage = instrumentAsyncMethods(new TestFactoryStorage(), 'storage');

    const notes = storage.registerDomain(new NotesDomain());
    await expect(notes.list()).resolves.toEqual(['n1']);
    expect(timingLines(write)).toEqual([expect.stringMatching(/^storage\.notes\.list \d+ms$/)]);

    expect(storage.getDomain('notes')).toBe(notes);
    await storage.getDomain<NotesDomain>('notes').list();
    expect(timingLines(write)).toHaveLength(2);
    expect(timingLines(write)[1]).toMatch(/^storage\.notes\.list \d+ms$/);
  });

  it('leaves objects untouched and logs nothing when disabled', async () => {
    const { instrumentMethods, instrumentAsyncMethods, timed } = await loadTiming(undefined);
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const run = async () => 1;
    const target = { run };

    instrumentMethods(target, 'x', ['run']);
    expect(target.run).toBe(run);
    expect(instrumentAsyncMethods(target, 'x')).toBe(target);
    await expect(timed('phase', run)).resolves.toBe(1);
    expect(write).not.toHaveBeenCalled();
  });
});
