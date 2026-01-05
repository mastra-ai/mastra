/**
 * Local Executor Provider
 *
 * An executor that runs code on the local machine.
 *
 * ⚠️ WARNING: This executor runs code directly on the host machine.
 * It should only be used for development and testing, never in production
 * with untrusted code.
 */

import { spawn, execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { BaseExecutor } from '../base';
import type {
  Runtime,
  CodeResult,
  CommandResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  StreamingExecutionResult,
  LocalExecutorConfig,
} from '../types';
import {
  ExecutorNotReadyError,
  UnsupportedRuntimeError,
  ExecutionError,
} from '../types';

/**
 * Runtime configuration.
 */
interface RuntimeConfig {
  command: string;
  args: (file: string) => string[];
  extension: string;
  packageManager?: string;
}

const RUNTIME_CONFIGS: Record<Runtime, RuntimeConfig> = {
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
 * Local executor configuration options.
 */
export interface LocalExecutorOptions {
  id: string;
  cwd?: string;
  shell?: boolean;
  allowedCommands?: string[];
  timeout?: number;
  env?: Record<string, string>;
  defaultRuntime?: Runtime;
}

/**
 * Local executor implementation.
 */
export class LocalExecutor extends BaseExecutor {
  readonly id: string;
  readonly name = 'LocalExecutor';
  readonly provider = 'local';
  readonly supportedRuntimes: readonly Runtime[];
  readonly defaultRuntime: Runtime;

  private readonly cwd: string;
  private readonly shell: boolean;
  private readonly allowedCommands?: string[];
  private readonly defaultTimeout: number;
  private readonly env: Record<string, string>;
  private tempDir?: string;

  constructor(config: LocalExecutorConfig | LocalExecutorOptions) {
    super();
    this.id = config.id;
    this.cwd = config.cwd ?? process.cwd();
    this.shell = config.shell ?? false;
    this.allowedCommands = config.allowedCommands;
    this.defaultTimeout = config.timeout ?? 30000;
    this.env = config.env ?? {};
    this.defaultRuntime = config.defaultRuntime ?? 'node';
    this.supportedRuntimes = this.detectRuntimes();
  }

  /**
   * Detect which runtimes are available on the system.
   */
  private detectRuntimes(): Runtime[] {
    const available: Runtime[] = [];

    for (const [runtime, config] of Object.entries(RUNTIME_CONFIGS)) {
      try {
        if (process.platform === 'win32') {
          execSync(`where ${config.command}`, { stdio: 'ignore' });
        } else {
          execSync(`command -v ${config.command}`, { stdio: 'ignore', shell: '/bin/sh' });
        }
        available.push(runtime as Runtime);
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
      throw new ExecutorNotReadyError(this._status);
    }

    const runtime = options?.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new UnsupportedRuntimeError(runtime, this.supportedRuntimes);
    }

    const config = RUNTIME_CONFIGS[runtime];
    const startTime = Date.now();
    const tempFile = path.join(this.tempDir!, `code_${uuidv4()}${config.extension}`);

    await fs.writeFile(tempFile, code);

    try {
      const result = await this.runProcess(
        config.command,
        config.args(tempFile),
        {
          timeout: options?.timeout ?? this.defaultTimeout,
          env: { ...this.env, ...options?.env },
          cwd: options?.cwd ?? this.cwd,
        },
      );

      this.updateLastUsed();

      return {
        ...result,
        runtime,
        duration: Date.now() - startTime,
      };
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  override async executeCodeStream(
    code: string,
    options?: ExecuteCodeOptions,
  ): Promise<StreamingExecutionResult> {
    if (this._status !== 'running') {
      throw new ExecutorNotReadyError(this._status);
    }

    const runtime = options?.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new UnsupportedRuntimeError(runtime, this.supportedRuntimes);
    }

    const config = RUNTIME_CONFIGS[runtime];
    const tempFile = path.join(this.tempDir!, `code_${uuidv4()}${config.extension}`);

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

  async executeCommand(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<CommandResult> {
    if (this._status !== 'running') {
      throw new ExecutorNotReadyError(this._status);
    }

    if (this.allowedCommands && !this.allowedCommands.includes(command)) {
      throw new ExecutionError(
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

    this.updateLastUsed();

    return {
      ...result,
      command,
      args: args ?? [],
      duration: Date.now() - startTime,
    };
  }

  override async executeCommandStream(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<StreamingExecutionResult> {
    if (this._status !== 'running') {
      throw new ExecutorNotReadyError(this._status);
    }

    if (this.allowedCommands && !this.allowedCommands.includes(command)) {
      throw new ExecutionError(
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

  override async installPackage(packageName: string, options?: InstallPackageOptions): Promise<void> {
    if (this._status !== 'running') {
      throw new ExecutorNotReadyError(this._status);
    }

    let pm = options?.packageManager;
    if (!pm || pm === 'auto') {
      const config = RUNTIME_CONFIGS[this.defaultRuntime];
      pm = (config.packageManager as 'npm' | 'pip') ?? 'npm';
    }

    const version = options?.version ? `${packageName}@${options.version}` : packageName;

    let cmd: string;
    let args: string[];

    switch (pm) {
      case 'npm':
        cmd = 'npm';
        args = ['install', options?.dev ? '-D' : '', version].filter(Boolean);
        break;
      case 'pip':
        cmd = 'pip';
        args = ['install', version];
        break;
      case 'cargo':
        cmd = 'cargo';
        args = ['install', version];
        break;
      case 'go':
        cmd = 'go';
        args = ['install', version];
        break;
      default:
        throw new ExecutionError(`Unknown package manager: ${pm}`, 1, '', '');
    }

    await this.executeCommand(cmd, args, { timeout: options?.timeout ?? 120000 });
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  override async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    if (!this.tempDir) {
      throw new ExecutorNotReadyError(this._status);
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.tempDir, filePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }

  override async readFile(filePath: string): Promise<string> {
    if (!this.tempDir) {
      throw new ExecutorNotReadyError(this._status);
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.tempDir, filePath);

    return fs.readFile(absolutePath, 'utf-8');
  }

  override async listFiles(dirPath: string): Promise<string[]> {
    if (!this.tempDir) {
      throw new ExecutorNotReadyError(this._status);
    }

    const absolutePath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(this.tempDir, dirPath);

    return fs.readdir(absolutePath);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    this.setStatus('starting');

    try {
      this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-executor-'));
      this._createdAt = new Date();
      this.setStatus('running');
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  override async stop(): Promise<void> {
    this.setStatus('stopped');
  }

  async destroy(): Promise<void> {
    this.setStatus('destroying');

    try {
      if (this.tempDir) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      }
    } finally {
      this.setStatus('destroyed');
    }
  }

  async isReady(): Promise<boolean> {
    return this._status === 'running';
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
        reject(new ExecutionError(error.message, 1, '', error.message));
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

    async function* streamToAsyncIterable(
      stream: NodeJS.ReadableStream,
    ): AsyncIterable<string> {
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
      wait: async () => {
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
