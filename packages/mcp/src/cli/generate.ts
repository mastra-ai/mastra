import { randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { noopLogger } from '@mastra/core/logger';
import { MCPClient } from '@mastra/mcp';
import type { SerializableMCPToolCatalog, SerializableMCPToolDefinition } from '../client/types';
import { countJsonValues, MAX_CATALOG_VALUES, MAX_SCHEMA_VALUES } from '../shared/json-schema-dialect';

/** Failure whose message is safe to print: it is built from supplied paths and server names only. */
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    // Checked by name rather than `instanceof` so the distinction survives bundling and separate
    // module registries, exactly as the CommonJS/ESM client identity does.
    this.name = 'GenerationError';
  }
}

/** A catalogue can widen thousands of schemas; report enough to act on without flooding a terminal. */
const MAX_REPORTED_WARNINGS = 25;

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

/**
 * Apply the value budget to a discovered catalogue before it crosses to the worker. The transfer
 * copies whatever is sent, so an oversized schema has to be widened while it is still only being
 * counted rather than after it has been copied in full. Widening to `true` generates `unknown`,
 * which is the same contract the worker produces for a schema it widens itself.
 */
export function boundTransfer(catalog: SerializableMCPToolCatalog): {
  catalog: SerializableMCPToolCatalog;
  warnings: string[];
} {
  const bounded: SerializableMCPToolCatalog = {};
  const warnings: string[] = [];
  let values = 0;
  for (const server of Object.keys(catalog)) {
    const tools: Record<string, SerializableMCPToolDefinition> = {};
    bounded[server] = tools;
    for (const tool of Object.keys(catalog[server]!)) {
      const definition = { ...catalog[server]![tool]! };
      for (const key of ['inputSchema', 'outputSchema'] as const) {
        const schema = definition[key];
        if (schema === undefined) continue;
        const counted = countJsonValues(schema, MAX_SCHEMA_VALUES);
        values += counted;
        if (counted > MAX_SCHEMA_VALUES || values > MAX_CATALOG_VALUES) {
          definition[key] = true;
          const reason =
            counted > MAX_SCHEMA_VALUES
              ? `Schema exceeds the maximum value count of ${MAX_SCHEMA_VALUES}`
              : `Catalogue exceeds the maximum value count of ${MAX_CATALOG_VALUES}`;
          warnings.push(
            `${reason} at server ${JSON.stringify(server)} tool ${JSON.stringify(tool)} ${
              key === 'inputSchema' ? 'input' : 'output'
            }; widened to unknown`,
          );
        }
      }
      tools[tool] = definition;
    }
  }
  return { catalog: bounded, warnings };
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
      // Only the generator's own `TypegenError` messages cross this boundary; converter failures
      // stay generic so their text cannot carry schema values into a diagnostic.
      else reject(new GenerationError(result.message ?? 'Schema conversion failed'));
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
  // Loaded here rather than at module scope: a top-level `tsx/esm/api` specifier
  // sorts differently against the `@mastra/mcp` self-reference depending on how
  // that self-reference resolves, which makes the import order environment-dependent.
  const { register } = await import('tsx/esm/api');
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
    const warnings: string[] = [];
    for (const [output, client] of outputs) {
      abort.signal.throwIfAborted();
      const result = await client.listToolDefinitionsWithErrors();
      const failed = [...new Set([...Object.keys(result.errors), ...Object.keys(result.errorDetails)])];
      if (failed.length) {
        throw new GenerationError(
          `MCP discovery failed for ${failed.map(name => JSON.stringify(name)).join(', ')}; no generated files were replaced`,
        );
      }
      const bounded = boundTransfer(result.definitions);
      warnings.push(...bounded.warnings);
      const converted = await convert(bounded.catalog, abort.signal);
      warnings.push(...converted.warnings);
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
    if (warnings.length) {
      console.warn(`${warnings.length} schema portion(s) widened to unknown:`);
      for (const warning of warnings.slice(0, MAX_REPORTED_WARNINGS)) console.warn(`  ${warning}`);
      if (warnings.length > MAX_REPORTED_WARNINGS)
        console.warn(`  ...and ${warnings.length - MAX_REPORTED_WARNINGS} more.`);
    }
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
