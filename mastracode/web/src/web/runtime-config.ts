/**
 * Process-wide registry for factory-resolved deployment configuration.
 *
 * `MastraFactory.prepare()` (see `./factory-entry.ts`) seeds this module with
 * the explicit config the deploy entry passed in. Deep modules that can't be
 * parameterized through every call site (such as the auth module) consult it
 * via getters instead of reading deployment env themselves.
 *
 * The registry holds *instances*, not connection strings: the injected Mastra
 * storage (whose pg pool is shared by every app-table consumer), the vector
 * store, and the {@link FactoryStore} of app-table domains initialized against
 * that shared pool.
 */

import type { MastraCompositeStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { PostgresStore } from '@mastra/pg';
import type pg from 'pg';
import type { WebAuthAdapter } from './auth-adapter.js';
import type { FactoryIntegration } from './factory-integration.js';
import type { GithubIntegration } from './github/integration.js';
import type { LinearIntegration } from './linear/integration.js';
import type { StateSigner } from './state-signing.js';
import type { FactoryStore } from './storage/factory-store.js';

/**
 * Factory-resolved sandbox runtime: the machine GitHub projects clone their
 * per-project sandboxes from, plus the web-level knobs the factory resolved
 * around it.
 */
export interface WebSandboxRuntime {
  /**
   * Template machine (validated by the factory to implement `clone()`).
   * Never started — acts purely as the credential/default holder that
   * per-project sandboxes are cloned from.
   */
  machine: WorkspaceSandbox;
  /** In-sandbox base directory repos check out under (no trailing slash). */
  workdirBase: string;
  /** Per-replica cap on concurrently provisioned sandboxes. 0 = unlimited. */
  maxSandboxes?: number;
}

export interface WebRuntimeConfig {
  /**
   * Injected Mastra storage instance powering BOTH agent storage (threads,
   * messages, memory, OM) and — when it is a `PostgresStore` — the app tables
   * (github/factory/audit/intake) via its shared pg pool. `undefined` when
   * the factory was configured without storage.
   */
  storage?: MastraCompositeStore;
  /** Injected vector store instance (recall search), when configured. */
  vector?: MastraVector;
  /** Browser-facing origin, normalized without a trailing slash. */
  publicUrl?: string;
  /** Active web auth adapter, or `undefined` when auth is disabled. */
  authAdapter?: WebAuthAdapter;
  /** Active sandbox runtime, or `undefined` when sandboxes are disabled. */
  sandbox?: WebSandboxRuntime;
  /**
   * Registry of factory app-table storage domains (intake, audit, work-items,
   * integration-provided), initialized by `MastraFactory.prepare()` against
   * the injected storage's shared connection. `undefined` when the factory
   * was configured without pg-backed storage — app-DB features stay off.
   */
  factoryStore?: FactoryStore;
  /** Registered integrations (GitHub, Linear, third-party), keyed by their stable id. */
  integrations?: FactoryIntegration[];
  /** Shared OAuth state signer created by the factory (see `./state-signing.ts`). */
  stateSigner?: StateSigner;
}

let seeded: WebRuntimeConfig | undefined;

/** Seed the registry with factory-resolved config. Called once by `MastraFactory.prepare()`. */
export function seedRuntimeConfig(config: WebRuntimeConfig): void {
  seeded = { ...config };
}

/** The injected Mastra storage instance, if seeded. */
export function getSeededStorage(): MastraCompositeStore | undefined {
  return seeded?.storage;
}

/** The injected vector store instance, if seeded. */
export function getSeededVector(): MastraVector | undefined {
  return seeded?.vector;
}

/**
 * The pg pool shared by all app-table consumers (the `getAppDb()` drizzle
 * bridge, the distributed project lock, better-auth). Available only when the
 * seeded storage is a `PostgresStore` — any other backend (or no storage)
 * returns `undefined` and app-DB features stay off.
 */
export function getSharedAppPool(): pg.Pool | undefined {
  const storage = seeded?.storage;
  return storage instanceof PostgresStore ? storage.pool : undefined;
}

/** Browser-facing origin resolved by the factory, if seeded. */
export function getPublicUrl(): string | undefined {
  return seeded?.publicUrl;
}

/** Whether the factory has seeded the registry. */
export function isRuntimeConfigSeeded(): boolean {
  return seeded !== undefined;
}

/**
 * Active web auth adapter seeded by the factory. `undefined` either because
 * auth is disabled (seeded without an adapter) or because the factory never
 * ran — callers that need the distinction check {@link isRuntimeConfigSeeded}.
 */
export function getSeededAuthAdapter(): WebAuthAdapter | undefined {
  return seeded?.authAdapter;
}

/**
 * Sandbox runtime seeded by the factory. `undefined` when the factory was
 * configured without a `sandbox` slot (or never ran) — GitHub-backed repositories
 * stay off in that case.
 */
export function getSeededSandbox(): WebSandboxRuntime | undefined {
  return seeded?.sandbox;
}

/**
 * The seeded {@link FactoryStore}, for the app-table wrapper modules
 * (intake/audit/work-items stores). Throws when the factory never ran or was
 * configured without storage — callers behind a readiness gate never hit
 * this; ungated callers (audit recording) treat it as a normal failure.
 */
export function getFactoryStore(): FactoryStore {
  const store = seeded?.factoryStore;
  if (!store) {
    throw new Error(
      'MastraCode Web: factory storage unavailable — MastraFactory.prepare() has not run or no storage was provided.',
    );
  }
  return store;
}

/** Look up a registered integration by its stable id. */
export function getSeededIntegration(id: string): FactoryIntegration | undefined {
  return seeded?.integrations?.find(integration => integration.id === id);
}

/**
 * GitHub App integration seeded by the factory. Typed convenience over
 * {@link getSeededIntegration} for the sandbox fleet + session tooling, which
 * need GitHub-typed API methods. `undefined` when no GitHub integration was
 * registered (or the factory never ran) — GitHub-backed repositories stay off in
 * that case.
 */
export function getSeededGithubIntegration(): GithubIntegration | undefined {
  const integration = getSeededIntegration('github');
  return integration instanceof Object && 'getInstallationOctokit' in integration
    ? (integration as GithubIntegration)
    : undefined;
}

/**
 * Linear integration seeded by the factory. Typed convenience over
 * {@link getSeededIntegration}. `undefined` when no Linear integration was
 * registered (or the factory never ran) — Linear intake stays off in that case.
 */
export function getSeededLinearIntegration(): LinearIntegration | undefined {
  const integration = getSeededIntegration('linear');
  return integration instanceof Object && 'listActiveIssues' in integration
    ? (integration as LinearIntegration)
    : undefined;
}

/**
 * Shared OAuth state signer seeded by the factory. `undefined` before the
 * factory runs — feature diagnostics report `stateSecretConfigured: false`
 * in that window (integration routes receive the signer explicitly through
 * `IntegrationContext`, so route handlers never read this).
 */
export function getSeededStateSigner(): StateSigner | undefined {
  return seeded?.stateSigner;
}

/** Reset the registry for test isolation. */
export function __resetRuntimeConfigForTests(): void {
  seeded = undefined;
}
