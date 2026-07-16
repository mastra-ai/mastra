/**
 * Railway sandbox provider for the web factory.
 *
 * Provisions each GitHub-backed project an isolated cloud VM via
 * `@mastra/railway`. This is the provider for shared multi-tenant deploys —
 * repo materialization and agent commands never touch the server host.
 *
 * ```ts
 * new MastraFactory({
 *   sandbox: new RailwaySandboxProvider({ token: process.env.RAILWAY_API_TOKEN }),
 * });
 * ```
 */

import { RailwaySandbox } from '@mastra/railway';
import type { MaterializationSandbox, SandboxCreateOptions, WebSandboxProvider } from './sandbox-provider.js';
import { repoDirName } from './sandbox-provider.js';

export interface RailwaySandboxProviderOptions {
  /**
   * Railway API token. Optional because the Railway SDK falls back to its own
   * `RAILWAY_API_TOKEN` env var (same pattern as the WorkOS SDK credentials).
   */
  token?: string;
  /**
   * In-sandbox base directory repos check out under. Default `/workspace`.
   * When the base already ends with the repo name it is used as-is.
   */
  workdirBase?: string;
  /** Idle teardown window (minutes). Consumer defaults to 30 when omitted. */
  idleMinutes?: number;
  /** Per-replica cap on concurrently provisioned sandboxes. 0/omitted = unlimited. */
  maxSandboxes?: number;
}

export class RailwaySandboxProvider implements WebSandboxProvider {
  readonly kind = 'railway';
  readonly idleMinutes?: number;
  readonly maxSandboxes?: number;
  readonly #token: string | undefined;
  readonly #workdirBase: string;

  constructor(options: RailwaySandboxProviderOptions = {}) {
    this.#token = options.token;
    this.#workdirBase = (options.workdirBase ?? '/workspace').replace(/\/+$/, '');
    this.idleMinutes = options.idleMinutes;
    this.maxSandboxes = options.maxSandboxes;
  }

  /** Usable only with a token — from the constructor or the SDK's own env fallback. */
  isEnabled(): boolean {
    return Boolean(this.#token ?? process.env.RAILWAY_API_TOKEN);
  }

  create({ providerSandboxId, env, idleTimeoutMinutes }: SandboxCreateOptions): MaterializationSandbox {
    return new RailwaySandbox({
      ...(this.#token ? { token: this.#token } : {}),
      ...(providerSandboxId ? { sandboxId: providerSandboxId } : {}),
      ...(env ? { env } : {}),
      ...(idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes } : {}),
    });
  }

  workdirFor(repoFullName: string): string {
    const repoName = repoDirName(repoFullName);
    return this.#workdirBase.endsWith(`/${repoName}`) ? this.#workdirBase : `${this.#workdirBase}/${repoName}`;
  }
}
