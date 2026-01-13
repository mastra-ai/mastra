/**
 * Local Sandbox Provider
 *
 * A sandbox that runs code on the local machine.
 *
 * ⚠️ WARNING: This sandbox runs code directly on the host machine.
 * It should only be used for development and testing, never in production
 * with untrusted code.
 *
 * For production, use ComputeSDKSandbox with providers like E2B, Modal, or Docker.
 */

import { spawn, execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import * as os from 'node:os';
import type {
  SandboxRuntime,
  SandboxStatus,
  SandboxInfo,
  CodeResult,
  CommandResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  StreamingExecutionResult,
  ExecutionResult,
} from '../../types';
import { SandboxNotReadyError, UnsupportedRuntimeError, SandboxExecutionError } from '../../types';

/**
 * Runtime configuration.
 */
interface RuntimeConfig {
  command: string;
  args: (file: string) => string[];
  extension: string;
  packageManager?: string;
}

const RUNTIME_CONFIGS: Record<SandboxRuntime, RuntimeConfig> = {
  python: {
    command: 'python3',
    args: (file) => [file],
    extension: '.py',
    packageManager: 'pip',
  },
  node: {
    command: 'node',
    args: (file) => [file],
    extension: '.js',
    packageManager: 'npm',
  },
  bash: {
    command: 'bash',
    args: (file) => [file],
    extension: '.sh',
  },
  ruby: {
    command: 'ruby',
    args: (file) => [file],
    extension: '.rb',
    packageManager: 'gem',
  },
  go: {
    command: 'go',
    args: (file) => ['run', file],
    extension: '.go',
    packageManager: 'go',
  },
  rust: {
    command: 'rustc',
    args: (file) => [file, '-o', file.replace('.rs', '')],
    extension: '.rs',
    packageManager: 'cargo',
  },
  deno: {
    command: 'deno',
    args: (file) => ['run', '--allow-all', file],
    extension: '.ts',
  },
  bun: {
    command: 'bun',
    args: (file) => ['run', file],
    extension: '.ts',
  },
};

/**
 * Local sandbox configuration options.
 */
export interface LocalSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** Working directory for executions */
  cwd?: string;
  /** Use a shell for command execution */
  shell?: boolean;
  /** Restrict commands (security) */
  allowedCommands?: string[];
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Environment variables to set in all executions */
  env?: Record<string, string>;
  /** Default runtime */
  defaultRuntime?: SandboxRuntime;
}

/**
 * Local sandbox implementation.
 *
 * Runs code directly on the host machine. Use only for development.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { LocalSandbox } from '@mastra/workspace-sandbox-local';
 *
 * const workspace = new Workspace({
 *   sandbox: new LocalSandbox({ cwd: './workspace' }),
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
  readonly supportedRuntimes: readonly SandboxRuntime[];
  readonly defaultRuntime: SandboxRuntime;

  private _status: SandboxStatus = 'pending';
  private _createdAt?: Date;
  private _lastUsedAt?: Date;

  private readonly cwd: string;
  private readonly shell: boolean;
  private readonly allowedCommands?: string[];
  private readonly defaultTimeout: number;
  private readonly env: Record<string, string>;
  private tempDir?: string;

  constructor(options: LocalSandboxOptions = {}) {
    this.id = options.id ?? this.generateId();
    this.cwd = options.cwd ?? process.cwd();
    this.shell = options.shell ?? false;
    this.allowedCommands = options.allowedCommands;
    this.defaultTimeout = options.timeout ?? 30000;
    this.env = options.env ?? {};
    this.defaultRuntime = options.defaultRuntime ?? 'node';
    this.supportedRuntimes = this.detectRuntimes();
  }

  private generateId(): string {
    return `local-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  /**
   * Detect which runtimes are available on the system.
   */
  private detectRuntimes(): SandboxRuntime[] {
    const available: SandboxRuntime[] = [];

    for (const [runtime, config] of Object.entries(RUNTIME_CONFIGS)) {
      try {
        if (process.platform === 'win32') {
          execSync(`where ${config.command}`, { stdio: 'ignore' });
        } else {
          execSync(`command -v ${config.command}`, { stdio: 'ignore', shell: '/bin/sh' });
        }
        available.push(runtime as SandboxRuntime);
      } catch {
        // Runtime not available
      }
    }

    return available;
  }

  // ---------------------------------------------------------------------------
  // Code Execution
  // ---------------------------------------------------------------------------

  async executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult> {
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this._status);
    }

    const runtime = options?.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new UnsupportedRuntimeError(runtime, this.supportedRuntimes);
    }

    const config = RUNTIME_CONFIGS[runtime];
    const startTime = Date.now();
    const tempFile = nodePath.join(this.tempDir!, `code_${this.generateId()}${config.extension}`);

    await fs.writeFile(tempFile, code);

    try {
      const result = await this.runProcess(config.command, config.args(tempFile), {
        timeout: options?.timeout ?? this.defaultTimeout,
        env: { ...this.env, ...options?.env },
        cwd: options?.cwd ?? this.cwd,
      });

      this._lastUsedAt = new Date();

      return {
        ...result,
        runtime,
        duration: Date.now() - startTime,
      };
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  async executeCodeStream(code: string, options?: ExecuteCodeOptions): Promise<StreamingExecutionResult> {
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this._status);
    }

    const runtime = options?.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new UnsupportedRuntimeError(runtime, this.supportedRuntimes);
    }

    const config = RUNTIME_CONFIGS[runtime];
    const tempFile = nodePath.join(this.tempDir!, `code_${this.generateId()}${config.extension}`);

    await fs.writeFile(tempFile, code);

    return this.runProcessStream(
      config.command,
      config.args(tempFile),
      {
        timeout: options?.timeout ?? this.defaultTimeout,
        env: { ...this.env, ...options?.env },
        cwd: options?.cwd ?? this.cwd,
      },
      async () => {
        await fs.unlink(tempFile).catch(() => {});
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this._status);
    }

    if (this.allowedCommands && !this.allowedCommands.includes(command)) {
      throw new SandboxExecutionError(
        `Command '${command}' is not in the allowed list`,
        1,
        '',
        `Allowed commands: ${this.allowedCommands.join(', ')}`,
      );
    }

    const startTime = Date.now();
    const result = await this.runProcess(command, args ?? [], {
      timeout: options?.timeout ?? this.defaultTimeout,
      env: { ...this.env, ...options?.env },
      cwd: options?.cwd ?? this.cwd,
      shell: options?.shell ?? this.shell,
    });

    this._lastUsedAt = new Date();

    return {
      ...result,
      command,
      args: args ?? [],
      duration: Date.now() - startTime,
    };
  }

  async executeCommandStream(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<StreamingExecutionResult> {
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this._status);
    }

    if (this.allowedCommands && !this.allowedCommands.includes(command)) {
      throw new SandboxExecutionError(
        `Command '${command}' is not in the allowed list`,
        1,
        '',
        `Allowed commands: ${this.allowedCommands.join(', ')}`,
      );
    }

    return this.runProcessStream(command, args ?? [], {
      timeout: options?.timeout ?? this.defaultTimeout,
      env: { ...this.env, ...options?.env },
      cwd: options?.cwd ?? this.cwd,
      shell: options?.shell ?? this.shell,
    });
  }

  // ---------------------------------------------------------------------------
  // Package Management
  // ---------------------------------------------------------------------------

  async installPackage(packageName: string, options?: InstallPackageOptions): Promise<void> {
    if (this._status !== 'running') {
      throw new SandboxNotReadyError(this._status);
    }

    let pm = options?.packageManager;
    if (!pm || pm === 'auto') {
      const config = RUNTIME_CONFIGS[this.defaultRuntime];
      pm = (config.packageManager as 'npm' | 'pip') ?? 'npm';
    }

    const version = options?.version ? `${packageName}@${options.version}` : packageName;

    let cmd: string;
    let cmdArgs: string[];

    switch (pm) {
      case 'npm':
        cmd = 'npm';
        cmdArgs = ['install', options?.dev ? '-D' : '', version].filter(Boolean);
        break;
      case 'pip':
        cmd = 'pip';
        cmdArgs = ['install', version];
        break;
      case 'cargo':
        cmd = 'cargo';
        cmdArgs = ['install', version];
        break;
      case 'go':
        cmd = 'go';
        cmdArgs = ['install', version];
        break;
      default:
        throw new SandboxExecutionError(`Unknown package manager: ${pm}`, 1, '', '');
    }

    await this.executeCommand(cmd, cmdArgs, { timeout: options?.timeout ?? 120000 });
  }

  async installPackages(packages: string[], options?: InstallPackageOptions): Promise<void> {
    for (const pkg of packages) {
      await this.installPackage(pkg, options);
    }
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    if (!this.tempDir) {
      throw new SandboxNotReadyError(this._status);
    }

    const absolutePath = nodePath.isAbsolute(filePath) ? filePath : nodePath.join(this.tempDir, filePath);

    await fs.mkdir(nodePath.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.tempDir) {
      throw new SandboxNotReadyError(this._status);
    }

    const absolutePath = nodePath.isAbsolute(filePath) ? filePath : nodePath.join(this.tempDir, filePath);

    return fs.readFile(absolutePath, 'utf-8');
  }

  async listFiles(dirPath: string): Promise<string[]> {
    if (!this.tempDir) {
      throw new SandboxNotReadyError(this._status);
    }

    const absolutePath = nodePath.isAbsolute(dirPath) ? dirPath : nodePath.join(this.tempDir, dirPath);

    return fs.readdir(absolutePath);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      this.tempDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'mastra-sandbox-'));
      this._createdAt = new Date();
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
    this._status = 'destroying';

    try {
      if (this.tempDir) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      }
    } finally {
      this._status = 'destroyed';
    }
  }

  async isReady(): Promise<boolean> {
    return this._status === 'running';
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      provider: this.provider,
      status: this._status,
      createdAt: this._createdAt ?? new Date(),
      lastUsedAt: this._lastUsedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async runProcess(
    command: string,
    args: string[],
    options: {
      timeout?: number;
      env?: Record<string, string>;
      cwd?: string;
      shell?: boolean | string;
    },
  ): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean; killed: boolean }> {
    return new Promise((resolve, reject) => {
      let timedOut = false;
      let killed = false;

      const proc = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: options.shell,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      proc.stdout?.on('data', (data) => stdout.push(data));
      proc.stderr?.on('data', (data) => stderr.push(data));

      const timeout = options.timeout ?? this.defaultTimeout;
      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        proc.kill('SIGKILL');
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code ?? 0,
          stdout: Buffer.concat(stdout).toString('utf-8'),
          stderr: Buffer.concat(stderr).toString('utf-8'),
          timedOut,
          killed,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(new SandboxExecutionError(error.message, 1, '', error.message));
      });
    });
  }

  private async runProcessStream(
    command: string,
    args: string[],
    options: {
      timeout?: number;
      env?: Record<string, string>;
      cwd?: string;
      shell?: boolean | string;
    },
    cleanup?: () => Promise<void>,
  ): Promise<StreamingExecutionResult> {
    let timedOut = false;
    let killed = false;

    const proc = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: options.shell,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timeout = options.timeout ?? this.defaultTimeout;
    const timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);

    const exitPromise = new Promise<number>((resolve, reject) => {
      proc.on('close', (code) => {
        clearTimeout(timer);
        cleanup?.().catch(() => {});
        resolve(code ?? 0);
      });
      proc.on('error', (error) => {
        clearTimeout(timer);
        cleanup?.().catch(() => {});
        reject(error);
      });
    });

    async function* streamToAsyncIterable(stream: NodeJS.ReadableStream): AsyncIterable<string> {
      for await (const chunk of stream) {
        yield chunk.toString('utf-8');
      }
    }

    const stdout: string[] = [];
    const stderr: string[] = [];

    proc.stdout?.on('data', (data) => stdout.push(data.toString('utf-8')));
    proc.stderr?.on('data', (data) => stderr.push(data.toString('utf-8')));

    return {
      exitCode: exitPromise,
      stdout: streamToAsyncIterable(proc.stdout!),
      stderr: streamToAsyncIterable(proc.stderr!),
      kill: async () => {
        killed = true;
        proc.kill('SIGKILL');
      },
      wait: async (): Promise<ExecutionResult> => {
        const exitCode = await exitPromise;
        return {
          exitCode,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          duration: 0,
          timedOut,
          killed,
        };
      },
    };
  }
}
