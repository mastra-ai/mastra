import type { ProjectConnection } from './client.js';
import { MastraConnectError } from './errors.js';
import type { NamedConnection } from './multi-connection.js';
import { toNamedConnections } from './multi-connection.js';

/** Identifies one provider's connection-resolution inputs. */
export interface ConnectionRequest {
  integrationId: string;
  /** Fallback connection-id environment variable when more than one active connection exists. */
  envVar: string;
  /** Pinned connection id from per-integration options. */
  connectionId?: string;
}

const INTEGRATION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function validateIntegrationOverrides(integrations: Record<string, unknown> | undefined): void {
  for (const integrationId of Object.keys(integrations ?? {})) {
    if (!INTEGRATION_ID_PATTERN.test(integrationId)) {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid provider '${integrationId}' in integrations option: expected 1-128 letters, numbers, underscores, or hyphens.`,
      );
    }
  }
}

export function connectionIdEnvVar(integrationId: string): string {
  return `MASTRA_${integrationId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_CONNECTION_ID`;
}

export function groupByIntegrationId(connections: ProjectConnection[]): Map<string, ProjectConnection[]> {
  const byIntegrationId = new Map<string, ProjectConnection[]>();
  for (const connection of connections) {
    const list = byIntegrationId.get(connection.integrationId) ?? [];
    list.push(connection);
    byIntegrationId.set(connection.integrationId, list);
  }
  return byIntegrationId;
}

/**
 * Resolves the connection to use for one provider, per the contract:
 * option/env var wins; else a single active connection; anything else
 * (ambiguity, needs_reauth, no usable candidate) warns and skips so one bad
 * integration never takes down the whole resolution. A needs_reauth
 * connection is never silently mapped.
 */
export function resolveConnection(request: ConnectionRequest, candidates: ProjectConnection[]): string | undefined {
  const integrationId = request.integrationId;
  const directed = request.connectionId?.trim() || process.env[request.envVar]?.trim() || undefined;
  if (directed) {
    const match = candidates.find(connection => connection.id === directed);
    if (!match) {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: pinned connection ${directed} is not attached to this project.`,
      );
      return undefined;
    }
    if (match.status === 'needs_reauth') {
      console.warn(`[@mastra/connect] Skipping ${integrationId}: connection ${directed} needs re-auth.`);
      return undefined;
    }
    if (match.status !== 'active') {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: connection ${directed} is not active (status '${match.status}').`,
      );
      return undefined;
    }
    return directed;
  }

  const active = candidates.filter(connection => connection.status === 'active');
  if (active.length === 1) return active[0]!.id;
  if (active.length === 0) {
    console.warn(
      `[@mastra/connect] Skipping ${integrationId}: no active connections (found ${candidates.length} in other states).`,
    );
    return undefined;
  }
  console.warn(
    `[@mastra/connect] Skipping ${integrationId}: ${active.length} active connections; pin one with connectionId or ${request.envVar}.`,
  );
  return undefined;
}

/**
 * Discriminated resolution of one provider request against its candidate
 * connections. `single` maps to unwrapped tools with the connection id baked
 * in; `multi` triggers connection_name wrapping so the agent picks a
 * connection per call. `skip` means warn-and-continue.
 */
export type ProviderResolution =
  | { kind: 'single'; connectionId: string }
  | { kind: 'multi'; connections: NamedConnection[] }
  | { kind: 'skip' };

/**
 * Resolves how to configure one provider given its candidate connections:
 *   - An explicit pin (option or env var) forces `single` at that id.
 *   - Exactly one active connection → `single`.
 *   - Two or more active connections → `multi`; the caller wraps tools with
 *     `connection_name` so the agent chooses per call at execute time.
 *   - No active candidate at all → `skip` with a warning.
 * A `needs_reauth` connection is never silently mapped.
 */
export function resolveProviderConnection(
  request: ConnectionRequest,
  candidates: ProjectConnection[],
): ProviderResolution {
  const integrationId = request.integrationId;
  const directed = request.connectionId?.trim() || process.env[request.envVar]?.trim() || undefined;
  if (directed) {
    const match = candidates.find(connection => connection.id === directed);
    if (!match) {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: pinned connection ${directed} is not attached to this project.`,
      );
      return { kind: 'skip' };
    }
    if (match.status === 'needs_reauth') {
      console.warn(`[@mastra/connect] Skipping ${integrationId}: connection ${directed} needs re-auth.`);
      return { kind: 'skip' };
    }
    if (match.status !== 'active') {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: connection ${directed} is not active (status '${match.status}').`,
      );
      return { kind: 'skip' };
    }
    return { kind: 'single', connectionId: directed };
  }

  const active = candidates.filter(connection => connection.status === 'active');
  if (active.length === 1) return { kind: 'single', connectionId: active[0]!.id };
  if (active.length === 0) {
    console.warn(
      `[@mastra/connect] Skipping ${integrationId}: no active connections (found ${candidates.length} in other states).`,
    );
    return { kind: 'skip' };
  }
  // Multiple active connections: expose all of them through the wrapped
  // toolset so the agent disambiguates per call via `connection_name`.
  return { kind: 'multi', connections: toNamedConnections(active) };
}
