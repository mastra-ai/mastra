import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProcessInfo,
  ProviderStatus,
  SandboxCloneOptions,
  SandboxInfo,
  SpawnProcessOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, ProcessHandle, SandboxNotReadyError, SandboxProcessManager } from '@mastra/core/workspace';
import type { PlatformClientOptions } from './client.js';
import { PlatformClient } from './client.js';

export type PlatformSandboxNetworkIsolation = 'ISOLATED' | 'PRIVATE';

export interface PlatformSandboxOptions extends Omit<MastraSandboxOptions, 'processes'>, PlatformClientOptions {
  id?: string;
  environmentId?: string;
  sandboxId?: string;
  idleTimeoutMinutes?: number;
  networkIsolation?: PlatformSandboxNetworkIsolation;
  env?: Record<string, string>;
  timeout?: number;
  instructions?: InstructionsOption;
}

interface CreateSandboxResponse {
  id: string;
  providerResourceId?: string | null;
  status?: string;
  createdAt?: string;
  destroyedAt?: string | null;
}

interface ExecResponse {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated?: boolean;
  timedOut?: boolean;
}

/**
 * Compose a shell command line from a `command` string and optional `args`.
 *
 * IMPORTANT: `command` is treated as a **shell string** and passed to the
 * remote shell verbatim so callers can use pipes, redirects, and chaining
 * (`ls -la | grep foo`). This matches the contract of {@link MastraSandbox}
 * and the local sandbox implementation. `args` are always shell-quoted so
 * they cannot inject syntax.
 *
 * Callers MUST NOT pass untrusted input as `command`. Untrusted values must
 * be passed via `args`, where they are safely quoted. Passing untrusted
 * input as `command` allows arbitrary shell syntax execution on the remote
 * sandbox.
 */
function buildCommand(command: string, args?: string[]): string {
  return args?.length ? `${command} ${args.map(shellQuote).join(' ')}` : command;
}

function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

class PlatformProcessHandle extends ProcessHandle {
  readonly pid: string;
  private readonly resultPromise: Promise<CommandResult>;
  private exitCodeValue: number | undefined;

  constructor(pid: string, resultPromise: Promise<CommandResult>, options?: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
    this.resultPromise = resultPromise.then(result => {
      this.exitCodeValue = result.exitCode;
      if (result.stdout) this.emitStdout(result.stdout);
      if (result.stderr) this.emitStderr(result.stderr);
      return result;
    });
  }

  get exitCode(): number | undefined {
    return this.exitCodeValue;
  }

  async wait(): Promise<CommandResult> {
    return this.resultPromise;
  }

  async kill(): Promise<boolean> {
    // The workspace proxy has no cancel-exec endpoint; each `executeCommand`
    // is a synchronous round-trip that has already completed (or timed out)
    // by the time a handle exists to kill. Making this explicit avoids
    // callers silently believing they cancelled a still-running process.
    throw new Error('Platform sandbox command execution does not support killing individual processes');
  }

  async sendStdin(): Promise<void> {
    throw new Error('Platform sandbox command execution does not support stdin');
  }
}

class PlatformProcessManager extends SandboxProcessManager<PlatformSandbox> {
  private spawnCounter = 0;

  /**
   * Spawn a process on the remote sandbox.
   *
   * `command` is interpreted as a shell string by the remote shell, matching
   * the {@link MastraSandbox} contract. See {@link PlatformSandbox.executeCommand}
   * for the untrusted-input caveat: never pass untrusted values as `command`.
   */
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const pid = `platform-proc-${Date.now().toString(36)}-${(this.spawnCounter++).toString(36)}`;
    const resultPromise = this.sandbox.executeCommand(command, undefined, options);
    const handle = new PlatformProcessHandle(pid, resultPromise, options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map(handle => ({
      pid: handle.pid,
      command: handle.command,
      running: handle.exitCode === undefined,
      ...(handle.exitCode !== undefined && { exitCode: handle.exitCode }),
    }));
  }
}

export class PlatformSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'PlatformSandbox';
  readonly provider = 'platform';
  status: ProviderStatus = 'pending';
  declare readonly processes: PlatformProcessManager;

  private readonly _client: PlatformClient;
  private readonly _environmentId: string;
  private _sandboxId?: string;
  private readonly _idleTimeoutMinutes?: number;
  private readonly _networkIsolation?: PlatformSandboxNetworkIsolation;
  private readonly _env: Record<string, string>;
  private readonly _timeout?: number;
  private readonly _instructionsOverride?: InstructionsOption;
  private _createdAt: Date | null = null;

  constructor(options: PlatformSandboxOptions = {}) {
    super({ ...options, name: 'PlatformSandbox', processes: new PlatformProcessManager() });
    this.id = options.id ?? this.generateId();
    this._client = new PlatformClient(options);
    this._environmentId = options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID ?? '';
    if (!this._environmentId && !options.sandboxId) throw new Error('environmentId is required');
    this._sandboxId = options.sandboxId;
    this._idleTimeoutMinutes = options.idleTimeoutMinutes;
    this._networkIsolation = options.networkIsolation;
    this._env = options.env ?? {};
    this._timeout = options.timeout;
    this._instructionsOverride = options.instructions;
  }

  private generateId(): string {
    return `platform-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Construct a sibling {@link PlatformSandbox} that inherits this sandbox's
   * credentials and defaults (access token, project, environment, network
   * isolation, timeout, instructions, env, idle timeout) with per-instance
   * overrides from `options`.
   *
   * Performs no I/O and does not require this sandbox to be started — the
   * returned sandbox is not started and provisions (or reattaches, when
   * `sandboxId` is set) on its own `start()`. Use it when one configured
   * sandbox acts as the template for a fleet of independent sandboxes
   * (e.g. one per project).
   */
  clone(options: SandboxCloneOptions = {}): PlatformSandbox {
    return new PlatformSandbox({
      ...(options.id !== undefined && { id: options.id }),
      accessToken: this._client.accessToken,
      projectId: this._client.projectId,
      fetch: this._client.fetch,
      environmentId: this._environmentId,
      ...(options.sandboxId !== undefined && { sandboxId: options.sandboxId }),
      idleTimeoutMinutes: options.idleTimeoutMinutes ?? this._idleTimeoutMinutes,
      ...(this._networkIsolation !== undefined && { networkIsolation: this._networkIsolation }),
      env: options.env ?? this._env,
      ...(this._timeout !== undefined && { timeout: this._timeout }),
      ...(this._instructionsOverride !== undefined && { instructions: this._instructionsOverride }),
    });
  }

  async start(): Promise<void> {
    if (this._sandboxId) {
      this._createdAt = new Date();
      return;
    }

    const response = await this._client.request('/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // Sent so the platform can associate the provisioned resource with a
        // caller-stable identifier (used for opt-in checkpoint recovery). The
        // platform treats it as an advisory key: unknown values fall through
        // to a fresh sandbox, matching pre-existing behavior.
        id: this.id,
        environmentId: this._environmentId,
        idleTimeoutMinutes: this._idleTimeoutMinutes,
        networkIsolation: this._networkIsolation,
        env: this._env,
      }),
    });
    const json = (await response.json()) as CreateSandboxResponse;
    this._sandboxId = json.id;
    this._createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
  }

  async stop(): Promise<void> {
    await this.destroy();
  }

  async destroy(): Promise<void> {
    if (!this._sandboxId) return;
    await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}`, { method: 'DELETE' });
    // Clear local state so a subsequent start() creates a fresh remote sandbox
    // instead of taking the reattach branch and pointing exec at a deleted resource.
    this._sandboxId = undefined;
    this._createdAt = null;
  }

  /**
   * Execute a command on the remote sandbox.
   *
   * `command` is a **shell string**: it is concatenated verbatim into the
   * command line sent to the remote shell, which lets callers use pipes,
   * redirects, and chaining (`ls -la | grep foo`). This matches the contract
   * of {@link MastraSandbox} and the local sandbox implementation.
   *
   * `args`, when provided, are always shell-quoted so they cannot inject
   * additional shell syntax.
   *
   * Security: callers MUST NOT pass untrusted input as `command`. If any part
   * of the invocation is derived from an untrusted source, pass it through
   * `args` (which is safely quoted) or shell-quote it yourself before
   * inclusion. Untrusted `command` values allow arbitrary shell syntax
   * execution on the remote sandbox.
   */
  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();
    if (!this._sandboxId) throw new SandboxNotReadyError(this.id);

    const started = Date.now();
    const fullCommand = buildCommand(command, args);
    // Nullish check so an explicit `timeout: 0` is sent as `0` (interpreted as
    // "no timeout" by the proxy) instead of being dropped by a truthy check.
    const effectiveTimeout = options?.timeout ?? this._timeout;
    const timeoutSec = effectiveTimeout != null ? Math.ceil(effectiveTimeout / 1000) : undefined;
    // Pass our own signal for exec so the client's default per-request
    // timeout (60s) doesn't cut off commands that expect to run longer.
    // Give the proxy a generous buffer over the requested command timeout.
    const clientSignal =
      effectiveTimeout != null && effectiveTimeout > 0 ? AbortSignal.timeout(effectiveTimeout + 30_000) : undefined;
    const response = await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command: fullCommand,
        environmentId: this._environmentId,
        idleTimeoutMinutes: this._idleTimeoutMinutes,
        networkIsolation: this._networkIsolation,
        timeoutSec,
        cwd: options?.cwd,
        env: options?.env,
      }),
      signal: clientSignal,
    });
    const json = (await response.json()) as ExecResponse;
    const exitCode = json.exitCode ?? (json.timedOut ? 124 : 1);
    return {
      success: exitCode === 0,
      exitCode,
      stdout: json.stdout,
      stderr: json.stderr,
      executionTimeMs: Date.now() - started,
      timedOut: json.timedOut,
      command: fullCommand,
    };
  }

  async getInfo(): Promise<SandboxInfo> {
    if (!this._sandboxId) {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this.status,
        createdAt: this._createdAt ?? new Date(),
      };
    }
    const response = await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}`);
    const json = (await response.json()) as CreateSandboxResponse;
    return {
      id: json.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: json.createdAt ? new Date(json.createdAt) : (this._createdAt ?? new Date()),
      metadata: {
        providerResourceId: json.providerResourceId ?? undefined,
        platformStatus: json.status,
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = `Platform sandbox${this._sandboxId ? ` ${this._sandboxId}` : ''}. Execute commands with the sandbox command APIs.`;
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
    }
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return defaultInstructions;
  }
}
