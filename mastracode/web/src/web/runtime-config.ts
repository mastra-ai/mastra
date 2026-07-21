/**
 * Process-wide registry for factory-resolved deployment configuration.
 *
 * `MastraFactory.prepare()` (see `./factory-entry.ts`) seeds this module with
 * the explicit config the deploy entry passed in. Deep modules that can't be
 * parameterized through every call site (such as the auth module) consult it
 * via getters instead of reading deployment env themselves.
 *
 * The registry holds *instances*, not connection strings: the factory storage
 * backend (shared by agent state and every app-table consumer and owner of the
 * app-table domains) and the vector store.
 */

import type { IMastraAuthProvider } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import type { FactoryIntegration } from './factory-integration.js';
import type { GithubIntegration } from './github/integration.js';
import type { LinearIntegration } from './linear/integration.js';
import type { StateSigner } from './state-signing.js';

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
   * The factory storage backend powering BOTH agent storage (threads,
   * messages, memory, OM — via `getMastraStorage()`) and the app tables
   * (github/factory/audit/intake — via `ops`). `undefined` only when the
   * factory never ran (test seeds may omit it).
   */
  storage?: FactoryStorage;
  /** Injected vector store instance (recall search), when configured. */
  vector?: MastraVector;
  /** Browser-facing origin, normalized without a trailing slash. */
  publicUrl?: string;
  /** Active auth provider, or `undefined` when auth is disabled. */
  authProvider?: IMastraAuthProvider;
  /** Active sandbox runtime, or `undefined` when sandboxes are disabled. */
  sandbox?: WebSandboxRuntime;
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

/** The factory storage backend, if seeded. */
export function getSeededStorage(): FactoryStorage | undefined {
  return seeded?.storage;
}

/** The injected vector store instance, if seeded. */
export function getSeededVector(): MastraVector | undefined {
  return seeded?.vector;
}

/**
 * The factory storage backend shared by all app-table consumers (the storage
 * domains, the distributed project lock, better-auth). Throws when the
 * factory never ran — deep consumers only reach this after `prepare()`.
 */
export function getFactoryStorage(): FactoryStorage {
  const storage = seeded?.storage;
  if (!storage) {
    throw new Error('MastraCode Web: factory storage unavailable — MastraFactory.prepare() has not run.');
  }
  return storage;
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
 * Active auth provider seeded by the factory. `undefined` either because
 * auth is disabled (seeded without a provider) or because the factory never
 * ran — callers that need the distinction check {@link isRuntimeConfigSeeded}.
 */
export function getSeededAuthProvider(): IMastraAuthProvider | undefined {
  return seeded?.authProvider;
}

/**
 * Sandbox runtime seeded by the factory. `undefined` when the factory was
 * configured without a `sandbox` slot (or never ran) — GitHub-backed projects
 * stay off in that case.
 */
export function getSeededSandbox(): WebSandboxRuntime | undefined {
  return seeded?.sandbox;
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
  return integration?.versionControl ? (integration as GithubIntegration) : undefined;
}

/**
 * Linear integration seeded by the factory. Typed convenience over
 * {@link getSeededIntegration}. `undefined` when no Linear integration was
 * registered (or the factory never ran) — Linear intake stays off in that case.
 */
export function getSeededLinearIntegration(): LinearIntegration | undefined {
  const integration = getSeededIntegration('linear');
  return integration?.intake ? (integration as LinearIntegration) : undefined;
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
