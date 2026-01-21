/**
 * ComputeSDK Sandbox Provider
 *
 * A sandbox implementation that uses ComputeSDK for cloud-based code execution.
 * Supports multiple providers (E2B, Modal, etc.) through ComputeSDK's unified API.
 *
 * @see https://www.computesdk.com/docs/reference/computesandbox
 */

import { compute, type Sandbox } from 'computesdk';
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
} from '@mastra/core/workspace';

/**
 * ComputeSDK sandbox provider configuration.
 */
export interface ComputeSDKSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** Named sandbox for persistence across restarts */
  name?: string;
  /** Namespace for sandbox isolation (default: "default") */
  namespace?: string;
  /** Execution timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Provider-specific template ID */
  templateId?: string;
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Supported runtimes (default: ['node', 'python', 'bash']) */
  runtimes?: SandboxRuntime[];
}

/**
 * ComputeSDK sandbox implementation.
 *
 * Uses ComputeSDK to execute code in cloud-based sandboxes.
 * Supports multiple providers through ComputeSDK's unified API.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
 * import { ComputeSDKSandbox } from './computesdk-sandbox';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new ComputeSDKSandbox({
 *     name: 'my-sandbox',
 *     timeout: 60000,
 *   }),
 * });
 *
 * await workspace.init();
 * const result = await workspace.executeCode('console.log("Hello!")', { runtime: 'node' });
 * ```
 */
export class ComputeSDKSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'ComputeSDKSandbox';
  readonly provider = 'computesdk';

  private _status: SandboxStatus = 'stopped';
  private _sandbox: Sandbox | null = null;

  private readonly sandboxName?: string;
  private readonly namespace: string;
  private readonly timeout: number;
  private readonly templateId?: string;
  private readonly env: Record<string, string>;
  private readonly metadata: Record<string, unknown>;
  private readonly configuredRuntimes: SandboxRuntime[];

  constructor(options: ComputeSDKSandboxOptions = {}) {
    this.id = options.id ?? this.generateId();
    this.sandboxName = options.name;
    this.namespace = options.namespace ?? 'default';
    this.timeout = options.timeout ?? 30000;
    this.templateId = options.templateId;
    this.env = options.env ?? {};
    this.metadata = options.metadata ?? {};
    this.configuredRuntimes = options.runtimes ?? ['node', 'python', 'bash'];
  }

  private generateId(): string {
    return `computesdk-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.configuredRuntimes[0] ?? 'node';
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      // Use findOrCreate if we have a name (enables persistence)
      if (this.sandboxName) {
        this._sandbox = await compute.sandbox.findOrCreate({
          name: this.sandboxName,
          namespace: this.namespace,
          timeout: this.timeout,
          envs: this.env,
          metadata: this.metadata,
        });
      } else {
        this._sandbox = await compute.sandbox.create({
          timeout: this.timeout,
          envs: this.env,
          metadata: this.metadata,
        });
      }

      this._status = 'running';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    // ComputeSDK sandboxes don't have a stop state - they're either running or destroyed
    // For named sandboxes, we just disconnect without destroying
    this._sandbox = null;
    this._status = 'stopped';
  }

  async destroy(): Promise<void> {
    if (this._sandbox) {
      try {
        await this._sandbox.destroy();
      } catch {
        // Ignore errors during destroy
      }
    }
    this._sandbox = null;
    this._status = 'destroyed';
  }

  async isReady(): Promise<boolean> {
    return this._status === 'running' && this._sandbox !== null;
  }

  async getInfo(): Promise<SandboxInfo> {
    if (!this._sandbox) {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this._status,
        createdAt: new Date(),
        metadata: {
          sandboxName: this.sandboxName,
          namespace: this.namespace,
        },
      };
    }

    try {
      const info = await this._sandbox.getInfo();
      return {
        id: info.id,
        name: this.name,
        provider: info.provider,
        status: this._status,
        createdAt: info.createdAt,
        timeoutAt: info.timeout ? new Date(Date.now() + info.timeout) : undefined,
        metadata: {
          ...info.metadata,
          sandboxName: this.sandboxName,
          namespace: this.namespace,
          runtime: info.runtime,
        },
      };
    } catch {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this._status,
        createdAt: new Date(),
      };
    }
  }

  async executeCode(code: string, options: ExecuteCodeOptions = {}): Promise<CodeResult> {
    // Lazy initialization - start sandbox if not running
    if (this._status !== 'running' || !this._sandbox) {
      await this.start();
    }

    if (!this._sandbox) {
      throw new Error(`Sandbox failed to start: ${this.id}`);
    }

    const runtime = options.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new Error(`Runtime '${runtime}' is not supported. Supported: ${this.supportedRuntimes.join(', ')}`);
    }

    const startTime = Date.now();

    try {
      // Map our runtime names to ComputeSDK language names
      const language = this.mapRuntimeToLanguage(runtime) as 'python' | 'node' | undefined;

      const result = await this._sandbox.runCode(code, language);

      return {
        success: result.exitCode === 0,
        stdout: result.output,
        stderr: '',
        exitCode: result.exitCode,
        executionTimeMs: Date.now() - startTime,
        runtime,
      };
    } catch (error: unknown) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        executionTimeMs: Date.now() - startTime,
        runtime,
      };
    }
  }

  private mapRuntimeToLanguage(runtime: SandboxRuntime): string {
    switch (runtime) {
      case 'node':
        return 'node';
      case 'python':
        return 'python';
      case 'bash':
      case 'shell':
        return 'bash';
      case 'deno':
        return 'deno';
      case 'bun':
        return 'bun';
      default:
        return runtime;
    }
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    // Lazy initialization - start sandbox if not running
    if (this._status !== 'running' || !this._sandbox) {
      await this.start();
    }

    if (!this._sandbox) {
      throw new Error(`Sandbox failed to start: ${this.id}`);
    }

    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    try {
      const result = await this._sandbox.runCommand(fullCommand, {
        cwd: options.cwd,
        env: options.env,
      });

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: result.durationMs ?? Date.now() - startTime,
        command,
        args,
      };
    } catch (error: unknown) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        executionTimeMs: Date.now() - startTime,
        command,
        args,
      };
    }
  }

  async installPackage(packageName: string, options: InstallPackageOptions = {}): Promise<InstallPackageResult> {
    const manager = options.packageManager ?? 'npm';
    const startTime = Date.now();

    let command: string;

    switch (manager) {
      case 'npm':
        command = options.global ? `npm install -g ${packageName}` : `npm install ${packageName}`;
        if (options.version) command = command.replace(packageName, `${packageName}@${options.version}`);
        break;
      case 'yarn':
        command = options.global ? `yarn global add ${packageName}` : `yarn add ${packageName}`;
        if (options.version) command = command.replace(packageName, `${packageName}@${options.version}`);
        break;
      case 'pnpm':
        command = options.global ? `pnpm add -g ${packageName}` : `pnpm add ${packageName}`;
        if (options.version) command = command.replace(packageName, `${packageName}@${options.version}`);
        break;
      case 'pip':
        command = `pip install ${packageName}`;
        if (options.version) command = `pip install ${packageName}==${options.version}`;
        break;
      default:
        return {
          success: false,
          packageName,
          error: `Unsupported package manager: ${manager}`,
          executionTimeMs: Date.now() - startTime,
        };
    }

    const result = await this.executeCommand(command, [], {
      timeout: options.timeout ?? 120000,
    });

    if (result.success) {
      return {
        success: true,
        packageName,
        version: options.version,
        executionTimeMs: result.executionTimeMs,
      };
    } else {
      return {
        success: false,
        packageName,
        error: result.stderr || 'Installation failed',
        executionTimeMs: result.executionTimeMs,
      };
    }
  }

  // Filesystem operations - delegate to ComputeSDK's filesystem
  async writeFile(path: string, content: string | Buffer): Promise<void> {
    if (!this._sandbox) {
      throw new Error(`Sandbox is not ready: ${this.id}`);
    }
    const contentStr = typeof content === 'string' ? content : content.toString('utf-8');
    await this._sandbox.filesystem.writeFile(path, contentStr);
  }

  async readFile(path: string): Promise<string> {
    if (!this._sandbox) {
      throw new Error(`Sandbox is not ready: ${this.id}`);
    }
    return this._sandbox.filesystem.readFile(path);
  }

  async listFiles(path: string): Promise<string[]> {
    if (!this._sandbox) {
      throw new Error(`Sandbox is not ready: ${this.id}`);
    }
    const entries = await this._sandbox.filesystem.readdir(path);
    return entries.map(e => e.name);
  }
}
