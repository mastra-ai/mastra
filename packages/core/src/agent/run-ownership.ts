import { readPositiveIntEnv } from '../utils';

/**
 * Lease TTL shared by the agent's cross-process run leases (thread leases and plain-Agent resume
 * claims). Kept short so a crashed owner process frees the run quickly; a background timer renews
 * it while the run is still running. Overridable via `MASTRA_AGENT_THREAD_LEASE_TTL_MS`
 * (production keeps the 15s default).
 */
export const AGENT_LEASE_TTL_MS = readPositiveIntEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', 15_000);

/**
 * Interval at which the owner process renews its lease. Defaults to TTL/3, leaving room for two
 * missed renewals (network blip, GC pause) before the lease expires. Overridable via
 * `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS`.
 */
export const AGENT_LEASE_RENEW_INTERVAL_MS = readPositiveIntEnv(
  'MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS',
  Math.floor(AGENT_LEASE_TTL_MS / 3),
);

/** Lease owner token: `<holderId>/<runId>`, where `holderId` identifies the holding process. */
export function formatLeaseOwner(holderId: string, runId: string): string {
  return `${holderId}/${runId}`;
}
