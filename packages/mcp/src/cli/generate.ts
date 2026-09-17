import { randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { noopLogger } from '@mastra/core/logger';
import { register } from 'tsx/esm/api';
import { MCPClient } from '@mastra/mcp';
import type { SerializableMCPToolCatalog } from '../client/types';

class GenerationError extends Error {}

let CommonJSClient: typeof MCPClient | undefined;
function isClient(value: unknown): value is MCPClient {
  if (value instanceof MCPClient) return true;
  if (!value || typeof value !== 'object') return false;
  CommonJSClient ??= createRequire(import.meta.url)('@mastra/mcp').MCPClient;
  return value instanceof CommonJSClient!;
}

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (!missing(error)) throw error;
    // A dangling symlink must not become a new, unrelated output file.
    const entry = await lstat(path).catch(() => undefined);
    if (entry?.isSymbolicLink()) throw new GenerationError('Output path contains a dangling symlink');
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await canonical(parent), basename(path));
  }
}

/** Isolate the converter's environment-controlled logging from imported application code. */
function convert(
  definitions: SerializableMCPToolCatalog,
  signal: AbortSignal,
): Promise<{ source: string; warnings: string[] }> {
  return new Promise((accept, reject) => {
    const source = import.meta.url.endsWith('.ts');
    const entry = new URL(source ? './index.ts' : './index.js', import.meta.url).href;
    const bootstrap = `const { workerData } = require('node:worker_threads');
      (async () => {
        if (workerData.source) { const { register } = await import(workerData.loader); register(); }
        await import(workerData.entry);
      })().catch(() => process.exitCode = 1);`;
    const worker = new Worker(bootstrap, {
      eval: true,
      execArgv: [],
      env: { ...process.env, VERBOSE: '' },
      workerData: { typegen: true, source, loader: import.meta.resolve('tsx/esm/api'), entry, definitions },
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    const abort = () => {
      void worker.terminate();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    worker.once('message', result => {
      if (result.ok) accept(result.value);
      else reject(new GenerationError('Schema conversion failed'));
    });
    worker.once('error', () => reject(new GenerationError('Schema conversion failed')));
    worker.once('exit', code => {
      signal.removeEventListener('abort', abort);
      if (code !== 0 || signal.aborted) reject(new GenerationError('Schema conversion interrupted'));
    });
  });
}

/** Internal command runner. Errors are deliberately independent of imported error messages. */
export async function generate(files: string[], cwd = process.cwd()): Promise<void> {
  const clients = new Set<MCPClient>();
  const staged: { temporary: string; output: string }[] = [];
  const abort = new AbortController();
  const cleanup = new Map<MCPClient, Promise<void>>();
  const disconnect = () => {
    for (const client of clients) {
      if (!cleanup.has(client))
        cleanup.set(
          client,
          Promise.resolve().then(() => client.disconnect()),
        );
    }
    return Promise.allSettled(cleanup.values());
  };
  const interrupt = () => {
    abort.abort();
    void disconnect();
  };
  const unregister = register();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let failure: unknown;
  try {
    const inputs = new Set<string>();
    for (const file of files) {
      const input = await realpath(resolve(cwd, file));
      if (!(await stat(input)).isFile()) throw new GenerationError('Client input must be a file');
      inputs.add(input);
    }
    for (const input of inputs) {
      abort.signal.throwIfAborted();
      const module = await import(pathToFileURL(input).href);
      let eligible = false;
      for (const value of Object.values(module)) {
        if (isClient(value) && value.typegen) {
          eligible = true;
          clients.add(value);
          value.__setLogger(noopLogger);
        }
      }
      if (!eligible) throw new GenerationError('A supplied file has no exported typegen-enabled MCPClient');
    }
    const outputs = new Map<string, MCPClient>();
    for (const client of clients) {
      const output = await canonical(resolve(cwd, client.typegen!.outFile));
      if (inputs.has(output)) throw new GenerationError('Output overlaps a supplied client file');
      if (outputs.has(output)) throw new GenerationError('Multiple clients target the same output file');
      const existing = await stat(output).catch(error => {
        if (!missing(error)) throw error;
        return undefined;
      });
      if (existing && !existing.isFile()) throw new GenerationError('Output must be a file');
      outputs.set(output, client);
    }
    const prepared: { output: string; source: string }[] = [];
    let warnings = 0;
    for (const [output, client] of outputs) {
      abort.signal.throwIfAborted();
      const result = await client.listToolDefinitionsWithErrors();
      if (Object.keys(result.errors).length || Object.keys(result.errorDetails).length) {
        throw new GenerationError('MCP discovery failed; no generated files were replaced');
      }
      const converted = await convert(result.definitions, abort.signal);
      warnings += converted.warnings.length;
      prepared.push({ output, source: converted.source });
    }
    // Disconnect before replacement so cleanup failures preserve previous output too.
    if ((await disconnect()).some(result => result.status === 'rejected'))
      throw new GenerationError('MCP cleanup failed');
    for (const { output, source } of prepared) {
      abort.signal.throwIfAborted();
      await mkdir(dirname(output), { recursive: true });
      const temporary = join(dirname(output), `.mastra-mcp-${randomUUID()}.tmp`);
      staged.push({ temporary, output });
      await writeFile(temporary, source, { flag: 'wx' });
    }
    for (const { temporary, output } of staged) {
      abort.signal.throwIfAborted();
      await rename(temporary, output);
    }
    console.log(`Generated ${prepared.length} MCP type file(s).`);
    if (warnings) console.warn(`${warnings} unsupported schema portion(s) widened to unknown.`);
  } catch (error) {
    failure =
      error instanceof GenerationError
        ? error
        : new GenerationError('MCP generation failed; check client modules, permissions, and server availability');
  } finally {
    const results = await disconnect();
    const removed = await Promise.allSettled(staged.map(({ temporary }) => rm(temporary, { force: true })));
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    await unregister();
    if (results.some(result => result.status === 'rejected') || removed.some(result => result.status === 'rejected')) {
      failure ??= new GenerationError('MCP cleanup failed');
    }
  }
  if (failure) throw failure;
}
