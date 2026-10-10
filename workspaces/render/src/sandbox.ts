import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rename, rm, writeFile as writeLocalFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createGunzip } from 'node:zlib';
import type {
  CommandResult,
  ExecuteCommandOptions,
  ProviderStatus,
  SandboxFileInput,
  SandboxInfo,
  WorkspaceSandbox,
} from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import type {
  SandboxCreateInput,
  SandboxUploadData,
  SandboxUploadOptions,
  SandboxDownload,
  SandboxSnapshot,
  SandboxSnapshotCreateInput,
} from '@renderinc/sdk/experimental';
import { executeControlled } from './control.js';
import { RenderSandboxError } from './errors.js';
import { normalizeNetworkPolicy, type RenderSandboxCreateInput } from './network.js';
import { RenderSnapshots, type SnapshotWaitOptions } from './snapshots.js';
import { bounded, deadline, OutputTail, positive, quote } from './utils.js';

type SandboxClient = Render['experimental']['sandboxes'];
type RemoteSandbox = Awaited<ReturnType<SandboxClient['create']>>;

export interface RenderSandboxOptions {
  /** Logical Mastra ID, separate from Render's resource ID. */
  id?: string;
  /** Attach without taking ownership. Never falls back to creation. */
  sandboxId?: string;
  /** Reuse a host-side public SDK client. Mutually exclusive with clientOptions. */
  client?: Render;
  clientOptions?: ConstructorParameters<typeof Render>[0];
  /** Explicit owner for all sandbox operations; otherwise SDK defaults apply. */
  ownerId?: `tea-${string}`;
  /** Creation-only configuration. Credentials are never copied here automatically. */
  create?: RenderSandboxCreateInput;
  workingDirectory?: string;
  readyTimeoutMs?: number;
  pollIntervalMs?: number;
  /** Default command deadline; cancellationMode determines how expiry is handled. */
  commandTimeoutMs?: number;
  controlTimeoutMs?: number;
  maxOutputBytes?: number;
  /** Optional transfer limit. Infinity (default) imposes no adapter ceiling. */
  maxFileBytes?: number;
  /** command: stop only this command; observe: stop waiting; terminate: dispose owned sandbox. */
  cancellationMode?: 'command' | 'observe' | 'terminate';
  checkpointName?: string;
  snapshotTimeoutMs?: number;
}

/** Public Workspace capability adapter. It deliberately exposes no process manager or mounts. */
export class RenderSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'Render Sandbox';
  readonly provider = 'render';
  readonly owned: boolean;
  readonly workingDirectory: string;
  status: ProviderStatus = 'pending';
  /** Retained after disposal, including for manual cleanup when a request fails. */
  sandboxId?: string;
  /** A late create response can arrive after the caller's deadline. */
  pendingCreation?: Promise<void>;
  cleanupError?: unknown;

  private client?: Render;
  private readonly options: RenderSandboxOptions;
  private readonly createInput: SandboxCreateInput;
  private readonly ownerId?: `tea-${string}`;
  private readonly readyMs: number;
  private readonly pollMs: number;
  private readonly commandMs: number;
  private readonly controlMs: number;
  private readonly outputLimit: number;
  private readonly fileLimit: number;
  private readonly lifetime = new AbortController();
  private closing = false;
  private readonly operations = new Set<Promise<unknown>>();
  readonly snapshots: RenderSnapshots;
  lastSnapshot?: SandboxSnapshot;
  private checkpointPromise?: Promise<void>;
  private checkpointNames?: string[];
  private startPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private terminatePromise?: Promise<void>;
  private terminated = false;
  private createAttempted = false;
  private creationSettled = false;
  private creationUnknown = false;
  private remote?: RemoteSandbox;

  constructor(options: RenderSandboxOptions = {}) {
    if (options.client && options.clientOptions)
      throw new RenderSandboxError('CONFIGURATION', 'Use client or clientOptions, not both');
    if (options.sandboxId && options.create)
      throw new RenderSandboxError('CONFIGURATION', 'Creation options cannot be used when attaching');
    if (options.ownerId && options.create?.ownerId && options.ownerId !== options.create.ownerId) {
      throw new RenderSandboxError('CONFIGURATION', 'Creation and operation owner IDs must match');
    }
    this.options = { ...options, clientOptions: options.clientOptions && { ...options.clientOptions } };
    this.client = options.client;
    this.id = options.id ?? `render-${randomUUID()}`;
    this.sandboxId = options.sandboxId;
    this.owned = !options.sandboxId;
    this.ownerId = options.ownerId ?? options.create?.ownerId;
    this.workingDirectory = options.workingDirectory ?? '/';
    if (!posix.isAbsolute(this.workingDirectory))
      throw new RenderSandboxError('CONFIGURATION', 'workingDirectory must be absolute');
    quote(this.workingDirectory);
    this.readyMs = positive(options.readyTimeoutMs ?? 120_000, 'readyTimeoutMs');
    this.pollMs = positive(options.pollIntervalMs ?? 1_000, 'pollIntervalMs');
    this.commandMs = positive(options.commandTimeoutMs ?? 60_000, 'commandTimeoutMs');
    this.controlMs = positive(options.controlTimeoutMs ?? 30_000, 'controlTimeoutMs');
    this.outputLimit = positive(options.maxOutputBytes ?? 1_048_576, 'maxOutputBytes', 16_777_216);
    this.fileLimit =
      options.maxFileBytes === undefined || options.maxFileBytes === Infinity
        ? Infinity
        : positive(options.maxFileBytes, 'maxFileBytes', Number.MAX_SAFE_INTEGER);
    this.snapshots = new RenderSnapshots(() => this.api.snapshots, this.ownerId, this.controlMs, this.pollMs);
    if (options.snapshotTimeoutMs !== undefined) positive(options.snapshotTimeoutMs, 'snapshotTimeoutMs');
    if (options.cancellationMode && !['command', 'observe', 'terminate'].includes(options.cancellationMode))
      throw new RenderSandboxError('CONFIGURATION', 'Invalid cancellationMode');
    this.createInput = structuredClone({
      ...options.create,
      timeoutSeconds: positive(options.create?.timeoutSeconds ?? 900, 'timeoutSeconds', 86_400),
      networkPolicy: normalizeNetworkPolicy(options.create?.networkPolicy),
      ...(this.ownerId ? { ownerId: this.ownerId } : {}),
    });
  }

  /** Public SDK access for provider-specific capabilities, using the same host client. */
  get sdk(): SandboxClient {
    return this.api;
  }

  private get api(): SandboxClient {
    try {
      return (this.client ??= new Render(this.options.clientOptions)).experimental.sandboxes;
    } catch (cause) {
      throw new RenderSandboxError('CONFIGURATION', 'Render client configuration is invalid', {}, { cause });
    }
  }

  private assertOpen() {
    if (this.closing || this.status === 'destroyed' || this.status === 'error') {
      throw new RenderSandboxError(
        'STATE',
        'This sandbox provider is closed or failed; create a new provider instance',
        { sandboxId: this.sandboxId },
      );
    }
  }

  async start(options?: { abortSignal?: AbortSignal }): Promise<void> {
    this.assertOpen();
    options?.abortSignal?.throwIfAborted();
    if (this.startPromise)
      return options?.abortSignal ? bounded(this.startPromise, options.abortSignal) : this.startPromise;
    if (this.status === 'running') return;
    this.startPromise = this.acquire();
    try {
      await (options?.abortSignal ? bounded(this.startPromise, options.abortSignal) : this.startPromise);
    } finally {
      // An individual waiter aborting must not invalidate shared provisioning.
      const pending = this.startPromise;
      void pending
        ?.finally(() => {
          if (this.startPromise === pending) this.startPromise = undefined;
        })
        .catch(() => {});
    }
  }

  private async acquire(signal?: AbortSignal): Promise<void> {
    this.status = 'starting';
    const wait = deadline(this.readyMs, [signal, this.lifetime.signal]);
    try {
      if (this.owned) {
        if (this.createAttempted)
          throw new RenderSandboxError('STATE', 'Creation was already attempted; do not retry uncertain provisioning');
        const api = this.api;
        let input = this.createInput;
        if (this.checkpointNames?.length) {
          const groups = await bounded(api.listGroups({ ownerId: this.ownerId }), wait.signal);
          const available: SandboxSnapshot[] = [];
          for (const { sandboxGroup } of groups) {
            let cursor: string | undefined;
            do {
              const page = await bounded(
                api.snapshots.list({
                  sandboxGroupId: sandboxGroup.id,
                  ownerId: this.ownerId,
                  status: ['available'],
                  limit: 100,
                  cursor,
                }),
                wait.signal,
              );
              available.push(...page.map(row => row.snapshot));
              cursor = page.length === 100 ? page.at(-1)?.cursor : undefined;
            } while (cursor);
          }
          const selected = this.checkpointNames
            .map(name => available.find(snapshot => snapshot.name === name))
            .find(Boolean);
          if (selected) {
            const { snapshotId: _id, snapshotName: _name, ...base } = input;
            if (selected.kind === 'runtime' && input.plan && input.plan !== selected.plan)
              throw new RenderSandboxError('CONFIGURATION', 'Runtime checkpoint requires its original plan');
            input = {
              ...base,
              snapshotId: selected.id,
              ...(selected.kind === 'runtime' ? { plan: selected.plan } : {}),
            };
          }
        }
        this.createAttempted = true;
        this.creationUnknown = true;
        // No SDK create cancellation/idempotency. Keep the eventual ID and clean up a late success.
        this.pendingCreation = api
          .create(input)
          .then(async remote => {
            this.creationUnknown = false;
            this.remote = remote;
            this.sandboxId = remote.id;
            if (this.closing) await this.terminateKnown();
          })
          .catch(error => {
            const status = (error as { statusCode?: number })?.statusCode;
            if (status && status >= 400 && status < 500) this.creationUnknown = false;
            throw error;
          })
          .finally(() => {
            this.creationSettled = true;
          });
        this.pendingCreation.catch(error => {
          if (this.closing) this.cleanupError = error;
        });
        await bounded(this.pendingCreation, wait.signal);
      }
      while (true) {
        wait.signal.throwIfAborted();
        this.remote = await bounded(this.api.get(this.sandboxId!, this.ownerId), wait.signal);
        if (this.remote?.status === 'running') break;
        if (!this.remote || this.remote.status !== 'creating') {
          throw new RenderSandboxError('STATE', `Sandbox cannot run: ${this.remote?.status ?? 'missing response'}`, {
            sandboxId: this.sandboxId,
          });
        }
        await delay(this.pollMs, undefined, { signal: wait.signal });
      }
      this.status = 'running';
    } catch (cause) {
      const failure = this.failure(cause, wait.signal);
      this.closing = true;
      this.status = 'error';
      await this.cleanupAfterFailure();
      throw new RenderSandboxError(
        failure.code,
        failure.message,
        { ...failure.details, cleanupError: this.cleanupError, remoteMayBeRunning: this.mayBeRunning },
        { cause },
      );
    } finally {
      wait.dispose();
    }
  }

  private failure(cause: unknown, signal?: AbortSignal, output: Record<string, unknown> = {}): RenderSandboxError {
    const code = (cause as { statusCode?: number })?.statusCode;
    const reason = signal?.aborted ? signal.reason : cause;
    const errorCode =
      reason instanceof RenderSandboxError
        ? reason.code
        : signal?.aborted
          ? 'ABORTED'
          : code === 401 || code === 403
            ? 'AUTHENTICATION'
            : code === 404
              ? 'NOT_FOUND'
              : 'STREAM';
    return new RenderSandboxError(
      errorCode,
      `Render sandbox ${errorCode.toLowerCase()} failure`,
      {
        sandboxId: this.sandboxId,
        remoteMayBeRunning: this.mayBeRunning,
        cleanupError: this.cleanupError,
        ...output,
      },
      { cause },
    );
  }

  private get mayBeRunning(): boolean {
    return !this.terminated && (!!this.sandboxId || this.creationUnknown);
  }

  private async cleanupAfterFailure() {
    if (!this.owned) return;
    this.closing = true;
    this.lifetime.abort(new RenderSandboxError('ABORTED', 'Sandbox is being disposed'));
    try {
      await this.terminateKnown();
    } catch (error) {
      this.cleanupError = error;
    }
  }

  private async operation<T>(fn: () => Promise<T>): Promise<T> {
    this.assertOpen();
    const pending = Promise.resolve().then(fn);
    this.operations.add(pending);
    try {
      return await pending;
    } finally {
      this.operations.delete(pending);
    }
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    return this.operation(async () => {
      options.abortSignal?.throwIfAborted();
      if (
        (this.options.cancellationMode === 'observe' ||
          (this.options.cancellationMode === 'terminate' && !this.owned)) &&
        options.timeout !== undefined
      ) {
        throw new RenderSandboxError(
          'UNSUPPORTED',
          'This cancellation mode only stops observation. Use command mode for a terminating timeout.',
        );
      }
      const ms = positive(options.timeout ?? this.commandMs, 'timeout');
      const requested = options.maxRetainedBytes ?? this.outputLimit;
      if (!Number.isSafeInteger(requested) || requested < 0 || requested > this.outputLimit) {
        throw new RenderSandboxError('CONFIGURATION', `maxRetainedBytes must be 0 through ${this.outputLimit}`);
      }
      const invocation = args.length ? [quote(command), ...args.map(quote)].join(' ') : command;
      quote(invocation);
      const cwd = options.cwd ?? this.workingDirectory;
      if (!posix.isAbsolute(cwd)) throw new RenderSandboxError('CONFIGURATION', 'cwd must be absolute');
      const env = Object.entries(options.env ?? {})
        .map(([key, value]) => {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
            throw new RenderSandboxError('CONFIGURATION', 'Invalid environment variable name');
          return value === undefined ? `unset ${key};` : `export ${key}=${quote(value)};`;
        })
        .join(' ');
      const script = `cd -- ${quote(cwd)} && ( ${env ? `${env} ` : ''}exec bash -c ${quote(invocation)} )`;
      await this.start({ abortSignal: options.abortSignal });
      if ((this.options.cancellationMode ?? 'command') === 'command') {
        return executeControlled({
          api: this.api,
          id: this.sandboxId!,
          owner: this.ownerId,
          script,
          command,
          args,
          options,
          timeoutMs: ms,
          controlMs: this.controlMs,
          limit: requested,
          lifetime: this.lifetime.signal,
        });
      }
      return this.run(script, options, ms, requested, command, args);
    });
  }

  private async run(
    script: string,
    options: ExecuteCommandOptions,
    ms: number,
    limit: number,
    command: string,
    args: string[],
  ): Promise<CommandResult> {
    const started = Date.now();
    const wait = deadline(ms, [options.abortSignal, this.lifetime.signal]);
    const stdout = new OutputTail(limit),
      stderr = new OutputTail(limit);
    let stream: Awaited<ReturnType<SandboxClient['exec']>> | undefined;
    try {
      stream = await bounded(this.api.exec(this.sandboxId!, script, this.ownerId, wait.signal), wait.signal);
      let exit: number | undefined;
      while (true) {
        const event = await bounded(stream.next(), wait.signal);
        if (event.done) break;
        if (event.value.type === 'exit') {
          exit = event.value.exit_code;
          break;
        }
        if (event.value.stream === 'stdout') {
          stdout.push(event.value.data);
          options.onStdout?.(event.value.data);
        } else {
          stderr.push(event.value.data);
          options.onStderr?.(event.value.data);
        }
      }
      // Do not turn interrupted streams into exit 0 or retry an uncertain command.
      if (!Number.isInteger(exit)) throw new RenderSandboxError('STREAM', 'No final exit event received');
      return {
        command,
        args,
        exitCode: exit!,
        success: exit === 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        executionTimeMs: Date.now() - started,
        stdoutTruncated: stdout.dropped > 0,
        stderrTruncated: stderr.dropped > 0,
        stdoutDroppedBytes: stdout.dropped,
        stderrDroppedBytes: stderr.dropped,
      };
    } catch (cause) {
      // Capture the original signal reason before cleanup aborts the lifetime signal.
      const failure = this.failure(cause, wait.signal, {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        stdoutDroppedBytes: stdout.dropped,
        stderrDroppedBytes: stderr.dropped,
      });
      if (this.options.cancellationMode === 'terminate') {
        this.status = 'error';
        this.closing = true;
        await this.cleanupAfterFailure();
      }
      throw new RenderSandboxError(
        failure.code,
        this.mayBeRunning
          ? `${failure.message}. Remote work may still be running; termination was not confirmed.`
          : failure.message,
        {
          ...failure.details,
          remoteMayBeRunning: this.mayBeRunning,
          cleanupError: this.cleanupError,
        },
        { cause },
      );
    } finally {
      wait.dispose();
      // The exit event suspends the SDK generator before its reader-finally runs.
      void stream?.return(undefined).catch(() => {});
    }
  }

  /** Native SDK event stream. Abort/iterator close stops observation, not remote execution. */
  async *exec(command: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}) {
    this.assertOpen();
    quote(command);
    options.signal?.throwIfAborted();
    let finished!: () => void;
    const pending = new Promise<void>(resolve => {
      finished = resolve;
    });
    const wait = deadline(options.timeoutMs ?? this.commandMs, [options.signal, this.lifetime.signal]);
    this.operations.add(pending);
    let stream: Awaited<ReturnType<SandboxClient['exec']>> | undefined;
    try {
      await this.start({ abortSignal: wait.signal });
      stream = await bounded(this.api.exec(this.sandboxId!, command, this.ownerId, wait.signal), wait.signal);
      while (true) {
        const event = await bounded(stream.next(), wait.signal);
        if (event.done) break;
        yield event.value;
        if (event.value.type === 'exit') break;
      }
    } finally {
      wait.dispose();
      void stream?.return(undefined).catch(() => {});
      this.operations.delete(pending);
      finished();
    }
  }

  /** Native file upload, with explicitly command-backed parent creation and permissions. */
  async writeFiles(files: SandboxFileInput[], options: { abortSignal?: AbortSignal } = {}): Promise<void> {
    return this.operation(async () => {
      options.abortSignal?.throwIfAborted();
      for (const file of files) {
        if (!posix.isAbsolute(file.path))
          throw new RenderSandboxError('CONFIGURATION', 'Upload paths must be absolute');
        quote(file.path);
        if (Buffer.byteLength(file.content) > this.fileLimit)
          throw new RenderSandboxError('FILE_LIMIT', 'Upload exceeds maxFileBytes');
        if (file.mode !== undefined && (!Number.isInteger(file.mode) || file.mode < 1 || file.mode > 0o777)) {
          throw new RenderSandboxError('CONFIGURATION', 'File mode must be from 0o001 to 0o777');
        }
      }
      await this.start({ abortSignal: options.abortSignal });
      const wait = deadline(this.commandMs, [options.abortSignal, this.lifetime.signal]);
      try {
        for (const file of files) {
          const mkdir = await this.run(
            `mkdir -p -- ${quote(posix.dirname(file.path))}`,
            { abortSignal: wait.signal },
            this.commandMs,
            this.outputLimit,
            'mkdir',
            [],
          );
          if (!mkdir.success) throw new Error(`Parent creation exited ${mkdir.exitCode}`);
          await bounded(
            this.api.upload(this.sandboxId!, file.path, file.content, this.ownerId, { signal: wait.signal }),
            wait.signal,
          );
          if (file.mode !== undefined) {
            const chmod = await this.run(
              `chmod ${file.mode.toString(8)} -- ${quote(file.path)}`,
              { abortSignal: wait.signal },
              this.commandMs,
              this.outputLimit,
              'chmod',
              [],
            );
            if (!chmod.success) throw new Error(`chmod exited ${chmod.exitCode}`);
          }
        }
      } catch (cause) {
        const failure = this.failure(cause, wait.signal);
        if (this.options.cancellationMode === 'terminate') {
          this.status = 'error';
          this.closing = true;
          await this.cleanupAfterFailure();
        }
        throw new RenderSandboxError(
          failure.code,
          failure.message,
          { ...failure.details, cleanupError: this.cleanupError, remoteMayBeRunning: this.mayBeRunning },
          { cause },
        );
      } finally {
        wait.dispose();
      }
    });
  }

  /** Download an artifact into memory. Configure maxFileBytes to impose a size limit. */
  async readFile(path: string, options: { abortSignal?: AbortSignal } = {}): Promise<Buffer> {
    return this.operation(async () => {
      options.abortSignal?.throwIfAborted();
      if (!posix.isAbsolute(path)) throw new RenderSandboxError('CONFIGURATION', 'Download paths must be absolute');
      quote(path);
      await this.start({ abortSignal: options.abortSignal });
      const wait = deadline(this.commandMs, [options.abortSignal, this.lifetime.signal]);
      try {
        const stat = await this.run(
          `test -f ${quote(path)} && stat -Lc %s -- ${quote(path)}`,
          { abortSignal: wait.signal },
          this.commandMs,
          1024,
          'stat',
          [],
        );
        if (!stat.success) throw new RenderSandboxError('NOT_FOUND', 'Download requires an existing regular file');
        const size = Number(stat.stdout.trim());
        if (!Number.isSafeInteger(size) || size < 0 || size > this.fileLimit)
          throw new RenderSandboxError('FILE_LIMIT', 'Download exceeds maxFileBytes');
        const download = await bounded(
          this.api.download(this.sandboxId!, path, this.ownerId, wait.signal),
          wait.signal,
        );
        if (download.data.length > this.fileLimit)
          throw new RenderSandboxError('FILE_LIMIT', 'File grew past maxFileBytes during download');
        return download.data;
      } catch (cause) {
        if (cause instanceof RenderSandboxError && ['NOT_FOUND', 'FILE_LIMIT'].includes(cause.code)) throw cause;
        const failure = this.failure(cause, wait.signal);
        if (this.options.cancellationMode === 'terminate') {
          this.status = 'error';
          this.closing = true;
          await this.cleanupAfterFailure();
        }
        throw new RenderSandboxError(
          failure.code,
          failure.message,
          { ...failure.details, cleanupError: this.cleanupError, remoteMayBeRunning: this.mayBeRunning },
          { cause },
        );
      } finally {
        wait.dispose();
      }
    });
  }

  /** Upload bytes, a Node stream, or a tar/gzip archive using the public SDK. */
  async upload(
    path: string,
    data: SandboxUploadData,
    options: SandboxUploadOptions & { timeoutMs?: number } = {},
  ): Promise<void> {
    const observeError = () => {};
    if (data instanceof Readable) data.once('error', observeError);
    return this.operation(async () => {
      if (!posix.isAbsolute(path)) throw new RenderSandboxError('CONFIGURATION', 'Upload paths must be absolute');
      quote(path);
      options.signal?.throwIfAborted();
      if (!(data instanceof Readable) && Buffer.byteLength(data) > this.fileLimit)
        throw new RenderSandboxError('FILE_LIMIT', 'Upload exceeds maxFileBytes');
      await this.start({ abortSignal: options.signal });
      const wait = deadline(options.timeoutMs ?? this.commandMs, [options.signal, this.lifetime.signal]);
      let source: Readable | undefined;
      let decompressed: Readable | undefined;
      let decompress: Promise<void> | undefined;
      try {
        const directory =
          options.contentType && options.contentType !== 'application/octet-stream' ? path : posix.dirname(path);
        const mkdir = await this.run(
          `mkdir -p -- ${quote(directory)}`,
          { abortSignal: wait.signal },
          this.commandMs,
          this.outputLimit,
          'mkdir',
          [],
        );
        if (!mkdir.success) throw new RenderSandboxError('STREAM', 'Cannot create upload directory');
        if (data instanceof Readable && data.errored) throw data.errored;
        let payload = data;
        if (options.contentType === 'application/gzip') {
          // SDK 1.2.0 advertises gzip, but the live endpoint rejects that media
          // type. Decompress as a stream and use its supported tar extraction.
          const gunzip = createGunzip();
          decompressed = gunzip;
          decompress = pipeline(data instanceof Readable ? data : Readable.from([data]), gunzip, {
            signal: wait.signal,
          });
          void decompress.catch(() => {});
          payload = gunzip;
        }
        if (payload instanceof Readable) {
          const input = payload;
          const limit = this.fileLimit;
          source = Readable.from(
            (async function* () {
              let count = 0;
              for await (const chunk of input) {
                wait.signal.throwIfAborted();
                const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                count += bytes.length;
                if (count > limit) throw new RenderSandboxError('FILE_LIMIT', 'Upload exceeds maxFileBytes');
                yield bytes;
              }
            })(),
          );
          payload = source;
        }
        await bounded(
          this.api.upload(this.sandboxId!, path, payload, this.ownerId, {
            contentType: options.contentType === 'application/gzip' ? 'application/x-tar' : options.contentType,
            signal: wait.signal,
          }),
          wait.signal,
        );
        await decompress;
      } catch (cause) {
        if (cause instanceof RenderSandboxError && cause.code === 'FILE_LIMIT') throw cause;
        throw this.failure(cause, wait.signal);
      } finally {
        wait.dispose();
        source?.destroy();
        decompressed?.destroy();
        if (data instanceof Readable) data.destroy();
      }
    }).finally(() => {
      if (data instanceof Readable) {
        data.once('close', () => data.off('error', observeError));
        data.destroy();
      }
    });
  }

  uploadFile(localPath: string, remotePath: string, options: SandboxUploadOptions & { timeoutMs?: number } = {}) {
    const input = createReadStream(localPath);
    // Opening the local stream can fail while remote readiness is still pending.
    let readError: unknown;
    input.on('error', error => {
      readError = error;
    });
    return this.upload(remotePath, input, options)
      .then(() => {
        if (readError) throw readError;
      })
      .finally(() => input.destroy());
  }

  /** Stream a local directory as a tar archive. Requires the host's tar executable. */
  async uploadDirectory(
    localPath: string,
    remotePath: string,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ) {
    options.signal?.throwIfAborted();
    // Spawn lazily when upload starts consuming. A child that exits while remote
    // provisioning is pending can have its unread stdout drained by Node.
    const source = Readable.from(
      (async function* () {
        const archive = spawn('tar', ['-C', localPath, '-cf', '-', '.'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        archive.stderr.on('data', chunk => {
          stderr = (stderr + String(chunk)).slice(-8192);
        });
        const finished = new Promise<void>((resolve, reject) => {
          archive.on('error', reject);
          archive.on('close', code => (code === 0 ? resolve() : reject(new Error(`tar failed (${code}): ${stderr}`))));
        });
        void finished.catch(() => {});
        const abort = () => {
          if (archive.exitCode === null) archive.kill('SIGKILL');
        };
        options.signal?.addEventListener('abort', abort, { once: true });
        try {
          options.signal?.throwIfAborted();
          for await (const chunk of archive.stdout) yield chunk;
          await finished;
        } finally {
          options.signal?.removeEventListener('abort', abort);
          abort();
          await finished.catch(() => {});
        }
      })(),
    );
    await this.upload(remotePath, source, { ...options, contentType: 'application/x-tar' });
  }

  /** Full SDK download response, including bytes, size and content type. SDK buffers in memory. */
  async download(path: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<SandboxDownload> {
    return this.operation(async () => {
      if (!posix.isAbsolute(path)) throw new RenderSandboxError('CONFIGURATION', 'Download paths must be absolute');
      quote(path);
      options.signal?.throwIfAborted();
      await this.start({ abortSignal: options.signal });
      const wait = deadline(options.timeoutMs ?? this.commandMs, [options.signal, this.lifetime.signal]);
      try {
        if (Number.isFinite(this.fileLimit)) {
          const stat = await this.run(
            `test -f ${quote(path)} && stat -Lc %s -- ${quote(path)}`,
            { abortSignal: wait.signal },
            this.commandMs,
            1024,
            'stat',
            [],
          );
          if (!stat.success) throw new RenderSandboxError('NOT_FOUND', 'Expected an existing regular file');
          const size = Number(stat.stdout.trim());
          if (!Number.isSafeInteger(size) || size < 0 || size > this.fileLimit)
            throw new RenderSandboxError('FILE_LIMIT', 'Download exceeds maxFileBytes');
        }
        const result = await bounded(this.api.download(this.sandboxId!, path, this.ownerId, wait.signal), wait.signal);
        if (result.data.length > this.fileLimit)
          throw new RenderSandboxError('FILE_LIMIT', 'Download exceeds maxFileBytes');
        return result;
      } finally {
        wait.dispose();
      }
    });
  }

  async downloadToFile(
    remotePath: string,
    localPath: string,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ) {
    const downloaded = await this.download(remotePath, options);
    const temporary = `${localPath}.render-${randomUUID()}`;
    try {
      await writeLocalFile(temporary, downloaded.data, { flag: 'wx', mode: 0o600, signal: options.signal });
      options.signal?.throwIfAborted();
      await rename(temporary, localPath);
    } finally {
      await rm(temporary, { force: true });
    }
    return { size: downloaded.size, contentType: downloaded.contentType };
  }

  private async terminateKnown(): Promise<void> {
    if (!this.owned || !this.sandboxId || this.terminated) return;
    if (this.terminatePromise) return this.terminatePromise;
    const id = this.sandboxId;
    this.terminatePromise = (async () => {
      const wait = deadline(this.controlMs);
      try {
        await bounded(this.api.terminate(id, this.ownerId), wait.signal);
        this.terminated = true;
        this.cleanupError = undefined;
      } finally {
        wait.dispose();
      }
    })();
    try {
      await this.terminatePromise;
    } finally {
      this.terminatePromise = undefined;
    }
  }

  /** Render has no SDK pause operation. Stop disposes owned sandboxes and detaches borrowed ones. */
  async stop(): Promise<void> {
    await this.destroy();
  }

  async destroy(): Promise<void> {
    if (this.status === 'destroyed') return;
    if (this.destroyPromise) return this.destroyPromise;
    this.closing = true;
    this.lifetime.abort(new RenderSandboxError('ABORTED', 'Sandbox disposal requested'));
    this.destroyPromise = (async () => {
      try {
        await this.startPromise?.catch(() => {});
        if (this.pendingCreation && !this.creationSettled) {
          const wait = deadline(this.controlMs);
          try {
            await bounded(this.pendingCreation, wait.signal);
          } finally {
            wait.dispose();
          }
        }
        if (this.creationUnknown)
          throw new RenderSandboxError(
            'CLEANUP',
            'Create acceptance is unknown; check the workspace resource list and configured lifetime',
          );
        const draining = deadline(this.controlMs * 3);
        let drainError: unknown;
        try {
          await bounded(Promise.allSettled(this.operations), draining.signal);
        } catch (error) {
          drainError = error;
        } finally {
          draining.dispose();
        }
        await this.terminateKnown();
        if (drainError && !this.owned) throw drainError;
        this.status = 'destroyed';
      } catch (cause) {
        this.status = 'error';
        this.cleanupError = cause;
        throw new RenderSandboxError(
          'CLEANUP',
          'Sandbox termination was not confirmed; retain sandboxId and retry destroy()',
          { sandboxId: this.sandboxId, remoteMayBeRunning: true },
          { cause },
        );
      }
    })();
    try {
      await this.destroyPromise;
    } finally {
      this.destroyPromise = undefined;
    }
  }

  readonly supportsCheckpoints = true;
  async snapshot(): Promise<void> {
    if (this.checkpointPromise) return this.checkpointPromise;
    this.checkpointPromise = this.captureSnapshot({ name: this.options.checkpointName ?? this.id }).then(() => {});
    try {
      await this.checkpointPromise;
    } finally {
      this.checkpointPromise = undefined;
    }
  }

  async captureSnapshot(
    input: Omit<SandboxSnapshotCreateInput, 'sandboxId' | 'ownerId'> = {},
    options: SnapshotWaitOptions = {},
  ) {
    return this.operation(async () => {
      await this.start({ abortSignal: options.abortSignal });
      const snapshot = await this.snapshots.capture(
        { ...input, sandboxId: this.sandboxId!, ownerId: this.ownerId },
        {
          timeoutMs: this.options.snapshotTimeoutMs ?? 120_000,
          ...options,
          abortSignal: AbortSignal.any([this.lifetime.signal, ...(options.abortSignal ? [options.abortSignal] : [])]),
        },
      );
      this.lastSnapshot = snapshot;
      return snapshot;
    });
  }

  /** Restore a captured snapshot into a new, independently owned provider. No I/O until start(). */
  restore(
    snapshot: SandboxSnapshot = this.lastSnapshot!,
    options: Omit<RenderSandboxOptions, 'sandboxId'> = {},
  ): RenderSandbox {
    if (!snapshot || snapshot.status !== 'available')
      throw new RenderSandboxError('STATE', 'An available snapshot is required');
    if (snapshot.kind === 'runtime' && options.create?.plan && options.create.plan !== snapshot.plan)
      throw new RenderSandboxError('CONFIGURATION', 'Runtime snapshot restoration requires its original plan');
    const {
      sandboxId: _id,
      id: _logical,
      create: original,
      checkpointName: _checkpoint,
      client: _client,
      clientOptions: _clientOptions,
      ...base
    } = this.options;
    const {
      snapshotId: _snapshotId,
      snapshotName: _name,
      ...create
    } = { ...original, ...options.create } as RenderSandboxCreateInput;
    return new RenderSandbox({
      ...base,
      ...(options.client || options.clientOptions
        ? {}
        : { client: this.client ?? new Render(this.options.clientOptions) }),
      ...options,
      create: {
        ...create,
        snapshotId: snapshot.id,
        ...(snapshot.kind === 'runtime' ? { plan: snapshot.plan } : {}),
      },
    });
  }

  clone(
    options: {
      id?: string;
      sandboxId?: string;
      env?: Record<string, string>;
      workingDirectory?: string;
      checkpointName?: string;
      seedCheckpointName?: string;
      idleTimeoutMinutes?: number;
      actingUserId?: string;
    } = {},
  ): RenderSandbox {
    if (options.idleTimeoutMinutes !== undefined || options.actingUserId !== undefined)
      throw new RenderSandboxError('UNSUPPORTED', 'Render SDK does not expose idle timeout or acting-user attribution');
    const { sandboxId: _id, id: _logical, clientOptions: _clientOptions, ...base } = this.options;
    const create = this.createInput;
    const cloned = new RenderSandbox({
      ...base,
      client: this.client ?? new Render(this.options.clientOptions),
      id: options.id,
      workingDirectory: options.workingDirectory ?? this.workingDirectory,
      checkpointName: options.checkpointName,
      ...(options.sandboxId
        ? { sandboxId: options.sandboxId, create: undefined }
        : {
            create: { ...create, env: { ...create.env, ...options.env } },
          }),
    });
    if (!options.sandboxId)
      cloned.checkpointNames = [options.checkpointName, options.seedCheckpointName].filter((v): v is string => !!v);
    return cloned;
  }

  private async control<T>(fn: () => Promise<T>, options: SnapshotWaitOptions = {}) {
    options.abortSignal?.throwIfAborted();
    const wait = deadline(options.timeoutMs ?? this.controlMs, [options.abortSignal]);
    try {
      return await bounded(fn(), wait.signal);
    } finally {
      wait.dispose();
    }
  }
  /** Current metadata from Render, distinct from locally cached getInfo(). */
  async refresh(options?: SnapshotWaitOptions): Promise<RemoteSandbox> {
    if (!this.sandboxId) throw new RenderSandboxError('STATE', 'Start the sandbox before refreshing it');
    this.remote = await this.control(() => this.api.get(this.sandboxId!, this.ownerId), options);
    if (this.remote.status === 'terminated') {
      this.terminated = true;
      this.closing = true;
      this.status = 'destroyed';
    }
    return this.remote;
  }
  listSandboxes(input: Parameters<SandboxClient['list']>[0] = {}, options?: SnapshotWaitOptions) {
    return this.control(() => this.api.list({ ...input, ownerId: input?.ownerId ?? this.ownerId }), options);
  }
  listGroups(input: Parameters<SandboxClient['listGroups']>[0] = {}, options?: SnapshotWaitOptions) {
    return this.control(() => this.api.listGroups({ ...input, ownerId: input?.ownerId ?? this.ownerId }), options);
  }
  /** Explicit destructive action, including for an attachment. destroy() still only detaches attachments. */
  async terminate(): Promise<void> {
    if (!this.sandboxId) throw new RenderSandboxError('STATE', 'No sandbox ID to terminate');
    await this.control(() => this.api.terminate(this.sandboxId!, this.ownerId));
    this.terminated = true;
    this.closing = true;
    this.lifetime.abort(new RenderSandboxError('ABORTED', 'Sandbox explicitly terminated'));
    this.status = 'destroyed';
  }

  getInfo(): SandboxInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: new Date(this.remote?.createdAt ?? Date.now()),
      metadata: {
        sandboxId: this.sandboxId,
        owned: this.owned,
        remote: this.remote,
        lastSnapshot: this.lastSnapshot,
        terminationAccepted: this.terminated,
        creationAcceptanceUnknown: this.creationUnknown,
      },
    };
  }

  getInstructions(): string {
    return (
      `Commands execute in a Render sandbox. Default cwd: ${this.workingDirectory}. ` +
      `Files persist; shell exports and cd do not. Use shell commands for file operations. ` +
      ((this.options.cancellationMode ?? 'command') === 'command'
        ? 'Cancellation and timeouts stop this command process group while preserving the sandbox. '
        : this.options.cancellationMode === 'terminate' && this.owned
          ? 'Cancellation and timeouts destroy this owned sandbox. '
          : 'Cancellation stops observation only; remote work may continue. ') +
      'Independent operations may run concurrently; coordinate writes to the same paths.'
    );
  }
}
