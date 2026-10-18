import { readPositiveIntEnv } from '../utils';

/**
 * TTL for the cross-process leases that mark a live process driving an agent
 * thread or durable run. Kept short so a crashed owner frees the run quickly;
 * owners renew while they work. Overridable via
 * `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (production keeps the 15s default).
 */
export const AGENT_LEASE_TTL_MS = readPositiveIntEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', 15_000);

const DEFAULT_RENEW_INTERVAL_MS = Math.max(1, Math.floor(AGENT_LEASE_TTL_MS / 3));
const configuredRenewIntervalMs = readPositiveIntEnv(
  'MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS',
  DEFAULT_RENEW_INTERVAL_MS,
);

/**
 * Interval at which an owner renews its lease. Defaults to TTL/3, leaving room
 * for two missed renewals (network blip, GC pause) before the lease expires.
 * Overridable via `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS`; a value not
 * shorter than the TTL would let the lease expire before its first renewal, so
 * it falls back to the default.
 */
export const AGENT_LEASE_RENEW_INTERVAL_MS =
  configuredRenewIntervalMs < AGENT_LEASE_TTL_MS ? configuredRenewIntervalMs : DEFAULT_RENEW_INTERVAL_MS;
