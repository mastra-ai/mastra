/**
 * Vercel Sandbox Provider
 *
 * Deploys code as Vercel serverless functions and executes commands
 * via HTTP invocation. Stateless — no persistent filesystem, no
 * interactive shell, no long-running processes.
 *
 * @see https://vercel.com/docs/rest-api
 */

import type { RequestContext } from '@mastra/core/di';
import type {
  SandboxInfo,
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  InstructionsOption,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { getExecutorSource } from '../executor';

const LOG_PREFIX = '[VercelSandbox]';

const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Shell-quote an argument for safe interpolation into a shell command string.
 * Mirrors the implementation in packages/core/src/workspace/sandbox/utils.ts
 * which is not publicly exported.
 */
function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

// =============================================================================
// Options
// =============================================================================

export interface VercelSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Vercel API token. Falls back to VERCEL_TOKEN env var. */
  token?: string;
  /** Vercel team ID for team-scoped deployments. */
  teamId?: string;
  /** Existing Vercel project name. Auto-generated if omitted. */
  projectName?: string;
  /** Deployment regions. @default ['iad1'] */
  regions?: string[];
  /** Function max duration in seconds. @default 60 */
  maxDuration?: number;
  /** Function memory in MB. @default 1024 */
  memory?: number;
  /** Environment variables baked into the deployed function. */
  env?: Record<string, string>;
  /** Per-invocation command timeout in ms. @default 55000 */
  commandTimeout?: number;
  /**
   * Custom instructions that override the default instructions
   * returned by `getInstructions()`.
   */
  instructions?: InstructionsOption;
}

// =============================================================================
// Implementation
// =============================================================================

export class VercelSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'VercelSandbox';
  readonly provider = 'vercel';
  status: ProviderStatus = 'pending';

  private readonly _token: string;
  private readonly _teamId?: string;
  private readonly _projectName?: string;
  private readonly _regions: string[];
  private readonly _maxDuration: number;
  private readonly _memory: number;
  private readonly _env: Record<string, string>;
  private readonly _commandTimeout: number;
  private readonly _instructionsOverride?: InstructionsOption;
  private readonly _secret: string;

  private _deploymentUrl: string | null = null;
  private _deploymentId: string | null = null;
  private _protectionBypass: string | null = null;
  private _createdAt: Date | null = null;

  constructor(options: VercelSandboxOptions = {}) {
    super({ name: 'VercelSandbox' });

    this.id = `vercel-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._token = options.token || process.env.VERCEL_TOKEN || '';
    this._teamId = options.teamId;
    this._projectName = options.projectName;
    this._regions = options.regions ?? ['iad1'];
    this._maxDuration = options.maxDuration ?? 60;
    this._memory = options.memory ?? 1024;
    this._env = options.env ?? {};
    this._commandTimeout = options.commandTimeout ?? 55_000;
    this._instructionsOverride = options.instructions;
    this._secret = crypto.randomUUID();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this._deploymentUrl) {
      return;
    }

    if (!this._token) {
      throw new Error(`${LOG_PREFIX} Missing Vercel API token. Set VERCEL_TOKEN env var or pass token option.`);
    }

    // Clean up any stale deployment from a previous stop() → start() cycle.
    // Without this, the old _deploymentId is overwritten and that deployment leaks.
    if (this._deploymentId) {
      this.logger.debug(`${LOG_PREFIX} Cleaning up stale deployment ${this._deploymentId} before restarting...`);
      try {
        const resp = await this._vercelFetch(`/v13/deployments/${this._deploymentId}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 404) {
          this.logger.warn(`${LOG_PREFIX} Failed to delete stale deployment: ${resp.status}`);
        }
      } catch (error) {
        this.logger.warn(`${LOG_PREFIX} Error deleting stale deployment:`, error);
      }
      this._deploymentId = null;
    }

    this.logger.debug(`${LOG_PREFIX} Deploying executor function...`);

    const vercelJson = JSON.stringify({
      functions: {
        'api/execute.js': {
          memory: this._memory,
          maxDuration: this._maxDuration,
        },
      },
      regions: this._regions,
    });

    // Create the deployment
    const deploymentBody: Record<string, unknown> = {
      name: this._projectName ?? `mastra-sandbox-${this.id}`,
      files: [
        {
          file: 'api/execute.js',
          data: getExecutorSource(this._secret, this._env),
        },
        {
          file: 'vercel.json',
          data: vercelJson,
        },
      ],
      projectSettings: {
        framework: null,
      },
      target: 'production',
    };

    const createResp = await this._vercelFetch('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify(deploymentBody),
    });

    if (!createResp.ok) {
      const errorBody = await createResp.text();
      throw new Error(`${LOG_PREFIX} Failed to create deployment: ${createResp.status} ${errorBody}`);
    }

    const deployment = (await createResp.json()) as { id: string; url: string; readyState: string; projectId?: string };
    this._deploymentId = deployment.id;

    this.logger.debug(`${LOG_PREFIX} Deployment created: ${deployment.id}, polling for READY...`);

    // Poll until ready
    const maxWaitMs = 120_000;
    const pollIntervalMs = 3_000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const statusResp = await this._vercelFetch(`/v13/deployments/${deployment.id}`);
      if (!statusResp.ok) {
        throw new Error(`${LOG_PREFIX} Failed to check deployment status: ${statusResp.status}`);
      }

      const statusBody = (await statusResp.json()) as { readyState: string; url: string };

      if (statusBody.readyState === 'READY') {
        this._deploymentUrl = `https://${statusBody.url}`;
        this._createdAt = new Date();
        this.logger.debug(`${LOG_PREFIX} Deployment ready: ${this._deploymentUrl}`);

        // Acquire a deployment protection bypass token.
        // Pro/Enterprise teams have Deployment Protection enabled by default,
        // which intercepts HTTP requests with an SSO login page before they
        // reach the serverless function. The bypass token lets us skip that.
        if (deployment.projectId) {
          try {
            this._protectionBypass = await this._acquireProtectionBypass(deployment.projectId);
          } catch {
            // Non-fatal — if the project has no deployment protection, this is unnecessary.
          }
        }

        // Warm-up ping
        try {
          await fetch(`${this._deploymentUrl}/api/execute`, {
            method: 'POST',
            headers: this._executorHeaders(),
            body: JSON.stringify({ command: 'echo', args: ['warm'] }),
          });
        } catch {
          // Warm-up failure is non-fatal
        }

        return;
      }

      if (statusBody.readyState === 'ERROR' || statusBody.readyState === 'CANCELED') {
        throw new Error(`${LOG_PREFIX} Deployment failed with state: ${statusBody.readyState}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`${LOG_PREFIX} Deployment timed out after ${maxWaitMs}ms`);
  }

  async stop(): Promise<void> {
    // Only clear the URL (disconnects from the deployment) but keep
    // _deploymentId so a subsequent destroy() can still clean up the
    // cloud resource. Clearing both would make destroy() a no-op and
    // leak the deployment.
    this._deploymentUrl = null;
  }

  async destroy(): Promise<void> {
    if (this._deploymentId) {
      try {
        const resp = await this._vercelFetch(`/v13/deployments/${this._deploymentId}`, {
          method: 'DELETE',
        });
        if (!resp.ok) {
          // 404 means the deployment is already gone — that's fine.
          // Other status codes indicate infrastructure issues (auth, network)
          // and should be surfaced more visibly.
          if (resp.status === 404) {
            this.logger.debug(`${LOG_PREFIX} Deployment already deleted (404)`);
          } else {
            this.logger.warn(`${LOG_PREFIX} Failed to delete deployment: ${resp.status}`);
          }
        }
      } catch (error) {
        // Network-level failure — warn rather than debug so it's visible
        this.logger.warn(`${LOG_PREFIX} Error deleting deployment:`, error);
      }
      this._deploymentId = null;
    }
    this._deploymentUrl = null;
    this._protectionBypass = null;
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();

    if (!this._deploymentUrl) {
      throw new SandboxNotReadyError(this.id);
    }

    const fullCommand = args?.length ? `${command} ${args.map(a => shellQuote(a)).join(' ')}` : command;
    this.logger.debug(`${LOG_PREFIX} Executing: ${fullCommand}`);

    const body = {
      command,
      args: args ?? [],
      env: options?.env ?? {},
      cwd: options?.cwd ?? '/tmp',
      timeout: options?.timeout ?? this._commandTimeout,
    };

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch(`${this._deploymentUrl}/api/execute`, {
          method: 'POST',
          headers: this._executorHeaders(),
          body: JSON.stringify(body),
          signal: options?.abortSignal,
        });

        // Retry on transient errors
        if ((resp.status === 429 || resp.status === 502 || resp.status === 503) && attempt < maxRetries) {
          this.logger.debug(`${LOG_PREFIX} Retryable status ${resp.status}, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        // Gateway timeout → timedOut
        if (resp.status === 504) {
          return {
            command: fullCommand,
            args,
            success: false,
            exitCode: 124,
            stdout: '',
            stderr: 'Function execution timed out (504 Gateway Timeout)',
            executionTimeMs: options?.timeout ?? this._commandTimeout,
            timedOut: true,
          };
        }

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`${LOG_PREFIX} Execute failed: ${resp.status} ${errorText}`);
        }

        const result = (await resp.json()) as {
          success: boolean;
          exitCode: number;
          stdout: string;
          stderr: string;
          executionTimeMs: number;
          timedOut: boolean;
        };

        // Stream callbacks
        if (options?.onStdout && result.stdout) {
          options.onStdout(result.stdout);
        }
        if (options?.onStderr && result.stderr) {
          options.onStderr(result.stderr);
        }

        return {
          command: fullCommand,
          args,
          success: result.success,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          executionTimeMs: result.executionTimeMs,
          timedOut: result.timedOut,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.logger.debug(`${LOG_PREFIX} Request error, attempt ${attempt + 1}/${maxRetries}:`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError ?? new Error(`${LOG_PREFIX} executeCommand failed after retries`);
  }

  // ---------------------------------------------------------------------------
  // Info & Instructions
  // ---------------------------------------------------------------------------

  // Matches the resolveInstructions pattern in packages/core/src/workspace/utils.ts
  getInstructions(opts?: { requestContext?: RequestContext }): string {
    if (this._instructionsOverride === undefined) return this._getDefaultInstructions();
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    const defaultInstructions = this._getDefaultInstructions();
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  private _getDefaultInstructions(): string {
    return [
      'Vercel serverless sandbox.',
      'Limitations:',
      '- Stateless: no persistent filesystem between invocations.',
      '- No interactive shell or streaming stdin.',
      '- No long-running or background processes.',
      `- Maximum execution time: ${this._maxDuration} seconds.`,
      '- Only /tmp is writable (ephemeral, cleared between invocations).',
      '- Shell commands (pipes, builtins) are supported via /bin/sh -c.',
    ].join('\n');
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        deploymentId: this._deploymentId,
        deploymentUrl: this._deploymentUrl,
        regions: this._regions,
        maxDuration: this._maxDuration,
        memory: this._memory,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch an existing protection bypass token for the project, or create one
   * if none exists. Returns the token string, or null if acquisition fails.
   */
  private async _acquireProtectionBypass(projectId: string): Promise<string | null> {
    // 1. Check if the project already has a bypass token.
    const projResp = await this._vercelFetch(`/v9/projects/${projectId}`);
    if (projResp.ok) {
      const project = (await projResp.json()) as {
        protectionBypass?: Record<string, unknown>;
      };
      const existing = project.protectionBypass ? Object.keys(project.protectionBypass)[0] : undefined;
      if (existing) {
        this.logger.debug(`${LOG_PREFIX} Using existing protection bypass token`);
        return existing;
      }
    }

    // 2. No token exists — create one via the dedicated endpoint.
    this.logger.debug(`${LOG_PREFIX} Creating protection bypass token...`);
    const createResp = await this._vercelFetch(`/v1/projects/${projectId}/protection-bypass`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    if (createResp.ok) {
      const result = (await createResp.json()) as {
        protectionBypass?: Record<string, unknown>;
      };
      const created = result.protectionBypass ? Object.keys(result.protectionBypass)[0] : undefined;
      if (created) {
        this.logger.debug(`${LOG_PREFIX} Protection bypass token created`);
        return created;
      }
    }

    this.logger.debug(`${LOG_PREFIX} Could not acquire protection bypass token (project may not require it)`);
    return null;
  }

  private _executorHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this._secret}`,
    };
    if (this._protectionBypass) {
      headers['x-vercel-protection-bypass'] = this._protectionBypass;
    }
    return headers;
  }

  private async _vercelFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = new URL(path, VERCEL_API_BASE);
    if (this._teamId) {
      url.searchParams.set('teamId', this._teamId);
    }

    return fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this._token}`,
        ...((options.headers as Record<string, string>) ?? {}),
      },
    });
  }
}
