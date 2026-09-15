/**
 * Custom provider source seam for deployed (multi-user) servers.
 *
 * Locally, custom providers are read from the file-backed settings
 * (settings.json). A deployed web host registers a {@link CustomProvidersSource}
 * at boot; from then on model resolution and the gateway catalog read custom
 * providers through the source — DB-backed and tenant-scoped — and never touch
 * settings.json.
 *
 * When no source is registered (TUI, local web), everything falls through to
 * the existing settings-based behavior unchanged.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { CredentialTenant } from './credential-resolver.js';
import { resolveTenantFromRequestContext } from './credential-resolver.js';
import type { MastraCodeCustomProvider } from './mastracode-gateway.js';

/**
 * Returns the custom providers visible to the given tenant. `tenant` is
 * `undefined` for calls without an authenticated request (boot-time catalog,
 * local/no-auth mode) — implementations decide what that means (e.g. the
 * local sentinel org, or an empty list in tenant mode). Must be synchronous —
 * implementations serve from a primed snapshot.
 */
export type CustomProvidersSource = (tenant: CredentialTenant | undefined) => MastraCodeCustomProvider[];

let customProvidersSource: CustomProvidersSource | undefined;

/** Register (or clear) the custom providers source. Deployed-web only. */
export function setCustomProvidersSource(source: CustomProvidersSource | undefined): void {
  customProvidersSource = source;
}

/** Whether a custom providers source is registered. */
export function hasCustomProvidersSource(): boolean {
  return customProvidersSource !== undefined;
}

/**
 * Resolve custom providers for a request. Returns `undefined` when no source
 * is registered — callers fall back to settings.json. Once a source is
 * registered it is authoritative: its result (possibly empty) is used and
 * settings.json is never consulted.
 */
export function resolveCustomProviders(requestContext?: RequestContext): MastraCodeCustomProvider[] | undefined {
  if (!customProvidersSource) return undefined;
  return customProvidersSource(resolveTenantFromRequestContext(requestContext));
}
