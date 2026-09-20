import type { KnowledgeImporterDefinition } from '@mastra/core/knowledge';

import type { ProjectConnection, ProxyRequestOptions } from './client.js';

/** Provider-relative request sent through the platform connection proxy. */
export type ImporterProxyRequest = ProxyRequestOptions;
/** Parsed JSON body (or raw text / null) returned by the provider through the proxy. */
export type ImporterProxyResponse = unknown;

/** Scope-address → role map importers are granted by the host. */
export type ImporterAccess = Readonly<Record<string, 'owner' | 'edit'>>;

export interface ImporterProviderContext {
  connection: ProjectConnection;
  /** Authenticated fetch through the platform proxy, bound to this connection. */
  request: (options: ImporterProxyRequest) => Promise<ImporterProxyResponse>;
  /** Target scope address(es) and role from host config. */
  access: ImporterAccess;
  /** Cron schedule from host config (provider default otherwise). */
  schedule: string;
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

/** Providers with shipped knowledge importers. Filled by the per-provider importer modules. */
export const IMPORTERS: readonly ImporterProviderRegistration[] = [];

export function findImporterRegistration(integrationId: string): ImporterProviderRegistration | undefined {
  return IMPORTERS.find(p => p.integrationId === integrationId);
}
