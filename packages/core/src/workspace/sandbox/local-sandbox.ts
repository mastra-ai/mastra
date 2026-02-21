/**
 * Local Sandbox Provider
 *
 * A sandbox implementation that executes commands on the local machine.
 * This is the default sandbox for development and local agents.
 *
 * Supports optional native OS sandboxing:
 * - macOS: Uses seatbelt (sandbox-exec) for filesystem and network isolation
 * - Linux: Uses bubblewrap (bwrap) for namespace isolation
 */

import * as childProcess from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ProviderStatus } from '../lifecycle';
import { IsolationUnavailableError } from './errors';
import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';
import type { IsolationBackend, NativeSandboxConfig } from './native-sandbox';
import { detectIsolation, isIsolationAvailable, generateSeatbeltProfile, wrapCommand } from './native-sandbox';
import type { SandboxInfo, ExecuteCommandOptions, CommandResult } from './types';

interface ExecStreamingOptions extends Omit<SpawnOptions, 'timeout' | 'stdio'> {
  /** Timeout in ms - handled manually for custom exit code 124 */
  timeout?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  /** Abort signal to cancel the command */
  abortSignal?: AbortSignal;
}

/**
 * Execute a command with optional streaming callbacks.
 * Uses spawn when callbacks are provided for real-time output.
 */
function execWithStreaming(
  command: string,
  args: string[],
  options: ExecStreamingOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { timeout, onStdout, onStderr, abortSignal, cwd, env, ...spawnOptions } = options;

  // If already aborted before spawning, reject immediately
  if (abortSignal?.aborted) {
    return Promise.resolve({ stdout: '', stderr: '\nProcess aborted', exitCode: 130 });
  }

  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(command, args, { cwd, env, ...spawnOptions });

    let stdout = '';
    let stderr = '';
    let killed = false;
    let aborted = false;

    // Set up timeout
    const timeoutId = timeout
      ? setTimeout(() => {
          killed = true;
          proc.kill('SIGTERM');
        }, timeout)
      : undefined;

    // Set up abort signal listener
    const onAbort = () => {
      aborted = true;
      proc.kill('SIGTERM');
    };
    abortSignal?.addEventListener('abort', onAbort, { once: true });

    proc.stdout.on('data', (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      onStdout?.(str);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      onStderr?.(str);
    });

    proc.on('error', err => {
      if (timeoutId) clearTimeout(timeoutId);
      abortSignal?.removeEventListener('abort', onAbort);
      const errorMsg = err.message;
      stderr += errorMsg;
      onStderr?.(errorMsg);
      reject(err);
    });

    proc.on('close', (code, signal) => {
      if (timeoutId) clearTimeout(timeoutId);
      abortSignal?.removeEventListener('abort', onAbort);
      if (aborted) {
        const abortMsg = `\nProcess aborted`;
        onStderr?.(abortMsg);
        resolve({ stdout, stderr: stderr + abortMsg, exitCode: 130 });
      } else if (killed) {
        const timeoutMsg = `\nProcess timed out after ${timeout}ms`;
        onStderr?.(timeoutMsg);
        resolve({ stdout, stderr: stderr + timeoutMsg, exitCode: 124 });
      } else if (signal) {
        // When terminated by signal, code is null but signal contains the signal name
        const signalMsg = `\nProcess terminated by ${signal}`;
        onStderr?.(signalMsg);
        resolve({ stdout, stderr: stderr + signalMsg, exitCode: 128 });
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      }
    });
  });
}

/**
 * Local sandbox provider configuration.
 */
export interface LocalSandboxOptions extends MastraSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** Working directory for command execution */
  workingDirectory?: string;
  /**
   * Environment variables to set for command execution.
   * PATH is included by default unless overridden (needed for finding executables).
   * Other host environment variables are not inherited unless explicitly passed.
   *
   * @example
   * ```typescript
   * // Default - only PATH is available
   * env: undefined
   *
   * // Add specific variables
   * env: { NODE_ENV: 'production', HOME: process.env.HOME }
   *
   * // Full host environment (less secure)
   * env: process.env
   * ```
   */
  env?: NodeJS.ProcessEnv;
  /** Default timeout for operations in ms (default: 30000) */
  timeout?: number;
  /**
   * Isolation backend for sandboxed execution.
   * - 'none': No sandboxing (direct execution on host) - default
   * - 'seatbelt': macOS sandbox-exec (built-in on macOS)
   * - 'bwrap': Linux bubblewrap (requires installation)
   *
   * Use `LocalSandbox.detectIsolation()` to get the recommended backend.
   * @default 'none'
   */
  isolation?: IsolationBackend;
  /**
   * Configuration for native sandboxing.
   * Only used when isolation is 'seatbelt' or 'bwrap'.
   */
  nativeSandbox?: NativeSandboxConfig;
}

/**
 * Local sandbox implementation.
 *
 * Executes commands directly on the host machine.
 * This is the recommended sandbox for development and trusted local execution.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new LocalSandbox({ workingDirectory: './my-workspace' }),
 * });
 *
 * await workspace.init();
 * const result = await workspace.executeCommand('node', ['script.js']);
 * ```
 */
export class LocalSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'LocalSandbox';
  readonly provider = 'local';

  status: ProviderStatus = 'pending';

  private readonly _workingDirectory: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly timeout?: number;
  private readonly _isolation: IsolationBackend;
  private readonly _nativeSandboxConfig: NativeSandboxConfig;
  private _seatbeltProfile?: string;
  private _seatbeltProfilePath?: string;
  private _sandboxFolderPath?: string;
  private _userProvidedProfilePath = false;
  private readonly _createdAt: Date;

  /**
   * The working directory where commands are executed.
   */
  get workingDirectory(): string {
    return this._workingDirectory;
  }

  /**
   * The isolation backend being used.
   */
  get isolation(): IsolationBackend {
    return this._isolation;
  }

  /**
   * Detect the best available isolation backend for this platform.
   * Returns detection result with backend recommendation and availability.
   *
   * @example
   * ```typescript
   * const result = LocalSandbox.detectIsolation();
   * const sandbox = new LocalSandbox({
   *   isolation: result.available ? result.backend : 'none',
   * });
   * ```
   */
  static detectIsolation() {
    return detectIsolation();
  }

  constructor(options: LocalSandboxOptions = {}) {
    super({ ...options, name: 'LocalSandbox' });
    this.id = options.id ?? this.generateId();
    this._createdAt = new Date();
    // Default working directory is .sandbox/ in cwd - isolated from seatbelt profiles
    this._workingDirectory = options.workingDirectory ?? path.join(process.cwd(), '.sandbox');
    this.env = options.env ?? {};
    this.timeout = options.timeout;
    this._nativeSandboxConfig = options.nativeSandbox ?? {};

    // Validate and set isolation backend
    const requestedIsolation = options.isolation ?? 'none';
    if (requestedIsolation !== 'none' && !isIsolationAvailable(requestedIsolation)) {
      const detection = detectIsolation();
      throw new IsolationUnavailableError(requestedIsolation, detection.message);
    }
    this._isolation = requestedIsolation;
  }

  private generateId(): string {
    return `local-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Build the environment object for execution.
   * Always includes PATH by default (needed for finding executables).
   * Merges the sandbox's configured env with any additional env from the command.
   */
  private buildEnv(additionalEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH, // Always include PATH for finding executables
      ...this.env,
      ...additionalEnv,
    };
  }

  /**
   * Start the local sandbox.
   * Creates working directory and sets up seatbelt profile if using macOS isolation.
   * Status management is handled by the base class.
   */
  async start(): Promise<void> {
    this.logger.debug('[LocalSandbox] Starting sandbox', {
      workingDirectory: this._workingDirectory,
      isolation: this._isolation,
    });

    await fs.mkdir(this.workingDirectory, { recursive: true });

    // Set up seatbelt profile for macOS sandboxing
    if (this._isolation === 'seatbelt') {
      const userProvidedPath = this._nativeSandboxConfig.seatbeltProfilePath;

      if (userProvidedPath) {
        // User provided a custom path
        this._seatbeltProfilePath = userProvidedPath;
        this._userProvidedProfilePath = true;

        // Check if file exists at user's path
        try {
          this._seatbeltProfile = await fs.readFile(userProvidedPath, 'utf-8');
        } catch (err: unknown) {
          if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
          // File doesn't exist, generate default and write to user's path
          this._seatbeltProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);
          // Ensure parent directory exists
          await fs.mkdir(path.dirname(userProvidedPath), { recursive: true });
          await fs.writeFile(userProvidedPath, this._seatbeltProfile, 'utf-8');
        }
      } else {
        // No custom path, use default location
        this._seatbeltProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);

        // Generate a deterministic hash from workspace path and config
        // This allows identical sandboxes to share profiles while preventing collisions
        const configHash = crypto
          .createHash('sha256')
          .update(this.workingDirectory)
          .update(JSON.stringify(this._nativeSandboxConfig))
          .digest('hex')
          .slice(0, 8);

        // Write profile to .sandbox-profiles/ in cwd (outside working directory)
        // This prevents sandboxed processes from reading/modifying their own security profile
        this._sandboxFolderPath = path.join(process.cwd(), '.sandbox-profiles');
        await fs.mkdir(this._sandboxFolderPath, { recursive: true });
        this._seatbeltProfilePath = path.join(this._sandboxFolderPath, `seatbelt-${configHash}.sb`);
        await fs.writeFile(this._seatbeltProfilePath, this._seatbeltProfile, 'utf-8');
      }
    }

    this.logger.debug('[LocalSandbox] Sandbox started', { workingDirectory: this._workingDirectory });
  }

  /**
   * Stop the local sandbox.
   * Status management is handled by the base class.
   */
  async stop(): Promise<void> {
    this.logger.debug('[LocalSandbox] Stopping sandbox', { workingDirectory: this._workingDirectory });
  }

  /**
   * Destroy the local sandbox and clean up resources.
   * Cleans up seatbelt profile if auto-generated.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    this.logger.debug('[LocalSandbox] Destroying sandbox', { workingDirectory: this._workingDirectory });
    // Clean up seatbelt profile only if it was auto-generated (not user-provided)
    if (this._seatbeltProfilePath && !this._userProvidedProfilePath) {
      try {
        await fs.unlink(this._seatbeltProfilePath);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
    this._seatbeltProfilePath = undefined;
    this._seatbeltProfile = undefined;
    this._userProvidedProfilePath = false;

    // Try to remove .sandbox folder if empty
    if (this._sandboxFolderPath) {
      try {
        await fs.rmdir(this._sandboxFolderPath);
      } catch {
        // Ignore errors - folder may not be empty or may not exist
      }
      this._sandboxFolderPath = undefined;
    }
  }

  async isReady(): Promise<boolean> {
    return this.status === 'running';
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt,
      resources: {
        memoryMB: Math.round(os.totalmem() / 1024 / 1024),
        cpuCores: os.cpus().length,
      },
      metadata: {
        workingDirectory: this.workingDirectory,
        platform: os.platform(),
        nodeVersion: process.version,
        isolation: this._isolation,
        isolationConfig:
          this._isolation !== 'none'
            ? {
                allowNetwork: this._nativeSandboxConfig.allowNetwork ?? false,
                readOnlyPaths: this._nativeSandboxConfig.readOnlyPaths,
                readWritePaths: this._nativeSandboxConfig.readWritePaths,
              }
            : undefined,
      },
    };
  }

  getInstructions(): string {
    if (this.workingDirectory) {
      return `Local command execution. Working directory: "${this.workingDirectory}".`;
    }
    return 'Local command execution on the host machine.';
  }

  /**
   * Wrap a command with the configured isolation backend.
   */
  private wrapCommandForIsolation(command: string, args: string[]): { command: string; args: string[] } {
    if (this._isolation === 'none') {
      return { command, args };
    }

    return wrapCommand(command, args, {
      backend: this._isolation,
      workspacePath: this.workingDirectory,
      seatbeltProfile: this._seatbeltProfile,
      config: this._nativeSandboxConfig,
    });
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    this.logger.debug('[LocalSandbox] Executing command', { command, args, cwd: options.cwd ?? this.workingDirectory });

    // Auto-start if not running (lazy initialization)
    await this.ensureRunning();

    const startTime = Date.now();

    // Wrap command with isolation backend if configured
    const wrapped = this.wrapCommandForIsolation(command, args);

    // Use streaming execution when callbacks are provided

    try {
      const result = await execWithStreaming(wrapped.command, wrapped.args, {
        cwd: options.cwd ?? this.workingDirectory,
        timeout: options.timeout ?? this.timeout ?? 30000,
        env: this.buildEnv(options.env),
        onStdout: options.onStdout,
        onStderr: options.onStderr,
        abortSignal: options.abortSignal,
      });

      const commandResult: CommandResult = {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: Date.now() - startTime,
      };

      this.logger.debug('[LocalSandbox] Command completed', {
        command,
        exitCode: commandResult.exitCode,
        executionTimeMs: commandResult.executionTimeMs,
      });

      return commandResult;
    } catch (error: unknown) {
      const executionTimeMs = Date.now() - startTime;
      this.logger.error('[LocalSandbox] Command failed', { command, error, executionTimeMs });
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        executionTimeMs,
      };
    }
  }
}
