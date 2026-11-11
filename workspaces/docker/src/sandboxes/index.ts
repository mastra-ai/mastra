import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { NotFoundError, Sandboxes } from '@docker/sandboxes';
import type { Sandbox } from '@docker/sandboxes';
import { MastraSandbox, SandboxNotReadyError, validateSandboxFileMode } from '@mastra/core/workspace';
import type {
  ProviderStatus,
  CommandOptions,
  ExecutionResult,
  MastraSandboxOptions,
  SandboxFileInput,
  SandboxInfo,
  WriteFilesOptions,
} from '@mastra/core/workspace';
import { createAbortError, throwIfAborted } from '../abort';

export interface DockerSandboxesOptions extends MastraSandboxOptions {
  /** Stable logical id. Use sandboxId to reconnect directly to a known remote VM. */
  id?: string;
  sandboxId?: string;
  image: string;
  /** Docker Cloud Sandboxes client; defaults to the SDK's configured credentials. */
  client?: Sandboxes;
  /** Environment variables set on a newly created cloud sandbox. */
  environment?: Record<string, string>;
}

/** Docker Cloud Sandboxes (microVM), separate from the Docker container provider. */
export class DockerSandboxesSandbox extends MastraSandbox<Sandbox> {
  readonly id: string;
  readonly name = 'Docker Sandboxes';
  readonly provider = 'docker-sandboxes';
  status: ProviderStatus = 'pending';
  private readonly client: Sandboxes;
  private readonly ownsClient: boolean;
  private readonly image: string;
  private readonly environment?: Record<string, string>;
  private readonly pinnedSandboxId: boolean;
  private remoteId?: string;
  private sandbox?: Sandbox;
  private createdAt = new Date();

  constructor(options: DockerSandboxesOptions) {
    super({ ...options, name: 'Docker Sandboxes' });
    this.id = options.id ?? randomUUID();
    this.remoteId = options.sandboxId;
    this.pinnedSandboxId = options.sandboxId != null;
    this.image = options.image;
    this.environment = options.environment;
    this.ownsClient = !options.client;
    this.client = options.client ?? new Sandboxes();
  }

  get sandboxId(): string | undefined {
    return this.remoteId;
  }

  protected async find(): Promise<Sandbox | undefined> {
    if (this.remoteId) {
      try {
        return await this.client.get(this.remoteId);
      } catch (error) {
        if (!(error instanceof NotFoundError) || this.pinnedSandboxId) throw error;
        this.remoteId = undefined;
        this.sandbox = undefined;
      }
    }
    for await (const sandbox of this.client.all()) {
      if (sandbox.displayName === this.id && sandbox.status !== 'deleting' && sandbox.status !== 'deleted')
        return sandbox;
    }
    return undefined;
  }

  protected async connect(sandbox: Sandbox): Promise<void> {
    this.sandbox = sandbox;
    this.remoteId = sandbox.name;
    if (sandbox.status === 'stopped') this.sandbox = sandbox = await sandbox.start();
    this.sandbox = await sandbox.waitUntilRunning();
    if (this.sandbox.status !== 'running') throw new SandboxNotReadyError(`${this.id} (${this.sandbox.status})`);
    this.createdAt = this.sandbox.resource.core.createdAt ?? this.createdAt;
  }

  protected async create(): Promise<void> {
    const sandbox = await this.client.create(
      { image: this.image, displayName: this.id, environment: this.environment },
      { idempotencyKey: this.id },
    );
    await this.connect(sandbox);
  }

  async stop(): Promise<void> {
    if (this.sandbox) this.sandbox = await (await this.sandbox.stop()).waitUntilStopped();
  }

  async destroy(): Promise<void> {
    try {
      if (this.sandbox) await (await this.sandbox.refresh()).delete();
    } finally {
      this.sandbox = undefined;
      if (this.ownsClient) await this.client.close();
    }
  }

  async executeCommand(command: string, args: string[] = [], options: CommandOptions = {}): Promise<ExecutionResult> {
    throwIfAborted(options.abortSignal, 'command');
    const limit = options.maxRetainedBytes ?? 1024 * 1024;
    if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 0)) {
      throw new RangeError('maxRetainedBytes must be a nonnegative integer or Infinity');
    }
    await this.ensureRunning();
    const started = Date.now();
    const controller = new AbortController();
    let timedOut = false;
    const timeout =
      options.timeout == null
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, options.timeout);
    const onAbort = () => controller.abort();
    options.abortSignal?.addEventListener('abort', onAbort, { once: true });
    if (options.abortSignal?.aborted) controller.abort();

    const retained = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
    const head = { stdout: 0, stderr: 0 };
    const size = { stdout: 0, stderr: 0 };
    const dropped = { stdout: 0, stderr: 0 };
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    const discard = (stream: 'stdout' | 'stderr', count: number) => {
      while (count > 0) {
        const chunks = retained[stream];
        const first = chunks[head[stream]]!;
        const removed = Math.min(count, first.length);
        if (removed === first.length) head[stream]++;
        else chunks[head[stream]] = first.subarray(removed);
        size[stream] -= removed;
        dropped[stream] += removed;
        count -= removed;
      }
      if (head[stream] > 64 && head[stream] * 2 > retained[stream].length) {
        retained[stream].splice(0, head[stream]);
        head[stream] = 0;
      }
    };
    const append = (stream: 'stdout' | 'stderr', data: string) => {
      if (!data) return;
      (stream === 'stdout' ? options.onStdout : options.onStderr)?.(data);
      const chunk = Buffer.from(data);
      retained[stream].push(chunk);
      size[stream] += chunk.length;
      if (limit !== Infinity && size[stream] > limit) {
        discard(stream, size[stream] - limit);
        while (size[stream] && (retained[stream][head[stream]]![0]! & 0xc0) === 0x80) discard(stream, 1);
      }
    };
    let process: Awaited<ReturnType<Sandbox['processes']['start']>> | undefined;
    let exitCode = -1;
    try {
      process = await this.sandbox!.processes.start(
        {
          args: ['sh', '-lc', args.length ? `${command} ${args.map(shellQuote).join(' ')}` : command],
          workingDir: options.cwd ?? this.workingDirectory,
          env: Object.fromEntries(
            Object.entries({ ...this.getEnv(), ...options.env }).filter(
              (entry): entry is [string, string] => entry[1] != null,
            ),
          ),
        },
        { signal: controller.signal },
      );
      const running = process;
      const kill = () => {
        void running.signal('kill').catch(() => {});
      };
      controller.signal.addEventListener('abort', kill, { once: true });
      try {
        const connection = await process.connect(undefined, { signal: controller.signal, reconnect: true });
        try {
          for await (const event of connection) {
            if (event.type === 'chunk' && (event.stream === 'stdout' || event.stream === 'stderr')) {
              const stream = event.stream === 'stdout' ? 'stdout' : 'stderr';
              append(stream, decoders[stream].write(Buffer.from(event.data ?? [])));
            } else if (event.type === 'exited') {
              exitCode = event.exitCode ?? -1;
            }
          }
        } finally {
          await connection.close();
        }
      } finally {
        controller.signal.removeEventListener('abort', kill);
        if (controller.signal.aborted) kill();
      }
      if (exitCode === -1 && !controller.signal.aborted) exitCode = (await process.refresh()).exitCode ?? -1;
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      options.abortSignal?.removeEventListener('abort', onAbort);
    }
    append('stdout', decoders.stdout.end());
    append('stderr', decoders.stderr.end());
    return {
      success: exitCode === 0 && !controller.signal.aborted,
      exitCode,
      stdout: Buffer.concat(retained.stdout.slice(head.stdout)).toString('utf8'),
      stderr: Buffer.concat(retained.stderr.slice(head.stderr)).toString('utf8'),
      executionTimeMs: Date.now() - started,
      timedOut,
      killed: controller.signal.aborted,
      stdoutTruncated: dropped.stdout > 0,
      stderrTruncated: dropped.stderr > 0,
      stdoutDroppedBytes: dropped.stdout,
      stderrDroppedBytes: dropped.stderr,
    };
  }

  async readFile(path: string, encoding: 'utf8'): Promise<string>;
  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding?: 'utf8'): Promise<string | Uint8Array> {
    await this.ensureRunning();
    return encoding ? this.sandbox!.files.read(path, { encoding }) : this.sandbox!.files.read(path);
  }

  async writeFiles(files: SandboxFileInput[], options: WriteFilesOptions = {}): Promise<void> {
    throwIfAborted(options.abortSignal, 'writeFiles');
    for (const file of files) if (file.mode !== undefined) validateSandboxFileMode(file.mode);
    await this.ensureRunning();
    for (const file of files) {
      throwIfAborted(options.abortSignal, 'writeFiles');
      try {
        await this.sandbox!.files.mkdir(dirname(file.path), { parents: true }, { signal: options.abortSignal });
        await this.sandbox!.files.write(file.path, file.content, { mode: file.mode }, { signal: options.abortSignal });
      } catch (error) {
        if (options.abortSignal?.aborted) throw createAbortError(options.abortSignal, 'writeFiles');
        throw error;
      }
    }
  }

  getInstructions(): string {
    return 'Commands and files run inside an isolated Docker Cloud Sandbox microVM.';
  }

  getInfo(): SandboxInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this.createdAt,
      metadata: { sandboxId: this.remoteId, image: this.image },
    };
  }
}

function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
