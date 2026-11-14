import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraLogger } from '../logger';
import { Mastra } from '../mastra';
import { MastraCompositeStore } from './base';
import { InMemoryDB } from './domains/inmemory-db';
import { InMemoryMemory } from './domains/memory/inmemory';
import { InMemoryStore } from './mock';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/29885
 *
 * `new Mastra({ logger })` and `mastra.setLogger()` call `storage.__setLogger()`.
 * The composite store only replaced its own logger, so every domain store
 * (memory, workflows, schedules, ...) kept the default ConsoleLogger it built in
 * its constructor. With `logger: false` the domains still printed to the console,
 * and a custom logger never received domain logs.
 */

type LogCall = { level: 'debug' | 'info' | 'warn' | 'error'; message: string; args: unknown[] };

class CaptureLogger extends MastraLogger {
  readonly calls: LogCall[] = [];
  debug(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'debug', message, args });
  }
  info(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'info', message, args });
  }
  warn(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'warn', message, args });
  }
  error(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'error', message, args });
  }
  messages() {
    return this.calls.map(call => call.message);
  }
}

/** A real in-memory memory domain that logs when a thread lookup misses, like adapters do. */
class LoggingMemory extends InMemoryMemory {
  override async getThreadById(args: { threadId: string }) {
    const thread = await super.getThreadById(args);
    if (!thread) this.logger.error(`memory domain: thread ${args.threadId} not found`);
    return thread;
  }
}

/** A real in-memory store that logs from its own init(), like LibSQLStore's PRAGMA setup. */
class LoggingStore extends InMemoryStore {
  override async init() {
    this.logger.error('inner store: init log');
    return super.init();
  }
}

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;

describe('Mastra logger reaches composite storage domains (#29885)', () => {
  let consoleOutput: string[];

  beforeEach(() => {
    consoleOutput = [];
    for (const method of consoleMethods) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleOutput.push(args.map(String).join(' '));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints nothing from a storage domain when Mastra is created with logger: false', async () => {
    const storage = new MastraCompositeStore({
      id: 'silent',
      domains: { memory: new LoggingMemory({ db: new InMemoryDB() }) },
    });
    new Mastra({ storage, logger: false });

    const memory = await storage.getStore('memory');
    await memory!.getThreadById({ threadId: 'missing-thread' });

    expect(consoleOutput.join('\n')).not.toContain('missing-thread');
  });

  it('sends storage domain logs to the logger passed to Mastra', async () => {
    const logger = new CaptureLogger();
    const storage = new MastraCompositeStore({
      id: 'custom',
      domains: { memory: new LoggingMemory({ db: new InMemoryDB() }) },
    });
    new Mastra({ storage, logger });

    const memory = await storage.getStore('memory');
    await memory!.getThreadById({ threadId: 'missing-thread' });

    expect(logger.messages()).toContain('memory domain: thread missing-thread not found');
    expect(consoleOutput.join('\n')).not.toContain('missing-thread');
  });

  it('sends storage domain logs to a logger set later with mastra.setLogger()', async () => {
    const first = new CaptureLogger();
    const second = new CaptureLogger();
    const storage = new MastraCompositeStore({
      id: 'replaced',
      domains: { memory: new LoggingMemory({ db: new InMemoryDB() }) },
    });
    const mastra = new Mastra({ storage, logger: first });
    mastra.setLogger({ logger: second });

    const memory = await storage.getStore('memory');
    await memory!.getThreadById({ threadId: 'missing-thread' });

    expect(second.messages()).toContain('memory domain: thread missing-thread not found');
    expect(first.messages()).not.toContain('memory domain: thread missing-thread not found');
  });

  it('reaches the domains and the parent store of a composite built with `default`', async () => {
    const logger = new CaptureLogger();
    const inner = new LoggingStore({ id: 'inner' });
    const memory = new LoggingMemory({ db: new InMemoryDB() });
    const storage = new MastraCompositeStore({ id: 'outer', default: inner, domains: { memory } });
    new Mastra({ storage, logger });

    await storage.init();
    await memory.getThreadById({ threadId: 'missing-thread' });

    expect(logger.messages()).toContain('inner store: init log');
    expect(logger.messages()).toContain('memory domain: thread missing-thread not found');
    expect(consoleOutput.join('\n')).not.toContain('inner store: init log');
  });

  it('reaches the parent store of a composite built with `editor`', async () => {
    const logger = new CaptureLogger();
    const editor = new LoggingStore({ id: 'editor-inner' });
    const storage = new MastraCompositeStore({ id: 'outer-editor', editor });
    new Mastra({ storage, logger });

    await storage.init();

    expect(logger.messages()).toContain('inner store: init log');
    expect(consoleOutput.join('\n')).not.toContain('inner store: init log');
  });

  it('sends domain logs to the Mastra logger when storage is attached later with setStorage()', async () => {
    const logger = new CaptureLogger();
    const mastra = new Mastra({ logger });
    const storage = new MastraCompositeStore({
      id: 'attached-later',
      domains: { memory: new LoggingMemory({ db: new InMemoryDB() }) },
    });
    mastra.setStorage(storage);

    const memory = await storage.getStore('memory');
    await memory!.getThreadById({ threadId: 'missing-thread' });

    expect(logger.messages()).toContain('memory domain: thread missing-thread not found');
    expect(consoleOutput.join('\n')).not.toContain('missing-thread');
  });
});
