/**
 * Local (host-process) sandbox provider for the web factory.
 *
 * Runs repo materialization and commands directly on the server host instead
 * of a remote VM, checking out under a per-deploy root directory.
 *
 * WARNING: this provider does NOT isolate tenants — every project's git
 * operations run as the server process on the same host filesystem. It exists
 * for local single-user development. Do not use it for a shared multi-tenant
 * deployment; use a real cloud sandbox there.
 *
 * ```ts
 * new MastraFactory({ sandbox: new LocalSandboxProvider() });
 * ```
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { LocalSandbox } from './github/local-sandbox.js';
import type { MaterializationSandbox, SandboxCreateOptions, WebSandboxProvider } from './sandbox-provider.js';
import { repoDirName } from './sandbox-provider.js';

export interface LocalSandboxProviderOptions {
  /** Host directory checkouts live under. Default `~/.mastracode/web/sandboxes`. */
  root?: string;
  /** Idle teardown window (minutes). Meaningless locally (stop is a no-op) but honored for parity. */
  idleMinutes?: number;
  /** Per-replica cap on concurrently provisioned sandboxes. 0/omitted = unlimited. */
  maxSandboxes?: number;
}

export class LocalSandboxProvider implements WebSandboxProvider {
  readonly kind = 'local';
  readonly idleMinutes?: number;
  readonly maxSandboxes?: number;
  readonly #root: string;

  constructor(options: LocalSandboxProviderOptions = {}) {
    const root = options.root?.trim();
    this.#root = (root || join(homedir(), '.mastracode', 'web', 'sandboxes')).replace(/\/+$/, '');
    this.idleMinutes = options.idleMinutes;
    this.maxSandboxes = options.maxSandboxes;
  }

  /** The host runs git itself, so the local provider is always usable. */
  isEnabled(): boolean {
    return true;
  }

  create({ providerSandboxId }: SandboxCreateOptions): MaterializationSandbox {
    return new LocalSandbox({ root: this.#root, ...(providerSandboxId ? { sandboxId: providerSandboxId } : {}) });
  }

  workdirFor(repoFullName: string): string {
    return `${this.#root}/${repoDirName(repoFullName)}`;
  }
}
