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
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type { ProviderStatus } from './lifecycle';
import type { IsolationBackend, NativeSandboxConfig } from './native-sandbox';
import { detectIsolation, isIsolationAvailable, generateSeatbeltProfile, wrapCommand } from './native-sandbox';
import type { WorkspaceSandbox, SandboxInfo, ExecuteCommandOptions, CommandResult } from './sandbox';
import { SandboxNotReadyError, IsolationUnavailableError } from './sandbox';

const execFile = promisify(childProcess.execFile);

/**
 * Execute a command with optional streaming callbacks.
 * Uses spawn when callbacks are provided for real-time output.
 */
function execWithStreaming(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Set up timeout
    const timeoutId = options.timeout
      ? setTimeout(() => {
          killed = true;
          proc.kill('SIGTERM');
        }, options.timeout)
      : undefined;

    proc.stdout.on('data', (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      options.onStdout?.(str);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      options.onStderr?.(str);
    });

    proc.on('error', err => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });

    proc.on('close', code => {
      if (timeoutId) clearTimeout(timeoutId);
      if (killed) {
        resolve({ stdout, stderr: stderr + '\nProcess timed out', exitCode: 124 });
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      }
    });
  });
}

/**
 * Local sandbox provider configuration.
 */
export interface LocalSandboxOptions {
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
export class LocalSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'LocalSandbox';
  readonly provider = 'local';

  private _status: ProviderStatus = 'stopped';
  private readonly _workingDirectory: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly timeout: number;
  private readonly _isolation: IsolationBackend;
  private readonly _nativeSandboxConfig: NativeSandboxConfig;
  private _seatbeltProfile?: string;
  private _seatbeltProfilePath?: string;

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
    this.id = options.id ?? this.generateId();
    this._workingDirectory = options.workingDirectory ?? process.cwd();
    this.env = options.env ?? {};
    this.timeout = options.timeout ?? 30000;
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

  get status(): ProviderStatus {
    return this._status;
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      await fs.mkdir(this.workingDirectory, { recursive: true });

      // Set up seatbelt profile for macOS sandboxing
      if (this._isolation === 'seatbelt') {
        this._seatbeltProfile =
          this._nativeSandboxConfig.seatbeltProfile ??
          generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);

        // Write profile to file for debugging/inspection purposes
        this._seatbeltProfilePath = path.join(this.workingDirectory, '.sandbox.sb');
        await fs.writeFile(this._seatbeltProfilePath, this._seatbeltProfile, 'utf-8');
      }

      this._status = 'running';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    this._status = 'stopped';
  }

  async destroy(): Promise<void> {
    // Clean up seatbelt profile if it exists
    if (this._seatbeltProfilePath) {
      try {
        await fs.unlink(this._seatbeltProfilePath);
      } catch {
        // Ignore errors if file doesn't exist
      }
      this._seatbeltProfilePath = undefined;
      this._seatbeltProfile = undefined;
    }

    await this.stop();
  }

  async isReady(): Promise<boolean> {
    return this._status === 'running';
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this._status,
      createdAt: new Date(),
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
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this.id);
    }

    const startTime = Date.now();
    const timeout = options.timeout ?? this.timeout;
    const cwd = options.cwd ? path.resolve(this.workingDirectory, options.cwd) : this.workingDirectory;

    // Wrap command with isolation backend if configured
    const wrapped = this.wrapCommandForIsolation(command, args);

    // Use streaming execution when callbacks are provided
    if (options.onStdout || options.onStderr) {
      try {
        const result = await execWithStreaming(wrapped.command, wrapped.args, {
          cwd,
          timeout,
          env: this.buildEnv(options.env),
          onStdout: options.onStdout,
          onStderr: options.onStderr,
        });

        return {
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error: unknown) {
        return {
          success: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
        };
      }
    }

    // Use execFile for non-streaming (simpler, better error handling)
    try {
      const { stdout, stderr } = await execFile(wrapped.command, wrapped.args, {
        cwd,
        timeout,
        env: this.buildEnv(options.env),
      });

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(error),
        exitCode: e.code ?? 1,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}
