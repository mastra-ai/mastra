/**
 * Base Executor Implementation
 *
 * Abstract base class providing shared logic for executor implementations.
 * Concrete providers extend this class.
 */

import type {
  WorkspaceExecutor,
  Runtime,
  ExecutorStatus,
  ExecutorInfo,
  CodeResult,
  CommandResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  StreamingExecutionResult,
} from './types';

/**
 * Abstract base class for executor implementations.
 *
 * Providers must implement the abstract methods.
 * Common utilities are provided by this base class.
 */
export abstract class BaseExecutor implements WorkspaceExecutor {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly provider: string;
  abstract readonly supportedRuntimes: readonly Runtime[];
  abstract readonly defaultRuntime: Runtime;

  protected _status: ExecutorStatus = 'pending';
  protected _createdAt?: Date;
  protected _lastUsedAt?: Date;

  get status(): ExecutorStatus {
    return this._status;
  }

  // ---------------------------------------------------------------------------
  // Abstract methods - must be implemented by providers
  // ---------------------------------------------------------------------------

  abstract executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  abstract executeCommand(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<CommandResult>;

  abstract start(): Promise<void>;
  abstract destroy(): Promise<void>;
  abstract isReady(): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Optional methods with default implementations
  // ---------------------------------------------------------------------------

  /**
   * Execute code with streaming output.
   * Default throws not implemented. Providers that support streaming should override.
   */
  async executeCodeStream?(
    _code: string,
    _options?: ExecuteCodeOptions,
  ): Promise<StreamingExecutionResult> {
    throw new Error('Streaming code execution not supported by this executor');
  }

  /**
   * Execute command with streaming output.
   * Default throws not implemented. Providers that support streaming should override.
   */
  async executeCommandStream?(
    _command: string,
    _args?: string[],
    _options?: ExecuteCommandOptions,
  ): Promise<StreamingExecutionResult> {
    throw new Error('Streaming command execution not supported by this executor');
  }

  /**
   * Install a package. Default throws not implemented.
   */
  async installPackage?(_packageName: string, _options?: InstallPackageOptions): Promise<void> {
    throw new Error('Package installation not supported by this executor');
  }

  /**
   * Install multiple packages. Default calls installPackage for each.
   */
  async installPackages?(packages: string[], options?: InstallPackageOptions): Promise<void> {
    for (const pkg of packages) {
      await this.installPackage!(pkg, options);
    }
  }

  /**
   * Write file to executor's internal filesystem.
   */
  async writeFile?(_path: string, _content: string | Buffer): Promise<void> {
    throw new Error('File operations not supported by this executor');
  }

  /**
   * Read file from executor's internal filesystem.
   */
  async readFile?(_path: string): Promise<string> {
    throw new Error('File operations not supported by this executor');
  }

  /**
   * List files in executor's internal filesystem.
   */
  async listFiles?(_path: string): Promise<string[]> {
    throw new Error('File operations not supported by this executor');
  }

  /**
   * Stop the executor. Default is a no-op.
   */
  async stop?(): Promise<void> {
    this._status = 'stopped';
  }

  /**
   * Get executor information.
   */
  async getInfo(): Promise<ExecutorInfo> {
    return {
      id: this.id,
      provider: this.provider,
      status: this._status,
      createdAt: this._createdAt ?? new Date(),
      lastUsedAt: this._lastUsedAt,
      metadata: {
        supportedRuntimes: [...this.supportedRuntimes],
        defaultRuntime: this.defaultRuntime,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Utility methods available to subclasses
  // ---------------------------------------------------------------------------

  /**
   * Update last used timestamp.
   */
  protected updateLastUsed(): void {
    this._lastUsedAt = new Date();
  }

  /**
   * Set status with proper transitions.
   */
  protected setStatus(status: ExecutorStatus): void {
    this._status = status;
  }

  /**
   * Get file extension for a runtime.
   */
  protected getRuntimeExtension(runtime: Runtime): string {
    const extensions: Record<Runtime, string> = {
      python: '.py',
      node: '.js',
      bash: '.sh',
      ruby: '.rb',
      go: '.go',
      rust: '.rs',
      deno: '.ts',
      bun: '.ts',
    };
    return extensions[runtime] ?? '.txt';
  }

  /**
   * Get the command to run a runtime.
   */
  protected getRuntimeCommand(runtime: Runtime): string {
    const commands: Record<Runtime, string> = {
      python: 'python3',
      node: 'node',
      bash: 'bash',
      ruby: 'ruby',
      go: 'go',
      rust: 'rustc',
      deno: 'deno',
      bun: 'bun',
    };
    return commands[runtime] ?? runtime;
  }
}
