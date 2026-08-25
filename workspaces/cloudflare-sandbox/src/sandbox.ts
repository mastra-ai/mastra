import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import type {
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxFileInput,
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox } from '@mastra/core/workspace';
import { CloudflareSandboxBridgeClient, type CloudflareSandboxBridgeClientOptions } from './bridge-client';

const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const WORKSPACE_ROOT = '/workspace';

type InstructionsOption = string | ((options: { defaultInstructions: string }) => string);
type BridgeClient = Pick<
  CloudflareSandboxBridgeClient,
  'createSandbox' | 'isRunning' | 'deleteSandbox' | 'writeFile' | 'exec'
>;

export interface CloudflareSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** URL of a deployed Cloudflare Sandbox Bridge Worker. */
  baseUrl: string;
  /** Bearer token matching the Worker's `SANDBOX_API_KEY` secret, when authentication is enabled. */
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

/**
 * Builds the argv array sent to the bridge. The bridge applies ANSI-C quoting to
 * every element, so no local escaping is needed. Environment variables are applied
 * with `env`, which keeps each assignment a separate argv element.
 */
function buildArgv(command: string, args: string[] | undefined, env: Record<string, string>): string[] {
  const assignments = Object.entries(env).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key}`);
    return `${key}=${value}`;
  });
  const invocation = [command, ...(args ?? [])];
  return assignments.length ? ['env', ...assignments, ...invocation] : invocation;
}

/** Resolves a path inside /workspace, rejecting anything that escapes the workspace root. */
function resolveWorkspacePath(path: string): string {
  const resolved = posix.resolve(WORKSPACE_ROOT, path);
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(`${WORKSPACE_ROOT}/`)) {
    throw new Error(`Cloudflare Sandbox files must be written under ${WORKSPACE_ROOT}: ${path}`);
  }
  return resolved;
}

export class CloudflareSandbox extends MastraSandbox {
  readonly id: string;
  readonly name: string;
  readonly provider = 'cloudflare-sandbox';
  status: ProviderStatus = 'pending';

  private readonly client: BridgeClient;
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
    this.workingDirectory = options.workingDirectory;
    this.commandTimeout = options.commandTimeout ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this.instructions = options.instructions;
    this.client =
      options.client ??
      new CloudflareSandboxBridgeClient({ baseUrl: options.baseUrl, apiToken: options.apiToken, fetch: options.fetch });
  }

  async start(): Promise<void> {
    if (this.sandboxId) {
      // The bridge boots the container on demand, so a stopped container is not fatal.
      const running = await this.client.isRunning(this.sandboxId);
      if (!running) {
        this.logger?.debug(`Cloudflare sandbox ${this.sandboxId} is not running yet; it starts on first use`);
      }
      return;
    }
    this.sandboxId = await this.client.createSandbox();
    this.createdAt = new Date();
  }

  async stop(): Promise<void> {
    // The bridge exposes create/delete but no suspend operation. Stop detaches this
    // Mastra lifecycle while preserving the remote sandbox for later reconnection.
  }

  async destroy(): Promise<void> {
    if (!this.sandboxId) return;
    await this.client.deleteSandbox(this.sandboxId);
    this.sandboxId = undefined;
  }

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    const sandboxId = this.requireSandboxId();

    const startedAt = Date.now();
    const timeout = options?.timeout ?? this.commandTimeout;
    if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError('Command timeout must be positive');

    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeout);
    const signal = options?.abortSignal ? AbortSignal.any([controller.signal, options.abortSignal]) : controller.signal;

    // stdout and stderr are separate byte streams, so each needs its own streaming decoder.
    const stdoutDecoder = new TextDecoder();
    const stderrDecoder = new TextDecoder();
    let stdout = '';
    let stderr = '';
    let exitCode = 1;

    const env = Object.fromEntries(
      Object.entries({ ...this.getEnv(), ...options?.env }).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );

    try {
      await this.client.exec(
        sandboxId,
        {
          argv: buildArgv(command, args, env),
          timeoutMs: timeout,
          cwd: options?.cwd ?? this.workingDirectory,
        },
        {
          signal,
          onEvent: event => {
            switch (event.type) {
              case 'stdout': {
                const chunk = stdoutDecoder.decode(event.data, { stream: true });
                if (!chunk) return;
                stdout += chunk;
                options?.onStdout?.(chunk);
                return;
              }
              case 'stderr': {
                const chunk = stderrDecoder.decode(event.data, { stream: true });
                if (!chunk) return;
                stderr += chunk;
                options?.onStderr?.(chunk);
                return;
              }
              case 'exit':
                exitCode = event.exitCode;
                return;
              case 'error':
                stderr += event.message;
                options?.onStderr?.(event.message);
                return;
            }
          },
        },
      );
    } catch (error) {
      if (!signal.aborted) throw error;
    } finally {
      clearTimeout(timer);
    }

    // Flush each decoder so a trailing truncated multi-byte sequence isn't dropped.
    const stdoutTail = stdoutDecoder.decode();
    if (stdoutTail) {
      stdout += stdoutTail;
      options?.onStdout?.(stdoutTail);
    }
    const stderrTail = stderrDecoder.decode();
    if (stderrTail) {
      stderr += stderrTail;
      options?.onStderr?.(stderrTail);
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
    const sandboxId = this.requireSandboxId();
    // The bridge writes one file per request.
    for (const file of files) {
      await this.client.writeFile(sandboxId, resolveWorkspacePath(file.path), file.content);
    }
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

  private requireSandboxId(): string {
    if (!this.sandboxId) throw new Error(`Cloudflare Sandbox ${this.id} has not been started`);
    return this.sandboxId;
  }
}
