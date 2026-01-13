/**
 * ComputeSDK Sandbox Provider
 *
 * A sandbox implementation using ComputeSDK for secure cloud execution.
 * Supports multiple providers: E2B, Modal, Railway, Daytona, Vercel, and more.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';
 *
 * const workspace = new Workspace({
 *   sandbox: new ComputeSDKSandbox({
 *     provider: 'e2b',
 *     apiKey: process.env.COMPUTESDK_API_KEY,
 *   }),
 * });
 *
 * await workspace.init();
 * const result = await workspace.executeCode('print("Hello!")', { runtime: 'python' });
 * ```
 */

import { compute, Sandbox as ComputeSandbox } from 'computesdk';
import type { ProviderName } from 'computesdk';
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
  WorkspaceFilesystem,
} from '@mastra/core';
import { SandboxNotReadyError, UnsupportedRuntimeError } from '@mastra/core';

/**
 * Supported cloud providers via ComputeSDK.
 */
export type ComputeProvider = ProviderName;

/**
 * Configuration options for ComputeSDKSandbox.
 */
export interface ComputeSDKSandboxOptions {
  /**
   * Cloud provider to use for sandbox execution.
   * Options: 'e2b', 'modal', 'railway', 'daytona', 'vercel', 'runloop', 'cloudflare', 'codesandbox', 'blaxel'
   */
  provider: ComputeProvider;

  /**
   * ComputeSDK API key.
   * Get one at https://computesdk.com
   */
  apiKey?: string;

  /**
   * Provider-specific API key (e.g., E2B_API_KEY).
   * Can also be set via environment variables.
   */
  providerApiKey?: string;

  /**
   * Unique identifier for this sandbox instance.
   */
  id?: string;

  /**
   * Human-readable name for this sandbox.
   */
  name?: string;

  /**
   * Default timeout for operations in ms (default: 30000).
   */
  timeout?: number;

  /**
   * Template ID for the sandbox (provider-specific).
   */
  templateId?: string;

  /**
   * Environment variables to set in the sandbox.
   */
  env?: Record<string, string>;

  /**
   * Additional metadata for the sandbox.
   */
  metadata?: Record<string, unknown>;
}

/**
 * ComputeSDK sandbox implementation.
 *
 * Uses ComputeSDK to provide secure, isolated cloud execution environments.
 * Supports multiple cloud providers through a unified API.
 *
 * Features:
 * - Secure isolation (code runs in cloud VMs/containers)
 * - Multiple provider support (E2B, Modal, Railway, etc.)
 * - Multi-runtime (Node.js, Python, Bash, etc.)
 * - Built-in filesystem access
 *
 * @example
 * ```typescript
 * import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';
 *
 * // Using E2B
 * const sandbox = new ComputeSDKSandbox({
 *   provider: 'e2b',
 *   apiKey: process.env.COMPUTESDK_API_KEY,
 * });
 *
 * await sandbox.start();
 * const result = await sandbox.executeCode('console.log("Hello!")', { runtime: 'node' });
 * console.log(result.stdout); // "Hello!"
 * await sandbox.destroy();
 * ```
 */
export class ComputeSDKSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name: string;
  readonly provider: string;

  private _status: SandboxStatus = 'stopped';
  private _sandbox: ComputeSandbox | null = null;
  private readonly options: ComputeSDKSandboxOptions;
  private readonly timeout: number;
  private _createdAt: Date | null = null;

  // ComputeSDK supports these runtimes
  private static readonly SUPPORTED_RUNTIMES: SandboxRuntime[] = ['node', 'python', 'bash', 'shell'];

  constructor(options: ComputeSDKSandboxOptions) {
    this.options = options;
    this.id = options.id ?? this.generateId();
    this.name = options.name ?? `ComputeSDK-${options.provider}`;
    this.provider = `computesdk-${options.provider}`;
    this.timeout = options.timeout ?? 30000;
  }

  private generateId(): string {
    return `compute-${this.options.provider}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return ComputeSDKSandbox.SUPPORTED_RUNTIMES;
  }

  get defaultRuntime(): SandboxRuntime {
    return 'node';
  }

  /**
   * Start the sandbox (creates a new sandbox instance in the cloud).
   */
  async start(): Promise<void> {
    if (this._sandbox) {
      return; // Already started
    }

    this._status = 'starting';

    try {
      // Configure compute with explicit settings
      if (this.options.apiKey) {
        // Build provider-specific config dynamically
        const providerConfig: Record<string, unknown> = {};
        if (this.options.providerApiKey) {
          providerConfig[this.options.provider] = {
            apiKey: this.options.providerApiKey,
          };
        }

        // Use explicit typing to satisfy the compute.setConfig requirements
        compute.setConfig({
          provider: this.options.provider,
          apiKey: this.options.apiKey,
          ...providerConfig,
        } as Parameters<typeof compute.setConfig>[0]);
      }

      // Create the sandbox
      this._sandbox = await compute.sandbox.create({
        timeout: this.timeout,
        templateId: this.options.templateId,
        envs: this.options.env,
        metadata: this.options.metadata as Record<string, unknown>,
      });

      this._createdAt = new Date();
      this._status = 'running';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /**
   * Stop the sandbox (keeps it available for restart).
   */
  async stop(): Promise<void> {
    this._status = 'stopped';
    // Note: ComputeSDK sandboxes typically auto-terminate
    // We just mark it as stopped here
  }

  /**
   * Destroy the sandbox and clean up all resources.
   */
  async destroy(): Promise<void> {
    if (this._sandbox) {
      try {
        await this._sandbox.destroy();
      } catch {
        // Ignore destruction errors
      }
      this._sandbox = null;
    }
    this._status = 'destroyed';
  }

  /**
   * Check if the sandbox is ready for commands.
   */
  async isReady(): Promise<boolean> {
    return this._status === 'running' && this._sandbox !== null;
  }

  /**
   * Get sandbox information/metadata.
   */
  async getInfo(): Promise<SandboxInfo> {
    const info = this._sandbox ? await this._sandbox.getInfo() : null;

    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this._status,
      createdAt: this._createdAt ?? new Date(),
      resources: info?.metadata as SandboxInfo['resources'],
      metadata: {
        computeProvider: this.options.provider,
        sandboxId: this._sandbox?.sandboxId,
        ...this.options.metadata,
      },
    };
  }

  private ensureReady(): ComputeSandbox {
    if (!this._sandbox || this._status !== 'running') {
      throw new SandboxNotReadyError(this._status);
    }
    return this._sandbox;
  }

  private mapRuntime(runtime: SandboxRuntime): 'node' | 'python' {
    switch (runtime) {
      case 'node':
      case 'deno':
      case 'bun':
        return 'node';
      case 'python':
        return 'python';
      case 'bash':
      case 'shell':
        // For bash/shell, we'll use runCommand instead
        return 'node'; // Fallback, won't be used for shell
      default:
        throw new UnsupportedRuntimeError(runtime, [...this.supportedRuntimes]);
    }
  }

  /**
   * Execute code in the sandbox.
   */
  async executeCode(code: string, options: ExecuteCodeOptions = {}): Promise<CodeResult> {
    const sandbox = this.ensureReady();
    const runtime = options.runtime ?? this.defaultRuntime;
    const startTime = Date.now();

    try {
      // For bash/shell, use runCommand
      if (runtime === 'bash' || runtime === 'shell') {
        const result = await sandbox.runCommand(code, {
          cwd: options.cwd,
          env: options.env,
        });

        return {
          success: result.exitCode === 0,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          executionTimeMs: result.durationMs ?? Date.now() - startTime,
          runtime,
        };
      }

      // For code execution
      const computeRuntime = this.mapRuntime(runtime);
      const result = await sandbox.runCode(code, computeRuntime);

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.output,
        stderr: '',
        executionTimeMs: Date.now() - startTime,
        runtime,
      };
    } catch (error: unknown) {
      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
        runtime,
      };
    }
  }

  /**
   * Execute a shell command in the sandbox.
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    const sandbox = this.ensureReady();
    const startTime = Date.now();

    // Build full command string
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    try {
      const result = await sandbox.runCommand(fullCommand, {
        cwd: options.cwd,
        env: options.env,
      });

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTimeMs: result.durationMs ?? Date.now() - startTime,
        command: fullCommand,
        args,
      };
    } catch (error: unknown) {
      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
        command: fullCommand,
        args,
      };
    }
  }

  /**
   * Install a package in the sandbox.
   */
  async installPackage(
    packageName: string,
    options: InstallPackageOptions = {},
  ): Promise<InstallPackageResult> {
    const sandbox = this.ensureReady();
    const startTime = Date.now();

    // Determine package manager and command
    const manager = options.packageManager ?? 'npm';
    let command: string;

    switch (manager) {
      case 'npm':
        command = options.version
          ? `npm install ${packageName}@${options.version}`
          : `npm install ${packageName}`;
        break;
      case 'yarn':
        command = options.version
          ? `yarn add ${packageName}@${options.version}`
          : `yarn add ${packageName}`;
        break;
      case 'pnpm':
        command = options.version
          ? `pnpm add ${packageName}@${options.version}`
          : `pnpm add ${packageName}`;
        break;
      case 'pip':
        command = options.version
          ? `pip install ${packageName}==${options.version}`
          : `pip install ${packageName}`;
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
      const result = await sandbox.runCommand(command);

      return {
        success: result.exitCode === 0,
        packageName,
        version: options.version,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        executionTimeMs: result.durationMs ?? Date.now() - startTime,
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

  /**
   * Get the sandbox's internal filesystem.
   * ComputeSDK sandboxes have their own filesystem.
   */
  async getFilesystem(): Promise<WorkspaceFilesystem | undefined> {
    // ComputeSDK sandboxes have a filesystem, but it uses a different interface
    // We could wrap it, but for now return undefined
    // Users should use workspace.filesystem for file operations
    return undefined;
  }
}

// Re-export useful types
export type {
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
} from '@mastra/core';
