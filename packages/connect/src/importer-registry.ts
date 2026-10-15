import type { KnowledgeImporterDefinition } from '@mastra/core/knowledge';

import type { ProjectConnection, ProxyRequestOptions } from './client.js';

/** Provider-relative request sent through the platform connection proxy. */
export type ImporterProxyRequest = ProxyRequestOptions;
/** Parsed JSON body (or raw text / null) returned by the provider through the proxy. */
export type ImporterProxyResponse = unknown;

/** Scope-address → role map importers are granted by the host. */
export type ImporterAccess = Readonly<Record<string, 'owner' | 'edit'>>;

/** Context handed to an {@link ImporterScopesResolver} at each resolution. */
export interface ImporterScopesContext {
  /** The platform connection the resolving importer is bound to. */
  readonly connection: ProjectConnection;
}

/**
 * Resolves the current set of destination scope addresses at cron-fire time,
 * e.g. one `resource:<projectId>` per active project. Receives the importer's
 * connection so per-connection routing can produce different destinations for
 * different connections of the same provider. Pair with a parameterized
 * `access` map (`{ 'resource:$projectId': 'owner' }`) so resolved scopes are writable.
 */
export type ImporterScopesResolver = (context: ImporterScopesContext) => readonly string[] | Promise<readonly string[]>;

export interface ImporterProviderContext {
  connection: ProjectConnection;
  /** Authenticated fetch through the platform proxy, bound to this connection. */
  request: (options: ImporterProxyRequest) => Promise<ImporterProxyResponse>;
  /** Target scope address(es) and role from host config. */
  access: ImporterAccess;
  /** Cron schedule from host config (provider default otherwise). */
  schedule: string;
  /** Dynamic destination scopes from host config; unioned with concrete `access` keys. */
  scopes?: ImporterScopesResolver;
}

/**
 * An importer provider registration. One entry per provider with a hand-written
 * `packages/connect/src/providers/<integrationId>/importer.ts` module. This list
 * is deliberately distinct from the generated `PROVIDERS` toolset registry:
 * tools are agent-facing, importers are deterministic cursor-based sync loops.
 *
 * `integrationId` is the Platform catalog id. `envVar` is the fallback
 * connection-id env var when no `connectionId` override is given. The
 * definition returned by `createImporter` gets its id overridden to
 * `connect:<integrationId>:<connectionId>` by the `importers()` resolver.
 */
export interface ImporterProviderRegistration {
  integrationId: string;
  envVar: string;
  defaultSchedule: string;
  createImporter: (ctx: ImporterProviderContext) => KnowledgeImporterDefinition;
}

/**
 * Providers with shipped knowledge importers, in alphabetical order by
 * integration id. Populated by the per-provider `importer.ts` modules via
 * `registerImporterProvider()` during module load (matches the `PROVIDERS`
 * barrel pattern in `providers/index.ts`).
 */
export const IMPORTERS: readonly ImporterProviderRegistration[] = [];

/** @internal Provider-module registration; not for host consumption. */
export function registerImporterProvider(registration: ImporterProviderRegistration): void {
  const list = IMPORTERS as ImporterProviderRegistration[];
  if (list.some(p => p.integrationId === registration.integrationId)) return;
  list.push(registration);
  list.sort((a, b) => a.integrationId.localeCompare(b.integrationId));
}

export function findImporterRegistration(integrationId: string): ImporterProviderRegistration | undefined {
  return IMPORTERS.find(p => p.integrationId === integrationId);
}
