import { readPositiveIntEnv } from '../utils';

/**
 * TTL for the cross-process leases that mark a live process driving an agent
 * thread or durable run. Kept short so a crashed owner frees the run quickly;
 * owners renew while they work. Overridable via
 * `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (production keeps the 15s default).
 */
export const AGENT_LEASE_TTL_MS = readPositiveIntEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', 15_000);

/**
 * Interval at which an owner renews its lease. Defaults to TTL/3, leaving room
 * for two missed renewals (network blip, GC pause) before the lease expires.
 * Overridable via `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS`.
 */
export const AGENT_LEASE_RENEW_INTERVAL_MS = readPositiveIntEnv(
  'MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS',
  Math.floor(AGENT_LEASE_TTL_MS / 3),
);
