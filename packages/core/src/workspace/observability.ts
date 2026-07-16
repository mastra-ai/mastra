/**
 * Workspace Observability Wrappers
 *
 * When a `Mastra` instance with `observability` configured owns a workspace,
 * the workspace transparently wraps its filesystem and sandbox providers with
 * `Proxy` objects that instrument every method call:
 *
 * - **Traces** — each intercepted call opens a `WORKSPACE_ACTION` child span
 *   under the current ambient span (via `getCurrentSpan()`), or a top-level
 *   span when none is present. Errors mark the span, then re-throw.
 * - **Metrics** — duration histograms + byte counters + error counters emitted
 *   through `ObservabilityInstance.getMetricsContext(span)`.
 * - **Logs** — one info entry on success / one error entry on throw, emitted
 *   through `ObservabilityInstance.getLoggerContext(span)`.
 * - **Workspace activity events** — a dedicated bus channel (see
 *   `observability/types/workspace-activity.ts`) carrying `sandbox_output`
 *   (stdout/stderr chunks, truncated at 16 KB) and `filesystem_change`
 *   (mutation metadata, never contents).
 *
 * Wrapping is idempotent (memoized per raw provider via WeakMap) and only
 * runs when the workspace is registered on a `Mastra` with `observability`
 * configured. Standalone workspaces are untouched.
 */

import type { Mastra } from '../mastra';
import { getCurrentSpan } from '../observability/context-storage';
import type {
  AnySpan,
  ExportedFilesystemChange,
  ExportedSandboxOutput,
  FilesystemChangeEvent,
  FilesystemChangeOperation,
  LoggerContext,
  MetricsContext,
  ObservabilityInstance,
  SandboxOutputEvent,
  SandboxOutputSource,
  SandboxOutputStream,
} from '../observability/types';
import { SpanType } from '../observability/types';
import { generateSignalId } from '../observability/utils';
import type { WorkspaceFilesystem } from './filesystem/filesystem';
import type { WorkspaceSandbox } from './sandbox/sandbox';

/** Maximum bytes per emitted sandbox_output chunk. Longer chunks are truncated. */
export const SANDBOX_OUTPUT_CHUNK_LIMIT = 16 * 1024;

/** Filesystem method names that mutate state (emit `filesystem_change`). */
const FILESYSTEM_MUTATIONS: Record<string, FilesystemChangeOperation> = {
  writeFile: 'write',
  appendFile: 'append',
  deleteFile: 'delete',
  copyFile: 'copy',
  moveFile: 'move',
  mkdir: 'mkdir',
  rmdir: 'rmdir',
};

/** Filesystem methods we instrument (mutations + reads). */
const FILESYSTEM_METHODS = new Set([
  'readFile',
  'writeFile',
  'appendFile',
  'deleteFile',
  'copyFile',
  'moveFile',
  'mkdir',
  'rmdir',
  'readdir',
  'stat',
  'realpath',
  'exists',
]);

/** Sandbox methods we instrument (excluding the `processes` sub-object). */
const SANDBOX_METHODS = new Set([
  'executeCommand',
  'mount',
  'unmount',
  'start',
  'stop',
  'destroy',
  'isReady',
  'getInfo',
]);

/** Sandbox process-manager methods we instrument. */
const PROCESSES_METHODS = new Set(['spawn', 'list', 'get']);

// =============================================================================
// Workspace metadata carried onto every emitted signal
// =============================================================================

export interface WorkspaceInstrumentationMeta {
  workspaceId: string;
  workspaceName?: string;
}

// =============================================================================
// Truncation helper
// =============================================================================

/**
 * Truncate a string chunk to at most `limit` bytes when serialized as UTF-8.
 *
 * The chunk is walked as an iterable of Unicode code points so multi-byte
 * characters (emoji, CJK, combining marks) are never split mid-sequence.
 * `truncated: true` is set when the source, measured in UTF-8 bytes, exceeded
 * `limit`. Handles Buffer inputs by decoding as UTF-8 first.
 */
export function truncateChunk(
  chunk: string | Buffer,
  limit = SANDBOX_OUTPUT_CHUNK_LIMIT,
): { chunk: string; truncated: boolean } {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  const sourceBytes = Buffer.byteLength(text, 'utf8');
  if (sourceBytes <= limit) {
    return { chunk: text, truncated: false };
  }
  let accumulatedBytes = 0;
  let out = '';
  for (const codePoint of text) {
    const cpBytes = Buffer.byteLength(codePoint, 'utf8');
    if (accumulatedBytes + cpBytes > limit) break;
    out += codePoint;
    accumulatedBytes += cpBytes;
  }
  return { chunk: out, truncated: true };
}

// =============================================================================
// Instrumentation factory
// =============================================================================

/**
 * Return `undefined` when this Mastra has no observability configured, or has
 * only a NoOp entrypoint. Otherwise return the default `ObservabilityInstance`.
 */
function selectObservabilityInstance(mastra: Mastra): ObservabilityInstance | undefined {
  const entrypoint = mastra.observability;
  const instance = entrypoint?.getDefaultInstance?.();
  return instance;
}

/**
 * Handle for an in-flight instrumented call — carries the span (if any) plus
 * the correlated logger/metrics contexts derived from that span.
 */
interface CallCtx {
  span: AnySpan | undefined;
  traceId?: string;
  spanId?: string;
  logger: LoggerContext | undefined;
  metrics: MetricsContext | undefined;
  instance: ObservabilityInstance;
  startedAtMs: number;
}

function beginCall(
  instance: ObservabilityInstance,
  category: 'filesystem' | 'sandbox',
  operation: string,
  meta: WorkspaceInstrumentationMeta,
  provider: string,
  input?: unknown,
): CallCtx {
  const name = `workspace:${category}:${operation}`;
  const attributes = {
    category,
    workspaceId: meta.workspaceId,
    workspaceName: meta.workspaceName,
    ...(category === 'filesystem' ? { filesystemProvider: provider } : { sandboxProvider: provider }),
  };

  // Every wrapped call gets its own span. When an ambient parent span exists
  // (agent tool call, workflow step, etc.) the wrapper nests as a child.
  // Otherwise it opens a root span via `instance.startSpan` so signals
  // emitted from a direct workspace call still have a stable traceId/spanId
  // to correlate against.
  const parentSpan = getCurrentSpan();
  const span: AnySpan | undefined = parentSpan
    ? parentSpan.createChildSpan<SpanType.WORKSPACE_ACTION>({
        type: SpanType.WORKSPACE_ACTION,
        name,
        input,
        attributes,
      })
    : instance.startSpan?.<SpanType.WORKSPACE_ACTION>({
        type: SpanType.WORKSPACE_ACTION,
        name,
        input,
        attributes,
      });

  return {
    span,
    traceId: span?.traceId,
    spanId: span?.id,
    logger: instance.getLoggerContext?.(span),
    metrics: instance.getMetricsContext?.(span),
    instance,
    startedAtMs: Date.now(),
  };
}

/**
 * Run `fn` and swallow any thrown error. Used to make every post-provider
 * telemetry side effect (metric emit, log, span end, activity event) no-throw
 * so a broken exporter cannot alter or hide a provider result the caller
 * already observed.
 */
function safeEmit(fn: () => void): void {
  try {
    fn();
  } catch {
    // Intentionally swallow — telemetry must never change provider semantics.
  }
}

/**
 * Extract a redacted operation identifier from a shell command string. Commands
 * routinely embed tokens, passwords, or user data in their arguments; only the
 * program name (argv0) is recorded on spans and structured logs. The raw
 * command is still passed through to the provider for actual execution — only
 * the telemetry-facing representation is sanitized.
 */
function sanitizeCommand(command: string): string {
  if (!command) return '';
  // Trim leading whitespace, then take the first whitespace-delimited token.
  const trimmed = command.trimStart();
  const match = trimmed.match(/^\S+/);
  if (!match) return '';
  const program = match[0];
  // Strip a leading path from the program (e.g. `/usr/bin/curl` -> `curl`).
  const lastSep = Math.max(program.lastIndexOf('/'), program.lastIndexOf('\\'));
  return lastSep >= 0 ? program.slice(lastSep + 1) : program;
}

function endCallSuccess(
  ctx: CallCtx,
  category: 'filesystem' | 'sandbox',
  operation: string,
  provider: string,
  extraLog?: Record<string, unknown>,
  spanOutput?: unknown,
): void {
  const durationMs = Date.now() - ctx.startedAtMs;

  safeEmit(() =>
    ctx.metrics?.emit(`mastra.workspace.${category}.duration_ms`, durationMs, {
      operation,
      provider,
      success: 'true',
    }),
  );

  safeEmit(() =>
    ctx.logger?.info(`workspace.${category}.${operation}`, {
      provider,
      durationMs,
      ...extraLog,
    }),
  );

  safeEmit(() =>
    ctx.span?.end({
      output: spanOutput,
      attributes: { success: true },
    }),
  );
}

function endCallError(
  ctx: CallCtx,
  category: 'filesystem' | 'sandbox',
  operation: string,
  provider: string,
  err: unknown,
  extraLog?: Record<string, unknown>,
): void {
  const durationMs = Date.now() - ctx.startedAtMs;
  const error = err instanceof Error ? err : new Error(String(err));
  const errorClass = error.name || 'Error';

  safeEmit(() =>
    ctx.metrics?.emit(`mastra.workspace.${category}.duration_ms`, durationMs, {
      operation,
      provider,
      success: 'false',
    }),
  );
  safeEmit(() =>
    ctx.metrics?.emit(`mastra.workspace.${category}.errors_total`, 1, {
      operation,
      provider,
      error_class: errorClass,
    }),
  );

  safeEmit(() =>
    ctx.logger?.error(`workspace.${category}.${operation}`, {
      provider,
      durationMs,
      error: error.message,
      errorClass,
      ...extraLog,
    }),
  );

  safeEmit(() => ctx.span?.error({ error, attributes: { success: false } }));
}

// =============================================================================
// Filesystem wrapping
// =============================================================================

function emitFilesystemChange(
  ctx: CallCtx,
  meta: WorkspaceInstrumentationMeta,
  path: string,
  operation: FilesystemChangeOperation,
  bytes?: number,
  bucketName?: string,
): void {
  const change: ExportedFilesystemChange = {
    eventId: generateSignalId(),
    timestamp: new Date(),
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    workspaceId: meta.workspaceId,
    workspaceName: meta.workspaceName,
    bucketName,
    path,
    operation,
    bytes,
  };
  const event: FilesystemChangeEvent = { type: 'filesystem_change', change };
  safeEmit(() => ctx.instance.emitWorkspaceActivityEvent?.(event));
}

function extractFilesystemBytes(operation: FilesystemChangeOperation, args: unknown[]): number | undefined {
  // writeFile(path, content, options?), appendFile(path, content)
  if (operation === 'write' || operation === 'append') {
    const content = args[1];
    if (typeof content === 'string') return Buffer.byteLength(content, 'utf8');
    if (content instanceof Uint8Array) return content.byteLength;
    if (Buffer.isBuffer(content)) return content.byteLength;
  }
  return undefined;
}

function wrapFilesystemMethod(
  fs: WorkspaceFilesystem,
  method: string,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]): Promise<unknown> => {
    const path = typeof args[0] === 'string' ? args[0] : '';
    const ctx = beginCall(instance, 'filesystem', method, meta, fs.provider, { path });
    try {
      const raw = (fs as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[method];
      if (typeof raw !== 'function') {
        throw new TypeError(`Filesystem provider is missing method: ${method}`);
      }
      const result = await raw.call(fs, ...args);
      let entryCount: number | undefined;
      let bytesRead: number | undefined;
      if (method === 'readdir' && Array.isArray(result)) {
        entryCount = result.length;
      } else if (method === 'readFile') {
        if (typeof result === 'string') bytesRead = Buffer.byteLength(result, 'utf8');
        else if (result instanceof Uint8Array) bytesRead = result.byteLength;
      }

      const mutation = FILESYSTEM_MUTATIONS[method];
      const mutationBytes = mutation ? extractFilesystemBytes(mutation, args) : undefined;

      if (bytesRead != null) {
        safeEmit(() =>
          ctx.metrics?.emit('mastra.workspace.filesystem.bytes', bytesRead, {
            operation: method,
            provider: fs.provider,
            direction: 'read',
          }),
        );
      }
      if (mutation && mutationBytes != null) {
        safeEmit(() =>
          ctx.metrics?.emit('mastra.workspace.filesystem.bytes', mutationBytes, {
            operation: method,
            provider: fs.provider,
            direction: 'write',
          }),
        );
      }

      // filesystem_change on mutations only
      if (mutation) {
        // For copy/move the destination path lives in args[1].
        const changePath =
          (mutation === 'copy' || mutation === 'move') && typeof args[1] === 'string' ? args[1] : path;
        emitFilesystemChange(ctx, meta, changePath, mutation, mutationBytes);
      }

      endCallSuccess(
        ctx,
        'filesystem',
        method,
        fs.provider,
        {
          path,
          ...(entryCount != null ? { entryCount } : {}),
          ...(bytesRead != null ? { bytes: bytesRead } : {}),
          ...(mutationBytes != null ? { bytes: mutationBytes } : {}),
        },
        { path, entryCount, bytes: bytesRead ?? mutationBytes },
      );

      return result;
    } catch (err) {
      endCallError(ctx, 'filesystem', method, fs.provider, err, { path });
      throw err;
    }
  };
}

/**
 * Wrap a `WorkspaceFilesystem` with observability instrumentation.
 * The returned Proxy is memoized per raw provider in the shared per-workspace
 * cache — repeated calls with the same `fs` return the same Proxy.
 */
export function wrapFilesystem(
  fs: WorkspaceFilesystem,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): WorkspaceFilesystem {
  return new Proxy(fs, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string' || !FILESYSTEM_METHODS.has(prop) || typeof value !== 'function') {
        return value;
      }
      return wrapFilesystemMethod(target, prop, meta, instance);
    },
  });
}

// =============================================================================
// Sandbox wrapping
// =============================================================================

function emitSandboxOutput(
  ctx: CallCtx,
  meta: WorkspaceInstrumentationMeta,
  sandbox: WorkspaceSandbox,
  source: SandboxOutputSource,
  stream: SandboxOutputStream,
  chunk: string | Buffer,
  processId?: string,
): void {
  const { chunk: truncated, truncated: wasTruncated } = truncateChunk(chunk);
  if (truncated.length === 0) return;
  const output: ExportedSandboxOutput = {
    eventId: generateSignalId(),
    timestamp: new Date(),
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    workspaceId: meta.workspaceId,
    workspaceName: meta.workspaceName,
    sandboxId: sandbox.id,
    source,
    processId,
    stream,
    chunk: truncated,
    truncated: wasTruncated,
  };
  const event: SandboxOutputEvent = { type: 'sandbox_output', output };
  safeEmit(() => ctx.instance.emitWorkspaceActivityEvent?.(event));
}

function wrapSandboxExecuteCommand(
  sandbox: WorkspaceSandbox,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]): Promise<unknown> => {
    const command = typeof args[0] === 'string' ? args[0] : '';
    const commandProgram = sanitizeCommand(command);
    const ctx = beginCall(instance, 'sandbox', 'executeCommand', meta, sandbox.provider, { commandProgram });
    try {
      const raw = sandbox.executeCommand!;
      const result = (await raw.call(sandbox, ...(args as Parameters<typeof raw>))) as
        | {
            stdout?: string;
            stderr?: string;
            exitCode?: number;
          }
        | undefined;

      // Byte counters for stdout/stderr
      const stdoutBytes = result?.stdout ? Buffer.byteLength(result.stdout, 'utf8') : 0;
      const stderrBytes = result?.stderr ? Buffer.byteLength(result.stderr, 'utf8') : 0;
      if (stdoutBytes > 0) {
        safeEmit(() =>
          ctx.metrics?.emit('mastra.workspace.sandbox.stdout_bytes', stdoutBytes, {
            provider: sandbox.provider,
            source: 'exec',
          }),
        );
      }
      if (stderrBytes > 0) {
        safeEmit(() =>
          ctx.metrics?.emit('mastra.workspace.sandbox.stderr_bytes', stderrBytes, {
            provider: sandbox.provider,
            source: 'exec',
          }),
        );
      }

      // Publish stdout/stderr as sandbox_output events (truncated)
      if (result?.stdout && result.stdout.length > 0) {
        emitSandboxOutput(ctx, meta, sandbox, 'exec', 'stdout', result.stdout);
      }
      if (result?.stderr && result.stderr.length > 0) {
        emitSandboxOutput(ctx, meta, sandbox, 'exec', 'stderr', result.stderr);
      }

      endCallSuccess(
        ctx,
        'sandbox',
        'executeCommand',
        sandbox.provider,
        {
          commandProgram,
          exitCode: result?.exitCode,
          stdoutBytes,
          stderrBytes,
        },
        { exitCode: result?.exitCode, stdoutBytes, stderrBytes },
      );

      return result;
    } catch (err) {
      endCallError(ctx, 'sandbox', 'executeCommand', sandbox.provider, err, { commandProgram });
      throw err;
    }
  };
}

function wrapProcessesSpawn(
  sandbox: WorkspaceSandbox,
  processes: NonNullable<WorkspaceSandbox['processes']>,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]): Promise<unknown> => {
    const command = typeof args[0] === 'string' ? args[0] : '';
    const commandProgram = sanitizeCommand(command);
    const opts = (args[1] ?? {}) as {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    };

    const ctx = beginCall(instance, 'sandbox', 'processes.spawn', meta, sandbox.provider, { commandProgram });

    // Chain user-supplied onStdout/onStderr with our activity emitter.
    // We install our listener BEFORE spawn returns so no early chunks are missed.
    const injectedOpts: typeof opts = {
      ...opts,
    };

    let handle: { pid?: string } | undefined;
    injectedOpts.onStdout = (data: string) => {
      try {
        if (opts.onStdout) opts.onStdout(data);
      } finally {
        safeEmit(() => emitSandboxOutput(ctx, meta, sandbox, 'spawn', 'stdout', data, handle?.pid));
        const bytes = Buffer.byteLength(data, 'utf8');
        if (bytes > 0) {
          safeEmit(() =>
            ctx.metrics?.emit('mastra.workspace.sandbox.stdout_bytes', bytes, {
              provider: sandbox.provider,
              source: 'spawn',
            }),
          );
        }
      }
    };
    injectedOpts.onStderr = (data: string) => {
      try {
        if (opts.onStderr) opts.onStderr(data);
      } finally {
        safeEmit(() => emitSandboxOutput(ctx, meta, sandbox, 'spawn', 'stderr', data, handle?.pid));
        const bytes = Buffer.byteLength(data, 'utf8');
        if (bytes > 0) {
          safeEmit(() =>
            ctx.metrics?.emit('mastra.workspace.sandbox.stderr_bytes', bytes, {
              provider: sandbox.provider,
              source: 'spawn',
            }),
          );
        }
      }
    };

    try {
      const rawSpawn = (processes as unknown as { spawn: (...a: unknown[]) => Promise<unknown> }).spawn;
      const result = await rawSpawn.call(processes, args[0], injectedOpts, ...args.slice(2));
      handle = result as { pid?: string };
      endCallSuccess(
        ctx,
        'sandbox',
        'processes.spawn',
        sandbox.provider,
        { commandProgram, pid: handle?.pid },
        { pid: handle?.pid },
      );
      return result;
    } catch (err) {
      endCallError(ctx, 'sandbox', 'processes.spawn', sandbox.provider, err, { commandProgram });
      throw err;
    }
  };
}

function wrapPlainSandboxMethod(
  sandbox: WorkspaceSandbox,
  method: string,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]): Promise<unknown> => {
    const ctx = beginCall(instance, 'sandbox', method, meta, sandbox.provider);
    try {
      const raw = (sandbox as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[method];
      if (typeof raw !== 'function') {
        throw new TypeError(`Sandbox provider is missing method: ${method}`);
      }
      const result = await raw.call(sandbox, ...args);
      endCallSuccess(ctx, 'sandbox', method, sandbox.provider, undefined, undefined);
      return result;
    } catch (err) {
      endCallError(ctx, 'sandbox', method, sandbox.provider, err);
      throw err;
    }
  };
}

function wrapPlainProcessesMethod(
  sandbox: WorkspaceSandbox,
  processes: NonNullable<WorkspaceSandbox['processes']>,
  method: string,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]): Promise<unknown> => {
    const ctx = beginCall(instance, 'sandbox', `processes.${method}`, meta, sandbox.provider);
    try {
      const raw = (processes as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>)[
        method
      ];
      if (typeof raw !== 'function') {
        throw new TypeError(`Sandbox process manager is missing method: ${method}`);
      }
      const result = await raw.call(processes, ...args);
      endCallSuccess(ctx, 'sandbox', `processes.${method}`, sandbox.provider, undefined, undefined);
      return result;
    } catch (err) {
      endCallError(ctx, 'sandbox', `processes.${method}`, sandbox.provider, err);
      throw err;
    }
  };
}

function wrapProcesses(
  sandbox: WorkspaceSandbox,
  processes: NonNullable<WorkspaceSandbox['processes']>,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): NonNullable<WorkspaceSandbox['processes']> {
  return new Proxy(processes, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string' || !PROCESSES_METHODS.has(prop) || typeof value !== 'function') {
        return value;
      }
      if (prop === 'spawn') {
        return wrapProcessesSpawn(sandbox, target, meta, instance);
      }
      return wrapPlainProcessesMethod(sandbox, target, prop, meta, instance);
    },
  }) as NonNullable<WorkspaceSandbox['processes']>;
}

/**
 * Wrap a `WorkspaceSandbox` with observability instrumentation.
 * The returned Proxy is memoized per raw provider — repeated calls with the
 * same `sandbox` return the same Proxy.
 */
export function wrapSandbox(
  sandbox: WorkspaceSandbox,
  meta: WorkspaceInstrumentationMeta,
  instance: ObservabilityInstance,
): WorkspaceSandbox {
  // The wrapped `processes` sub-object is cached lazily on first access so
  // that repeated `sandbox.processes` reads return the same Proxy.
  let cachedProcesses: NonNullable<WorkspaceSandbox['processes']> | undefined;

  return new Proxy(sandbox, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'processes') {
        if (!value) return value;
        if (!cachedProcesses) {
          cachedProcesses = wrapProcesses(
            target,
            value as NonNullable<WorkspaceSandbox['processes']>,
            meta,
            instance,
          );
        }
        return cachedProcesses;
      }

      if (typeof prop !== 'string' || !SANDBOX_METHODS.has(prop) || typeof value !== 'function') {
        return value;
      }

      if (prop === 'executeCommand') {
        return wrapSandboxExecuteCommand(target, meta, instance);
      }
      return wrapPlainSandboxMethod(target, prop, meta, instance);
    },
  });
}

// =============================================================================
// Top-level factory used by Workspace
// =============================================================================

/**
 * Build a memoized instrumentation helper for a specific workspace. The
 * returned functions memoize wrapped providers by raw-provider identity via
 * the shared `wrapCache`, so a resolver returning the same provider twice
 * yields the same Proxy.
 */
export interface WorkspaceInstrumentation {
  wrapFilesystem(fs: WorkspaceFilesystem): WorkspaceFilesystem;
  wrapSandbox(sandbox: WorkspaceSandbox): WorkspaceSandbox;
}

/**
 * Cache entry that ties a wrapped provider Proxy to the specific
 * `ObservabilityInstance` it closes over. Re-registration on `Mastra` (or a
 * caller swapping the default instance) invalidates the entry so the next
 * getter access rebuilds the Proxy against the new instance.
 */
interface WrapCacheEntry {
  instance: ObservabilityInstance;
  wrapped: WorkspaceFilesystem | WorkspaceSandbox;
}

export type WorkspaceProviderWrapCache = WeakMap<object, WrapCacheEntry>;

export function createWorkspaceInstrumentation(
  mastra: Mastra,
  meta: WorkspaceInstrumentationMeta,
  wrapCache: WorkspaceProviderWrapCache,
): WorkspaceInstrumentation {
  return {
    wrapFilesystem(fs: WorkspaceFilesystem): WorkspaceFilesystem {
      const instance = selectObservabilityInstance(mastra);
      if (!instance) return fs;
      const cached = wrapCache.get(fs);
      if (cached && cached.instance === instance) return cached.wrapped as WorkspaceFilesystem;
      const wrapped = wrapFilesystem(fs, meta, instance);
      wrapCache.set(fs, { instance, wrapped });
      return wrapped;
    },
    wrapSandbox(sandbox: WorkspaceSandbox): WorkspaceSandbox {
      const instance = selectObservabilityInstance(mastra);
      if (!instance) return sandbox;
      const cached = wrapCache.get(sandbox);
      if (cached && cached.instance === instance) return cached.wrapped as WorkspaceSandbox;
      const wrapped = wrapSandbox(sandbox, meta, instance);
      wrapCache.set(sandbox, { instance, wrapped });
      return wrapped;
    },
  };
}
