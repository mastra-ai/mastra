/**
 * E2B Process Manager
 *
 * Implements SandboxProcessManager for E2B cloud sandboxes over the E2B SDK's
 * commands API. The process handling itself is shared with other envd-backed
 * providers in `@internal/workspace`.
 */

import { CommandsApiProcessManager } from '@internal/workspace';
import type { CommandsApi, CommandsApiOperation } from '@internal/workspace';
import type { E2BSandbox } from './index';

/**
 * E2B implementation of SandboxProcessManager.
 * Uses the E2B SDK's commands.run() with background: true.
 */
export interface E2BProcessManagerOptions {
  /** Default timeout in milliseconds for commands that don't specify one. */
  defaultTimeout?: number;
}

export class E2BProcessManager extends CommandsApiProcessManager<E2BSandbox> {
  constructor(opts: E2BProcessManagerOptions = {}) {
    super({ defaultTimeout: opts.defaultTimeout });
  }

  runCommands<T>(operation: CommandsApiOperation, fn: (commands: CommandsApi) => Promise<T>): Promise<T> {
    // A spawn refused by a dead sandbox never ran, so it is safe to recreate
    // the sandbox and spawn again; other operations target a pid in this sandbox.
    if (operation === 'spawn') return this.sandbox.retryOnDead(() => fn(this.sandbox.e2b.commands));
    return fn(this.sandbox.e2b.commands);
  }
}
