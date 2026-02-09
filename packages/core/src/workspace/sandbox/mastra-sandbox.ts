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
import type { WorkspaceSandbox } from './sandbox';

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
 *   readonly name = 'MyCustomSandbox';
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
 *   // ... implement other WorkspaceSandbox methods
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

  constructor(options: { name: string }) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });
  }
}
