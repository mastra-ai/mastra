/**
 * Local Sandbox Provider
 *
 * A sandbox implementation that executes code on the local machine.
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
  SandboxRuntime,
  SandboxInfo,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  CodeResult,
  CommandResult,
  InstallPackageOptions,
  InstallPackageResult,
} from './sandbox';
import { SandboxNotReadyError, UnsupportedRuntimeError } from './sandbox';

const execFile = promisify(childProcess.execFile);

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
  /** Default timeout for operations in ms (default: 30000) */
  timeout?: number;
  /** Supported runtimes (default: auto-detect) */
  runtimes?: SandboxRuntime[];
}

/**
 * Local sandbox implementation.
 *
 * Executes code directly on the host machine.
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
 * const result = await workspace.executeCode('console.log("Hello!")', { runtime: 'node' });
 * ```
 */
export class LocalSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'LocalSandbox';
  readonly provider = 'local';

  private _status: SandboxStatus = 'stopped';
  private readonly workingDirectory: string;
  private readonly env: Record<string, string>;
  private readonly timeout: number;
  private detectedRuntimes: SandboxRuntime[] = [];
  private configuredRuntimes?: SandboxRuntime[];

  constructor(options: LocalSandboxOptions = {}) {
    this.id = options.id ?? this.generateId();
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.env = options.env ?? {};
    this.timeout = options.timeout ?? 30000;
    this.configuredRuntimes = options.runtimes;
  }

  private generateId(): string {
    return `local-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes ?? this.detectedRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.supportedRuntimes[0] ?? 'node';
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      await fs.mkdir(this.workingDirectory, { recursive: true });
      await this.detectRuntimes();
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

  private async detectRuntimes(): Promise<void> {
    const runtimes: SandboxRuntime[] = [];

    const checks: Array<{ runtime: SandboxRuntime; command: string }> = [
      { runtime: 'node', command: 'node' },
      { runtime: 'python', command: 'python3' },
      { runtime: 'bash', command: 'bash' },
      { runtime: 'ruby', command: 'ruby' },
      { runtime: 'go', command: 'go' },
      { runtime: 'rust', command: 'cargo' },
    ];

    for (const check of checks) {
      try {
        await execFile(check.command, ['--version'], { timeout: 5000 });
        runtimes.push(check.runtime);
      } catch {
        // Runtime not available
      }
    }

    // Shell is always available
    if (!runtimes.includes('bash')) {
      runtimes.push('shell');
    }

    this.detectedRuntimes = runtimes;
  }

  async executeCode(code: string, options: ExecuteCodeOptions = {}): Promise<CodeResult> {
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this.id);
    }

    const runtime = options.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new UnsupportedRuntimeError(runtime, [...this.supportedRuntimes]);
    }

    const startTime = Date.now();
    const timeout = options.timeout ?? this.timeout;

    try {
      const result = await this.executeCodeForRuntime(code, runtime, options, timeout);
      return {
        ...result,
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

  private async executeCodeForRuntime(
    code: string,
    runtime: SandboxRuntime,
    options: ExecuteCodeOptions,
    timeout: number,
  ): Promise<Omit<CodeResult, 'executionTimeMs'>> {
    const tempFile = path.join(os.tmpdir(), `mastra-code-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      switch (runtime) {
        case 'node':
          return await this.executeNodeCode(code, tempFile, timeout, options.env);
        case 'python':
          return await this.executePythonCode(code, tempFile, timeout, options.env);
        case 'bash':
        case 'shell':
          return await this.executeShellCode(code, tempFile, timeout, options.env);
        case 'ruby':
          return await this.executeRubyCode(code, tempFile, timeout, options.env);
        default:
          throw new UnsupportedRuntimeError(runtime, [...this.supportedRuntimes]);
      }
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore
      }
      try {
        await fs.unlink(tempFile + '.js');
      } catch {
        // Ignore
      }
      try {
        await fs.unlink(tempFile + '.py');
      } catch {
        // Ignore
      }
      try {
        await fs.unlink(tempFile + '.sh');
      } catch {
        // Ignore
      }
      try {
        await fs.unlink(tempFile + '.rb');
      } catch {
        // Ignore
      }
    }
  }

  private async executeNodeCode(
    code: string,
    tempFile: string,
    timeout: number,
    env?: Record<string, string>,
  ): Promise<Omit<CodeResult, 'executionTimeMs'>> {
    const file = tempFile + '.js';
    await fs.writeFile(file, code);

    try {
      const { stdout, stderr } = await execFile('node', [file], {
        cwd: this.workingDirectory,
        timeout,
        env: { ...process.env, ...this.env, ...env },
      });
      return { success: true, stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(error),
        exitCode: e.code ?? 1,
      };
    }
  }

  private async executePythonCode(
    code: string,
    tempFile: string,
    timeout: number,
    env?: Record<string, string>,
  ): Promise<Omit<CodeResult, 'executionTimeMs'>> {
    const file = tempFile + '.py';
    await fs.writeFile(file, code);

    try {
      const { stdout, stderr } = await execFile('python3', [file], {
        cwd: this.workingDirectory,
        timeout,
        env: { ...process.env, ...this.env, ...env },
      });
      return { success: true, stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(error),
        exitCode: e.code ?? 1,
      };
    }
  }

  private async executeShellCode(
    code: string,
    tempFile: string,
    timeout: number,
    env?: Record<string, string>,
  ): Promise<Omit<CodeResult, 'executionTimeMs'>> {
    const file = tempFile + '.sh';
    await fs.writeFile(file, code);
    await fs.chmod(file, '755');

    try {
      const { stdout, stderr } = await execFile('bash', [file], {
        cwd: this.workingDirectory,
        timeout,
        env: { ...process.env, ...this.env, ...env },
      });
      return { success: true, stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(error),
        exitCode: e.code ?? 1,
      };
    }
  }

  private async executeRubyCode(
    code: string,
    tempFile: string,
    timeout: number,
    env?: Record<string, string>,
  ): Promise<Omit<CodeResult, 'executionTimeMs'>> {
    const file = tempFile + '.rb';
    await fs.writeFile(file, code);

    try {
      const { stdout, stderr } = await execFile('ruby', [file], {
        cwd: this.workingDirectory,
        timeout,
        env: { ...process.env, ...this.env, ...env },
      });
      return { success: true, stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(error),
        exitCode: e.code ?? 1,
      };
    }
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

    try {
      const { stdout, stderr } = await execFile(command, args, {
        cwd,
        timeout,
        env: { ...process.env, ...this.env, ...options.env },
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
        env: { ...process.env, ...this.env },
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
}
