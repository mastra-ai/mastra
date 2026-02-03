/**
 * MastraSandbox Base Class
 *
 * Abstract base class for sandbox providers that want automatic logger integration.
 * Extends MastraBase to receive the Mastra logger when registered with a Mastra instance.
 *
 * External providers can extend this class to get logger support, or implement
 * the WorkspaceSandbox interface directly if they don't need logging.
 */

import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger/constants';
import type { ProviderStatus } from '../lifecycle';
import type { WorkspaceSandbox, SandboxInfo, ExecuteCommandOptions, CommandResult } from './sandbox';

/**
 * Abstract base class for sandbox providers with logger support.
 *
 * Providers that extend this class automatically receive the Mastra logger
 * when the sandbox is used with a Mastra instance.
 *
 * @example
 * ```typescript
 * class MyCustomSandbox extends MastraSandbox {
 *   readonly id = 'my-sandbox';
 *   readonly provider = 'custom';
 *   status: ProviderStatus = 'stopped';
 *
 *   constructor() {
 *     super({ name: 'MyCustomSandbox' });
 *   }
 *
 *   async executeCommand(command: string, args?: string[]): Promise<CommandResult> {
 *     this.logger.debug('Executing command', { command, args });
 *     // Implementation...
 *   }
 *   // ... other methods
 * }
 * ```
 */
export abstract class MastraSandbox extends MastraBase implements WorkspaceSandbox {
  /** Unique identifier for this sandbox instance */
  abstract readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  abstract readonly name: string;

  /** Provider type identifier */
  abstract readonly provider: string;

  /** Current status of the sandbox */
  abstract status: ProviderStatus;

  /**
   * Working directory for command execution (if applicable).
   * Not all sandbox implementations have a fixed working directory.
   * Subclasses can override this as a getter if needed.
   */
  get workingDirectory(): string | undefined {
    return undefined;
  }

  constructor(options: { name: string }) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });
  }

  // ---------------------------------------------------------------------------
  // Optional Methods - Subclasses can override
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command.
   * Optional - if not implemented, the workspace_execute_command tool won't be available.
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  /**
   * Get instructions describing how this sandbox works.
   * Used in tool descriptions to help agents understand execution context.
   */
  getInstructions?(): string;

  /**
   * One-time setup operations.
   */
  init?(): void | Promise<void>;

  /**
   * Begin active operation.
   */
  start?(): void | Promise<void>;

  /**
   * Pause operation, keeping state for potential restart.
   */
  stop?(): void | Promise<void>;

  /**
   * Clean up all resources.
   */
  destroy?(): void | Promise<void>;

  /**
   * Check if ready for operations.
   */
  isReady?(): boolean | Promise<boolean>;

  /**
   * Get status and metadata.
   */
  getInfo?(): SandboxInfo | Promise<SandboxInfo>;
}
