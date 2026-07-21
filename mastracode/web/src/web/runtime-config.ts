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
import type { FactoryIntegration } from '@mastra/factory/integrations/base';
import type { StateSigner } from '@mastra/factory/state-signing';

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

/** Look up a registered integration by its stable id. */
export function getSeededIntegration(id: string): FactoryIntegration | undefined {
  return seeded?.integrations?.find(integration => integration.id === id);
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
