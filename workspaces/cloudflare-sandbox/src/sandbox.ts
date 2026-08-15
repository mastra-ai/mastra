import { randomUUID } from 'node:crypto';
import type {
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxFileInput,
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox } from '@mastra/core/workspace';
import {
  CloudflareSandboxBridgeClient,
  type CloudflareSandboxBridgeClientOptions,
  type CloudflareSandboxRecord,
} from './bridge-client';

const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;

type InstructionsOption = string | ((options: { defaultInstructions: string }) => string);
type BridgeClient = Pick<
  CloudflareSandboxBridgeClient,
  'createSandbox' | 'getSandbox' | 'deleteSandbox' | 'writeFiles' | 'executeCommand'
>;

export interface CloudflareSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** URL of a deployed Cloudflare Sandbox Bridge Worker. */
  baseUrl: string;
  /** Bearer token accepted by the Bridge Worker, when authentication is enabled. */
  apiToken?: string;
  /** Stable Mastra identifier for this sandbox instance. */
  id?: string;
  /** Existing Cloudflare sandbox ID to reconnect to instead of creating a sandbox. */
  sandboxId?: string;
  /** Human-readable name shown in Mastra sandbox metadata. */
  name?: string;
  /** Environment variables applied to every command. */
  env?: Record<string, string>;
  /** Working directory applied to every command. Must be under /workspace. */
  workingDirectory?: string;
  /** Default command timeout in milliseconds. */
  commandTimeout?: number;
  /** Custom instructions returned by getInstructions(). */
  instructions?: InstructionsOption;
  /** Custom fetch implementation, primarily for advanced networking setup and tests. */
  fetch?: CloudflareSandboxBridgeClientOptions['fetch'];
  /** Preconfigured Bridge client, primarily for tests. */
  client?: BridgeClient;
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9._\-/=:@]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildCommand(command: string, args: string[] | undefined, env: Record<string, string>, cwd?: string): string {
  const commandWithArgs = args?.length ? `${command} ${args.map(shellQuote).join(' ')}` : command;
  const assignments = Object.entries(env).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key}`);
    return `${key}=${shellQuote(value)}`;
  });
  const executable = assignments.length ? `${assignments.join(' ')} ${commandWithArgs}` : commandWithArgs;
  return cwd ? `cd ${shellQuote(cwd)} && ${executable}` : executable;
}

function normalizeWorkspacePath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/workspace/${path}`;
  if (normalized !== '/workspace' && !normalized.startsWith('/workspace/')) {
    throw new Error(`Cloudflare Sandbox files must be written under /workspace: ${path}`);
  }
  return normalized.slice(1);
}

function timeoutSeconds(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Command timeout must be positive');
  return Math.ceil(timeoutMs / 1000);
}

export class CloudflareSandbox extends MastraSandbox {
  readonly id: string;
  readonly name: string;
  readonly provider = 'cloudflare-sandbox';
  status: ProviderStatus = 'pending';

  private readonly client: BridgeClient;
  private readonly env: Record<string, string>;
  private readonly workingDirectory?: string;
  private readonly commandTimeout: number;
  private readonly instructions?: InstructionsOption;
  private sandboxId?: string;
  private createdAt = new Date();
  private lastUsedAt?: Date;

  constructor(options: CloudflareSandboxOptions) {
    const name = options.name ?? 'Cloudflare Sandbox';
    super({ ...options, name });
    this.id = options.id ?? `cloudflare-sandbox-${randomUUID()}`;
    this.name = name;
    this.sandboxId = options.sandboxId;
    this.env = { ...options.env };
    this.workingDirectory = options.workingDirectory;
    this.commandTimeout = options.commandTimeout ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this.instructions = options.instructions;
    this.client =
      options.client ??
      new CloudflareSandboxBridgeClient({ baseUrl: options.baseUrl, apiToken: options.apiToken, fetch: options.fetch });
  }

  async start(): Promise<void> {
    let sandbox: CloudflareSandboxRecord;
    if (this.sandboxId) {
      sandbox = await this.client.getSandbox(this.sandboxId);
    } else {
      sandbox = await this.client.createSandbox();
      this.sandboxId = sandbox.id;
    }
    if (sandbox.createdAt) this.createdAt = new Date(sandbox.createdAt);
  }

  async stop(): Promise<void> {
    // The Bridge API exposes create/get/delete but no suspend operation. Stop
    // detaches this Mastra lifecycle while preserving the remote sandbox.
  }

  async destroy(): Promise<void> {
    if (!this.sandboxId) return;
    await this.client.deleteSandbox(this.sandboxId);
    this.sandboxId = undefined;
  }

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    if (!this.sandboxId) throw new Error(`Cloudflare Sandbox ${this.id} has not been started`);

    const startedAt = Date.now();
    const timeout = options?.timeout ?? this.commandTimeout;
    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeout);
    const signal = options?.abortSignal ? AbortSignal.any([controller.signal, options.abortSignal]) : controller.signal;
    let stdout = '';
    let stderr = '';
    let exitCode = 1;

    try {
      await this.client.executeCommand(
        this.sandboxId,
        {
          command: buildCommand(
            command,
            args,
            Object.fromEntries(
              Object.entries({ ...this.env, ...options?.env }).filter(
                (entry): entry is [string, string] => entry[1] !== undefined,
              ),
            ),
            options?.cwd ?? this.workingDirectory,
          ),
          timeout: timeoutSeconds(timeout),
        },
        {
          signal,
          onEvent: event => {
            if (event.type === 'stdout') {
              const data = event.data ?? '';
              stdout += data;
              options?.onStdout?.(data);
            } else if (event.type === 'stderr') {
              const data = event.data ?? '';
              stderr += data;
              options?.onStderr?.(data);
            } else if (event.type === 'complete') {
              exitCode = event.exitCode ?? 0;
            } else if (event.type === 'error') {
              stderr += event.message ?? event.data ?? 'Cloudflare Sandbox command failed';
            }
          },
        },
      );
    } catch (error) {
      if (!signal.aborted) throw error;
    } finally {
      clearTimeout(timer);
    }

    this.lastUsedAt = new Date();
    return {
      command,
      args,
      success: exitCode === 0 && !signal.aborted,
      exitCode,
      stdout,
      stderr,
      executionTimeMs: Date.now() - startedAt,
      timedOut: didTimeout,
      killed: signal.aborted && !didTimeout,
    };
  }

  async writeFiles(files: SandboxFileInput[]): Promise<void> {
    if (!this.sandboxId) throw new Error(`Cloudflare Sandbox ${this.id} has not been started`);
    await this.client.writeFiles(
      this.sandboxId,
      files.map(file => ({
        path: normalizeWorkspacePath(file.path),
        content: Buffer.isBuffer(file.content) ? file.content.toString('base64') : file.content,
        ...(Buffer.isBuffer(file.content) ? { encoding: 'base64' as const } : {}),
      })),
    );
    this.lastUsedAt = new Date();
  }

  getInfo(): SandboxInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      metadata: {
        sandboxId: this.sandboxId,
        bridgeBaseUrl: this.client instanceof CloudflareSandboxBridgeClient ? this.client.baseUrl : undefined,
      },
    };
  }

  getInstructions(): string {
    const defaultInstructions =
      'Commands execute in a remote Cloudflare Sandbox. Read and write persistent project files under /workspace.';
    return typeof this.instructions === 'function'
      ? this.instructions({ defaultInstructions })
      : (this.instructions ?? defaultInstructions);
  }
}
