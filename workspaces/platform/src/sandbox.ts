import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProcessInfo,
  ProviderStatus,
  SandboxInfo,
  SpawnProcessOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, ProcessHandle, SandboxNotReadyError, SandboxProcessManager } from '@mastra/core/workspace';
import type { PlatformClientOptions } from './client.js';
import { PlatformClient } from './client.js';

export type PlatformSandboxNetworkIsolation = 'ISOLATED' | 'PRIVATE';

/**
 * Curated menu of sandbox flavors. Only `default` is guaranteed today —
 * `node` and `python` are accepted names that currently fall through to
 * `default` on the server side until snapshot builds ship, so agent code
 * can commit to a name now and pick up the fast path automatically later.
 */
export type PlatformSandboxTemplate = 'default' | 'node' | 'python';

export interface PlatformSandboxOptions extends Omit<MastraSandboxOptions, 'processes'>, PlatformClientOptions {
  id?: string;
  environmentId?: string;
  sandboxId?: string;
  idleTimeoutMinutes?: number;
  networkIsolation?: PlatformSandboxNetworkIsolation;
  env?: Record<string, string>;
  template?: PlatformSandboxTemplate;
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
  sessionName?: string;
}

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
    return false;
  }

  async sendStdin(): Promise<void> {
    throw new Error('Platform sandbox command execution does not support stdin');
  }
}

class PlatformProcessManager extends SandboxProcessManager<PlatformSandbox> {
  private spawnCounter = 0;

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

  private readonly client: PlatformClient;
  private readonly environmentId: string;
  private readonly sandboxId?: string;
  private readonly idleTimeoutMinutes?: number;
  private readonly networkIsolation?: PlatformSandboxNetworkIsolation;
  private readonly env: Record<string, string>;
  private readonly template?: PlatformSandboxTemplate;
  private readonly timeout?: number;
  private readonly instructionsOverride?: InstructionsOption;
  private platformSandboxId?: string;
  private createdAt: Date | null = null;

  constructor(options: PlatformSandboxOptions = {}) {
    super({ ...options, name: 'PlatformSandbox', processes: new PlatformProcessManager() });
    this.id = options.id ?? `platform-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.client = new PlatformClient(options);
    this.environmentId = options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID ?? '';
    if (!this.environmentId && !options.sandboxId) throw new Error('environmentId is required');
    this.sandboxId = options.sandboxId;
    this.platformSandboxId = options.sandboxId;
    this.idleTimeoutMinutes = options.idleTimeoutMinutes;
    this.networkIsolation = options.networkIsolation;
    this.env = options.env ?? {};
    this.template = options.template;
    this.timeout = options.timeout;
    this.instructionsOverride = options.instructions;
  }

  async start(): Promise<void> {
    if (this.platformSandboxId) {
      this.createdAt = new Date();
      return;
    }

    const response = await this.client.request('/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        environmentId: this.environmentId,
        idleTimeoutMinutes: this.idleTimeoutMinutes,
        networkIsolation: this.networkIsolation,
        env: this.env,
        template: this.template,
      }),
    });
    const json = (await response.json()) as CreateSandboxResponse;
    this.platformSandboxId = json.id;
    this.createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
  }

  async stop(): Promise<void> {
    await this.destroy();
  }

  async destroy(): Promise<void> {
    if (!this.platformSandboxId) return;
    await this.client.request(`/sandbox/${encodeURIComponent(this.platformSandboxId)}`, { method: 'DELETE' });
  }

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();
    if (!this.platformSandboxId) throw new SandboxNotReadyError(this.id);

    const started = Date.now();
    const fullCommand = buildCommand(command, args);
    const response = await this.client.request(`/sandbox/${encodeURIComponent(this.platformSandboxId)}/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command: fullCommand,
        timeoutSec:
          (options?.timeout ?? this.timeout) ? Math.ceil((options?.timeout ?? this.timeout!) / 1000) : undefined,
        cwd: options?.cwd,
        env: options?.env,
      }),
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
    if (!this.platformSandboxId) {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this.status,
        createdAt: this.createdAt ?? new Date(),
      };
    }
    const response = await this.client.request(`/sandbox/${encodeURIComponent(this.platformSandboxId)}`);
    const json = (await response.json()) as CreateSandboxResponse;
    return {
      id: json.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: json.createdAt ? new Date(json.createdAt) : (this.createdAt ?? new Date()),
      metadata: {
        providerResourceId: json.providerResourceId ?? undefined,
        platformStatus: json.status,
      },
    };
  }

  getInstructions(): string {
    const defaultInstructions = `Platform sandbox${this.platformSandboxId ? ` ${this.platformSandboxId}` : ''}. Execute commands with the sandbox command APIs.`;
    if (typeof this.instructionsOverride === 'function') {
      return this.instructionsOverride({ defaultInstructions });
    }
    if (typeof this.instructionsOverride === 'string') return this.instructionsOverride;
    return defaultInstructions;
  }
}
