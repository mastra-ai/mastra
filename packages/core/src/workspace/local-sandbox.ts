/**
 * Local Sandbox Provider
 *
 * A sandbox implementation that executes commands on the local machine.
 * This is the default sandbox for development and local agents.
 */

import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { WorkspaceFilesystem } from './filesystem';
import type {
  WorkspaceSandbox,
  SandboxStatus,
  SandboxInfo,
  ExecuteCommandOptions,
  CommandResult,
  InstallPackageOptions,
  InstallPackageResult,
  SandboxSyncResult,
  SandboxSafetyOptions,
} from './sandbox';
import { SandboxNotReadyError } from './sandbox';

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
  /** Environment variables to set */
  env?: Record<string, string>;
  /**
   * Whether to inherit the host's environment variables.
   * When true, process.env is included in the execution environment.
   * When false (default), only explicitly set env variables are available.
   * This is more secure as it prevents leaking sensitive environment variables.
   * @default false
   */
  inheritEnv?: boolean;
  /** Default timeout for operations in ms (default: 30000) */
  timeout?: number;
  /**
   * Safety options for this sandbox.
   * Controls approval requirements for command execution.
   */
  safety?: SandboxSafetyOptions;
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
  readonly safety?: SandboxSafetyOptions;

  private _status: SandboxStatus = 'stopped';
  private readonly _workingDirectory: string;
  private readonly env: Record<string, string>;
  private readonly _inheritEnv: boolean;
  private readonly timeout: number;

  /**
   * The working directory where commands are executed.
   */
  get workingDirectory(): string {
    return this._workingDirectory;
  }

  /**
   * Whether the sandbox inherits the host's environment variables.
   */
  get inheritEnv(): boolean {
    return this._inheritEnv;
  }

  constructor(options: LocalSandboxOptions = {}) {
    this.id = options.id ?? this.generateId();
    this._workingDirectory = options.workingDirectory ?? process.cwd();
    this.env = options.env ?? {};
    this._inheritEnv = options.inheritEnv ?? false;
    this.timeout = options.timeout ?? 30000;
    this.safety = options.safety;
  }

  private generateId(): string {
    return `local-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Build the environment object for execution.
   * Conditionally includes process.env based on inheritEnv setting.
   */
  private buildEnv(additionalEnv?: Record<string, string>): Record<string, string> {
    if (this._inheritEnv) {
      return { ...process.env, ...this.env, ...additionalEnv } as Record<string, string>;
    }
    return { ...this.env, ...additionalEnv };
  }

  get status(): SandboxStatus {
    return this._status;
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      await fs.mkdir(this.workingDirectory, { recursive: true });
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
      },
    };
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

    // Use streaming execution when callbacks are provided
    if (options.onStdout || options.onStderr) {
      try {
        const result = await execWithStreaming(command, args, {
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
      const { stdout, stderr } = await execFile(command, args, {
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

  async installPackage(packageName: string, options: InstallPackageOptions = {}): Promise<InstallPackageResult> {
    const manager = options.packageManager ?? 'npm';
    const startTime = Date.now();

    let command: string;
    let args: string[];

    switch (manager) {
      case 'npm':
        command = 'npm';
        args = ['install', packageName];
        if (options.version) args[1] = `${packageName}@${options.version}`;
        if (options.global) args.push('-g');
        break;
      case 'yarn':
        command = 'yarn';
        args = options.global ? ['global', 'add', packageName] : ['add', packageName];
        if (options.version) args[args.length - 1] = `${packageName}@${options.version}`;
        break;
      case 'pnpm':
        command = 'pnpm';
        args = ['add', packageName];
        if (options.version) args[1] = `${packageName}@${options.version}`;
        if (options.global) args.push('-g');
        break;
      case 'pip':
        command = 'pip3';
        args = ['install', packageName];
        if (options.version) args[1] = `${packageName}==${options.version}`;
        break;
      default:
        return {
          success: false,
          packageName,
          error: `Unsupported package manager: ${manager}`,
          executionTimeMs: Date.now() - startTime,
        };
    }

    try {
      await execFile(command, args, {
        cwd: this.workingDirectory,
        timeout: options.timeout ?? 120000,
        env: this.buildEnv(),
      });

      return {
        success: true,
        packageName,
        version: options.version,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      return {
        success: false,
        packageName,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  async getFilesystem(): Promise<WorkspaceFilesystem | undefined> {
    // Local sandbox doesn't provide its own filesystem
    return undefined;
  }

  /**
   * Sync files from a workspace filesystem into this sandbox's working directory.
   * For LocalSandbox, this copies files from the filesystem to the working directory.
   */
  async syncFromFilesystem(filesystem: WorkspaceFilesystem, paths?: string[]): Promise<SandboxSyncResult> {
    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let bytesTransferred = 0;
    const startTime = Date.now();

    const filesToSync = paths ?? (await this.getAllFilesFromFilesystem(filesystem, '/'));

    for (const filePath of filesToSync) {
      try {
        const content = await filesystem.readFile(filePath);
        const destPath = path.join(this._workingDirectory, filePath);

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // Write file
        if (typeof content === 'string') {
          await fs.writeFile(destPath, content, 'utf-8');
          bytesTransferred += Buffer.byteLength(content);
        } else {
          await fs.writeFile(destPath, content);
          bytesTransferred += content.length;
        }

        synced.push(filePath);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ path: filePath, error: message });
      }
    }

    return {
      synced,
      failed,
      bytesTransferred,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Sync files from this sandbox's working directory back to a workspace filesystem.
   * For LocalSandbox, this copies files from the working directory to the filesystem.
   */
  async syncToFilesystem(filesystem: WorkspaceFilesystem, paths?: string[]): Promise<SandboxSyncResult> {
    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let bytesTransferred = 0;
    const startTime = Date.now();

    const filesToSync = paths ?? (await this.getAllLocalFiles(this._workingDirectory));

    for (const filePath of filesToSync) {
      try {
        const srcPath = path.join(this._workingDirectory, filePath);
        const content = await fs.readFile(srcPath);

        await filesystem.writeFile(filePath, content, { recursive: true });
        bytesTransferred += content.length;
        synced.push(filePath);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ path: filePath, error: message });
      }
    }

    return {
      synced,
      failed,
      bytesTransferred,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Recursively get all files from a workspace filesystem.
   */
  private async getAllFilesFromFilesystem(filesystem: WorkspaceFilesystem, dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await filesystem.readdir(dir);

      for (const entry of entries) {
        const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
        if (entry.type === 'file') {
          files.push(fullPath);
        } else if (entry.type === 'directory') {
          files.push(...(await this.getAllFilesFromFilesystem(filesystem, fullPath)));
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Recursively get all files from the local filesystem.
   */
  private async getAllLocalFiles(dir: string, basePath?: string): Promise<string[]> {
    const files: string[] = [];
    const base = basePath ?? dir;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = '/' + path.relative(base, fullPath);

        if (entry.isFile()) {
          files.push(relativePath);
        } else if (entry.isDirectory()) {
          files.push(...(await this.getAllLocalFiles(fullPath, base)));
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return files;
  }
}
