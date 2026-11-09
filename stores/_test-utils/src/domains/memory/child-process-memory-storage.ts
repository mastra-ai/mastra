import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MemoryStorage } from '@mastra/core/storage';

/**
 * A `MemoryStorage` whose methods run in a forked child process. Use it for cross-process
 * races: some drivers (e.g. the synchronous `libsql` binding) block the whole event loop while
 * waiting on a database lock, so two connections in one process cannot actually contend.
 *
 * The child constructs `new (await import(modulePath))[exportName](options)`, awaits `init()`,
 * and serves its methods over IPC (`serialization: 'advanced'`, so Dates survive).
 */
export async function createChildProcessMemoryStorage({
  modulePath,
  exportName,
  options,
}: {
  /** Absolute path (or file URL) of the module exporting the storage class. */
  modulePath: string;
  exportName: string;
  /** JSON-serializable constructor options. */
  options: unknown;
}): Promise<{ storage: MemoryStorage; close: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), 'memory-storage-child-'));
  const scriptPath = join(dir, 'child.mts');
  const moduleUrl = modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href;
  writeFileSync(
    scriptPath,
    [
      `import { serveMemoryStorageInChildProcess } from ${JSON.stringify(import.meta.url)};`,
      `const mod = await import(${JSON.stringify(moduleUrl)});`,
      `const options = JSON.parse(process.argv[2]);`,
      `await serveMemoryStorageInChildProcess(async () => {`,
      `  const storage = new mod[${JSON.stringify(exportName)}](options);`,
      `  await storage.init?.();`,
      `  return storage;`,
      `});`,
    ].join('\n'),
  );
  const child: ChildProcess = fork(scriptPath, [JSON.stringify(options)], {
    execArgv: ['--import', 'tsx'],
    serialization: 'advanced',
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let nextId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>(resolve => {
        child.once('exit', () => resolve());
        child.kill();
      });
    }
    rmSync(dir, { recursive: true, force: true });
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const onMessage = (message: { type?: string; error?: string }) => {
        if (message?.type === 'ready') {
          child.off('message', onMessage);
          resolve();
        } else if (message?.type === 'init-error') {
          reject(new Error(message.error));
        }
      };
      child.on('message', onMessage);
      child.once('exit', code => reject(new Error(`child exited during init with code ${code}`)));
    });
  } catch (error) {
    await stop();
    throw error;
  }

  child.on('message', (message: { id: number; result?: unknown; error?: string }) => {
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error !== undefined) call.reject(new Error(message.error));
    else call.resolve(message.result);
  });
  child.on('exit', () => {
    for (const call of pending.values()) call.reject(new Error('child process exited'));
    pending.clear();
  });

  const storage = new Proxy(
    {},
    {
      get: (_target, method) => {
        if (typeof method !== 'string' || method === 'then') return undefined;
        return (...callArgs: unknown[]) =>
          new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            child.send({ id, method, args: callArgs });
          });
      },
    },
  ) as MemoryStorage;

  return {
    storage,
    close: stop,
  };
}

/** Serve `storage`'s methods to the parent over IPC (see {@link createChildProcessMemoryStorage}). */
export async function serveMemoryStorageInChildProcess(createStorage: () => Promise<MemoryStorage>): Promise<void> {
  let storage: MemoryStorage;
  try {
    storage = await createStorage();
  } catch (error) {
    process.send!({ type: 'init-error', error: String(error) });
    return;
  }
  process.on('message', async (message: { id: number; method: string; args: unknown[] }) => {
    try {
      const fn = (storage as unknown as Record<string, (...args: unknown[]) => unknown>)[message.method];
      if (typeof fn !== 'function') throw new Error(`Unknown storage method: ${message.method}`);
      const result = await fn.apply(storage, message.args);
      process.send!({ id: message.id, result });
    } catch (error) {
      process.send!({ id: message.id, error: error instanceof Error ? error.message : String(error) });
    }
  });
  process.send!({ type: 'ready' });
}
