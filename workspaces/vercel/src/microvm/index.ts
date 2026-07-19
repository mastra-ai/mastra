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
  SandboxFileInput,
  SandboxCloneOptions,
  SandboxInfo,
  SandboxNetworking,
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

  /**
   * Networking capability: public HTTPS URLs for exposed ports.
   * A port must be declared in `ports` at construction time for a URL to exist.
   */
  readonly networking: SandboxNetworking = {
    getPortUrl: async (port: number): Promise<string | null> => {
      const sandbox = this._sandbox ?? (await this.attach());
      if (!sandbox) return null;
      try {
        return sandbox.domain(port);
      } catch {
        // Port has no associated route (not declared in `ports`).
        return null;
      }
    },
  };

  private _sandbox: Sandbox | null = null;
  /** True when `_sandbox` came from a resume-less lookup — `start()` must still resume it. */
  private _attachedWithoutResume = false;
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
  private readonly _constructorOptions: VercelSandboxOptions;

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
    this._constructorOptions = { ...options };
  }

  /**
   * Construct a sibling `VercelSandbox` that inherits this sandbox's
   * configuration (credentials, runtime, resources, ports, metadata,
   * instructions) with per-instance overrides.
   *
   * Performs no I/O — the sandbox clone provisions a fresh MicroVM on its
   * own `start()` (Vercel sandboxes cannot be reconnected to, so
   * `options.sandboxId` is ignored). Use it when one configured sandbox acts
   * as the template for a fleet of independent sandboxes (e.g. one per
   * project).
   *
   * `options.idleTimeoutMinutes` maps to the Vercel sandbox `timeout` (ms).
   */
  clone(options: SandboxCloneOptions = {}): VercelSandbox {
    const { id: _id, sandboxName: _sandboxName, ...base } = this._constructorOptions;
    return new VercelSandbox({
      ...base,
      ...(options.id !== undefined && { id: options.id }),
      ...(options.env !== undefined && { env: options.env }),
      ...(options.idleTimeoutMinutes !== undefined && { timeout: options.idleTimeoutMinutes * 60_000 }),
    });
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

  /**
   * Attach to an existing named sandbox WITHOUT resuming it (`resume: false`),
   * so lookups (URL resolution, stop, destroy) never wake a stopped sandbox
   * and start billing. Returns null when unnamed or when no sandbox with this
   * name exists.
   */
  private async attach(): Promise<Sandbox | null> {
    if (this._sandbox) return this._sandbox;
    if (!this._sandboxName) return null;

    try {
      this._sandbox = await Sandbox.get({
        name: this._sandboxName,
        resume: false,
        ...this.credentialParams(),
      });
      this._attachedWithoutResume = true;
      return this._sandbox;
    } catch {
      return null;
    }
  }

  /**
   * The token is the credential: when provided, the SDK requires teamId and
   * projectId alongside it. Without a token the SDK authenticates via the
   * `VERCEL_OIDC_TOKEN`; a stray teamId/projectId (for example, an exported
   * `VERCEL_TEAM_ID` in the shell) must not break OIDC auth, so it is ignored.
   */
  private credentialParams(): { token: string; teamId: string; projectId: string } | Record<string, never> {
    if (!this._token) return {};
    if (!(this._teamId && this._projectId)) {
      throw new Error(
        `${LOG_PREFIX} Incomplete credentials. Provide token, teamId, and projectId together ` +
          `(or the VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID env vars), ` +
          `or omit the token to use the VERCEL_OIDC_TOKEN.`,
      );
    }
    return { token: this._token, teamId: this._teamId, projectId: this._projectId };
  }

  async start(): Promise<void> {
    // A sandbox attached via a resume-less lookup still needs an actual
    // resume, so only a started/resumed sandbox short-circuits here.
    if (this._sandbox && !this._attachedWithoutResume) {
      return;
    }

    this.logger.debug(`${LOG_PREFIX} Creating sandbox...`, { runtime: this._runtime, timeout: this._timeout });

    const params = {
      runtime: this._runtime,
      timeout: this._timeout,
      ...(this._vcpus ? { resources: { vcpus: this._vcpus } } : {}),
      ...(this._ports?.length ? { ports: this._ports } : {}),
      ...(Object.keys(this._env).length ? { env: this._env } : {}),
      ...this.credentialParams(),
    };

    // Named sandboxes are an identity: get-or-create resumes the existing
    // sandbox (snapshot restore) if one with this name exists, otherwise
    // creates a fresh one with the name. Unnamed sandboxes always create.
    this._sandbox = this._sandboxName
      ? await Sandbox.getOrCreate({ ...params, name: this._sandboxName })
      : await Sandbox.create(params);
    this._attachedWithoutResume = false;

    this._createdAt = new Date();
    this.logger.debug(`${LOG_PREFIX} Sandbox ready: ${this._sandbox.name}`);
  }

  /** Snapshot-stop: the filesystem persists and a named sandbox resumes on the next `start()`. */
  async stop(): Promise<void> {
    const sandbox = this._sandbox ?? (await this.attach());
    if (!sandbox) {
      return;
    }
    // Stop failures propagate — a sandbox that failed to stop is still
    // running (and billing), so callers must not assume it snapshotted.
    await sandbox.stop();
    this._sandbox = null;
    this._attachedWithoutResume = false;
  }

  /** Permanently delete the sandbox and its snapshots. */
  async destroy(): Promise<void> {
    // Attach by name when needed so destroy works from a fresh process
    // (e.g. a `getDeployment()` handle) without resuming the sandbox first.
    const sandbox = this._sandbox ?? (await this.attach());
    if (!sandbox) {
      return;
    }
    // Delete failures propagate — a sandbox that failed to delete still
    // exists, so callers must not assume cleanup completed.
    await sandbox.delete();
    this._sandbox = null;
    this._attachedWithoutResume = false;
  }

  // ---------------------------------------------------------------------------
  // File Upload
  // ---------------------------------------------------------------------------

  /**
   * Bulk-write files into the sandbox filesystem via the SDK's native upload.
   * Relative paths resolve against /vercel/sandbox.
   */
  async writeFiles(files: SandboxFileInput[]): Promise<void> {
    await this.ensureRunning();
    await this.sandbox.writeFiles(files.map(f => ({ path: f.path, content: f.content })));
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
      this._sandboxName
        ? '- Persistent filesystem: stopping snapshots the filesystem and the named sandbox resumes it on the next start. Processes do not survive a stop.'
        : '- Persistent filesystem within the session; state is lost when the sandbox stops.',
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
