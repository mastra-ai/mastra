/**
 * Vercel Sandbox (MicroVM) Provider
 *
 * Wraps the official `@vercel/sandbox` SDK, which provisions ephemeral
 * Firecracker MicroVMs (Amazon Linux 2023) with a persistent in-session
 * filesystem, command execution, background processes, and exposed ports.
 *
 * This is distinct from the `VercelServerlessSandbox` provider in this package, which
 * runs commands as Vercel serverless Functions and is stateless.
 *
 * @see https://vercel.com/docs/vercel-sandbox
 */

import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox } from '@vercel/sandbox';
import { VercelSandboxProcessManager } from './process-manager';

const LOG_PREFIX = '[VercelSandbox]';

/** Vercel Sandbox runtimes (default `node24`). */
export type VercelSandboxRuntime = 'node24' | 'node22' | 'node26' | 'python3.13';

// =============================================================================
// Options
// =============================================================================

/**
 * Vercel Sandbox (MicroVM) provider configuration.
 *
 * Authentication: the SDK uses the `VERCEL_OIDC_TOKEN` environment variable
 * automatically when available. To authenticate from an environment without
 * OIDC, supply `token`, `teamId`, and `projectId` together (falling back to
 * the `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` env vars).
 */
export interface VercelSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Unique identifier for this sandbox instance. */
  id?: string;
  /** Optional sandbox name passed to the Vercel API. Auto-generated if omitted. */
  sandboxName?: string;
  /** Vercel API token. Falls back to the `VERCEL_TOKEN` env var. */
  token?: string;
  /** Vercel team ID. Falls back to the `VERCEL_TEAM_ID` env var. */
  teamId?: string;
  /** Vercel project ID. Falls back to the `VERCEL_PROJECT_ID` env var. */
  projectId?: string;
  /** Sandbox runtime. @default 'node24' */
  runtime?: VercelSandboxRuntime;
  /**
   * Timeout in milliseconds before the sandbox auto-terminates.
   * @default 300_000 // 5 minutes
   */
  timeout?: number;
  /** Resources to allocate. `vcpus` controls CPU count (2048 MB memory per vCPU). */
  resources?: { vcpus?: number };
  /** Ports to expose from the sandbox (up to 4). Access via `getInfo().metadata.domains`. */
  ports?: number[];
  /** Default environment variables inherited by all commands. */
  env?: Record<string, string>;
  /** Custom metadata surfaced via `getInfo()`. */
  metadata?: Record<string, unknown>;
  /**
   * Custom instructions that override the default instructions
   * returned by `getInstructions()`.
   *
   * - `string` — Fully replaces the default instructions. Pass an empty
   *   string to suppress instructions entirely.
   * - `(opts) => string` — Receives the default instructions and optional
   *   request context so you can extend or customise per-request.
   */
  instructions?: InstructionsOption;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Vercel Sandbox (MicroVM) provider for Mastra workspaces.
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { VercelSandbox } from '@mastra/vercel';
 *
 * const workspace = new Workspace({
 *   sandbox: new VercelSandbox({ runtime: 'node24', timeout: 600_000 }),
 * });
 *
 * const result = await workspace.sandbox.executeCommand('node', ['--version']);
 * ```
 */
export class VercelSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'VercelSandbox';
  readonly provider = 'vercel-sandbox';
  status: ProviderStatus = 'pending';

  declare readonly processes: VercelSandboxProcessManager;

  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;

  private readonly _sandboxName?: string;
  private readonly _token?: string;
  private readonly _teamId?: string;
  private readonly _projectId?: string;
  private readonly _runtime: VercelSandboxRuntime;
  private readonly _timeout: number;
  private readonly _vcpus?: number;
  private readonly _ports?: number[];
  private readonly _env: Record<string, string>;
  private readonly _metadata: Record<string, unknown>;
  private readonly _instructionsOverride?: InstructionsOption;

  constructor(options: VercelSandboxOptions = {}) {
    super({
      ...options,
      name: 'VercelSandbox',
      processes: new VercelSandboxProcessManager({ env: options.env ?? {} }),
    });

    this.id = options.id ?? `vercel-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._sandboxName = options.sandboxName;
    this._token = options.token ?? process.env.VERCEL_TOKEN;
    this._teamId = options.teamId ?? process.env.VERCEL_TEAM_ID;
    this._projectId = options.projectId ?? process.env.VERCEL_PROJECT_ID;
    this._runtime = options.runtime ?? 'node24';
    this._timeout = options.timeout ?? 300_000;
    this._vcpus = options.resources?.vcpus;
    this._ports = options.ports;
    this._env = options.env ?? {};
    this._metadata = options.metadata ?? {};
    this._instructionsOverride = options.instructions;
  }

  /**
   * The underlying `@vercel/sandbox` instance.
   * Throws if the sandbox has not been started yet.
   */
  get sandbox(): Sandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this._sandbox) {
      return;
    }

    // Credentials are all-or-nothing: when any explicit credential is provided,
    // the SDK requires the full triple. Otherwise it falls back to the OIDC token.
    const hasExplicitCreds = Boolean(this._token || this._teamId || this._projectId);
    if (hasExplicitCreds && !(this._token && this._teamId && this._projectId)) {
      throw new Error(
        `${LOG_PREFIX} Incomplete credentials. Provide token, teamId, and projectId together ` +
          `(or the VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID env vars), ` +
          `or omit all three to use the VERCEL_OIDC_TOKEN.`,
      );
    }

    this.logger.debug(`${LOG_PREFIX} Creating sandbox...`, { runtime: this._runtime, timeout: this._timeout });

    this._sandbox = await Sandbox.create({
      ...(this._sandboxName ? { name: this._sandboxName } : {}),
      runtime: this._runtime,
      timeout: this._timeout,
      ...(this._vcpus ? { resources: { vcpus: this._vcpus } } : {}),
      ...(this._ports?.length ? { ports: this._ports } : {}),
      ...(Object.keys(this._env).length ? { env: this._env } : {}),
      ...(hasExplicitCreds ? { token: this._token!, teamId: this._teamId!, projectId: this._projectId! } : {}),
    });

    this._createdAt = new Date();
    this.logger.debug(`${LOG_PREFIX} Sandbox ready: ${this._sandbox.name}`);
  }

  async stop(): Promise<void> {
    await this._teardown();
  }

  async destroy(): Promise<void> {
    await this._teardown();
  }

  private async _teardown(): Promise<void> {
    if (!this._sandbox) {
      return;
    }
    try {
      await this._sandbox.stop();
    } catch (error) {
      this.logger.warn(`${LOG_PREFIX} Error stopping sandbox:`, error);
    }
    this._sandbox = null;
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();

    const startTime = Date.now();
    const fullCommand = args?.length ? `${command} ${args.join(' ')}` : command;
    this.logger.debug(`${LOG_PREFIX} Executing: ${fullCommand}`, { cwd: options?.cwd });

    const mergedEnv = { ...this._env, ...options?.env };
    const env = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    // Race the command against the optional timeout so we can return a partial
    // result with a 124 exit code (matching other providers) instead of hanging.
    // On timeout we abort the in-flight command so it stops running in the VM.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const abortController = new AbortController();
    const forwardAbort = () => abortController.abort();
    if (options?.abortSignal) {
      if (options.abortSignal.aborted) abortController.abort();
      else options.abortSignal.addEventListener('abort', forwardAbort, { once: true });
    }
    const signal = abortController.signal;
    const timeoutPromise = options?.timeout
      ? new Promise<'timeout'>(resolve => {
          timeoutId = setTimeout(() => resolve('timeout'), options.timeout);
        })
      : null;

    try {
      const commandPromise = this.sandbox.runCommand({
        cmd: command,
        args: args ?? [],
        ...(options?.cwd ? { cwd: options.cwd } : {}),
        ...(Object.keys(env).length ? { env } : {}),
        signal,
      });

      const finished = timeoutPromise ? await Promise.race([commandPromise, timeoutPromise]) : await commandPromise;

      if (finished === 'timeout') {
        abortController.abort();
        return {
          command: fullCommand,
          args,
          success: false,
          exitCode: 124,
          stdout: '',
          stderr: `Command timed out after ${options!.timeout}ms`,
          executionTimeMs: Date.now() - startTime,
          timedOut: true,
        };
      }

      const [stdout, stderr] = await Promise.all([finished.stdout(), finished.stderr()]);

      if (options?.onStdout && stdout) options.onStdout(stdout);
      if (options?.onStderr && stderr) options.onStderr(stderr);

      return {
        command: fullCommand,
        args,
        success: finished.exitCode === 0,
        exitCode: finished.exitCode,
        stdout,
        stderr,
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      options?.abortSignal?.removeEventListener('abort', forwardAbort);
    }
  }

  // ---------------------------------------------------------------------------
  // Info & Instructions
  // ---------------------------------------------------------------------------

  getInfo(): SandboxInfo {
    const domains: Record<number, string> = {};
    if (this._sandbox && this._ports?.length) {
      for (const port of this._ports) {
        try {
          domains[port] = this._sandbox.domain(port);
        } catch {
          // Port may not have an associated route yet — skip.
        }
      }
    }

    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        ...this._metadata,
        sandboxName: this._sandbox?.name,
        runtime: this._runtime,
        timeout: this._timeout,
        ...(this._vcpus ? { vcpus: this._vcpus } : {}),
        ...(this._ports?.length ? { ports: this._ports, domains } : {}),
      },
    };
  }

  // Matches the resolveInstructions pattern in @mastra/core/workspace.
  getInstructions(opts?: { requestContext?: RequestContext }): string {
    if (this._instructionsOverride === undefined) return this._getDefaultInstructions();
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    const defaultInstructions = this._getDefaultInstructions();
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  private _getDefaultInstructions(): string {
    return [
      'Vercel Sandbox: an ephemeral Firecracker MicroVM running Amazon Linux 2023.',
      `- Runtime: ${this._runtime}. Working directory defaults to /vercel/sandbox.`,
      '- Persistent filesystem within the session; state is lost when the sandbox stops.',
      '- Runs as the vercel-sandbox user with sudo access (install packages via dnf).',
      `- The sandbox auto-terminates after ${Math.round(this._timeout / 1000)} seconds.`,
      ...(this._ports?.length
        ? [`- Exposed ports: ${this._ports.join(', ')} (reachable via public HTTPS domains).`]
        : []),
      '- Background/long-running processes are supported via the process tools.',
      '- Filesystem mounting (FUSE) is not supported.',
    ].join('\n');
  }
}
