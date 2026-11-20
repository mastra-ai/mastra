import { createHmac, randomUUID } from 'node:crypto';

import type { OperationalStore } from './operational-store.js';
import { GeoIpKnownSchema, type GeoIpLookupResult } from '../providers/geoip-contracts.js';

// v1 was an unsalted SHA-256 of the IP address.  It is deliberately never
// read: an attacker who obtains the database must not be able to test guessed
// addresses offline.  The key version is independent from the evidence policy
// and lets us do a bounded, read-through HMAC rotation.
const policyVersion = 2;
export type GeoIpCacheKeyring = Readonly<{
  current: Readonly<{ key: Uint8Array; version: string }>;
  previous?: Readonly<{ key: Uint8Array; version: string }>;
}>;

export type GeoIpCacheRead =
  | Readonly<{
      state: 'hit';
      result: Extract<GeoIpLookupResult, { outcome: 'known' }>;
    }>
  | Readonly<{ state: 'claimed'; fenceToken: string }>
  | Readonly<{ state: 'busy' }>;

/** A tenant-scoped positive cache with a short, durable refresh lease. */
export async function claimGeoIpCache(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    ip: string;
    keys: GeoIpCacheKeyring;
    now: Date;
    leaseMs: number;
  }>,
): Promise<GeoIpCacheRead> {
  const currentHash = hashIp(input.tenantId, input.ip, input.keys.current.key);
  const previousHash = input.keys.previous ? hashIp(input.tenantId, input.ip, input.keys.previous.key) : undefined;
  const now = input.now.toISOString();
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs).toISOString();
  const fenceToken = `geoip:${randomUUID()}`;
  return store.transaction(async tx => {
    await tx.execute({
      sql: 'DELETE FROM geoip_cache_entries WHERE purge_after <= ?',
      args: [now],
    });
    // Deprecated SHA-256 rows are security debt, not a valid rotation key.
    await tx.execute({
      sql: 'DELETE FROM geoip_cache_entries WHERE policy_version <> ?',
      args: [policyVersion],
    });
    await tx.execute({
      sql: 'DELETE FROM geoip_cache_leases WHERE lease_expires_at <= ?',
      args: [now],
    });
    const cached = await tx.execute({
      sql: `SELECT result_json FROM geoip_cache_entries
        WHERE tenant_id = ? AND policy_version = ? AND key_version = ?
          AND ip_hash = ? AND expires_at > ?`,
      args: [input.tenantId, policyVersion, input.keys.current.version, currentHash, now],
    });
    if (cached.rows[0]?.result_json) {
      try {
        return {
          state: 'hit' as const,
          result: GeoIpKnownSchema.parse(JSON.parse(String(cached.rows[0].result_json))),
        };
      } catch {
        // Corrupt data is not evidence. Drop it and take a new leased lookup.
        await tx.execute({
          sql: `DELETE FROM geoip_cache_entries
            WHERE tenant_id = ? AND policy_version = ? AND key_version = ? AND ip_hash = ?`,
          args: [input.tenantId, policyVersion, input.keys.current.version, currentHash],
        });
      }
    }
    const previousKey = input.keys.previous;
    if (previousHash && previousKey) {
      const previous = await tx.execute({
        sql: `SELECT result_json, observed_at, expires_at, purge_after
          FROM geoip_cache_entries WHERE tenant_id = ? AND policy_version = ?
            AND key_version = ? AND ip_hash = ? AND expires_at > ?`,
        args: [input.tenantId, policyVersion, previousKey.version, previousHash, now],
      });
      if (previous.rows[0]?.result_json) {
        try {
          const result = GeoIpKnownSchema.parse(JSON.parse(String(previous.rows[0].result_json)));
          // Rotate inside the same transaction: a hit is returned only after
          // the current-key row is durable and the previous keyed handle is
          // gone.  TTL, policy and retention are copied verbatim, so rotation
          // cannot extend evidence lifetime.
          await tx.execute({
            sql: `INSERT OR REPLACE INTO geoip_cache_entries(
              tenant_id, policy_version, key_version, ip_hash, result_json,
              observed_at, expires_at, purge_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              input.tenantId,
              policyVersion,
              input.keys.current.version,
              currentHash,
              String(previous.rows[0].result_json),
              String(previous.rows[0].observed_at),
              String(previous.rows[0].expires_at),
              String(previous.rows[0].purge_after),
            ],
          });
          await tx.execute({
            sql: `DELETE FROM geoip_cache_entries WHERE tenant_id = ?
              AND policy_version = ? AND key_version = ? AND ip_hash = ?`,
            args: [input.tenantId, policyVersion, previousKey.version, previousHash],
          });
          return { state: 'hit' as const, result };
        } catch {
          await tx.execute({
            sql: `DELETE FROM geoip_cache_entries WHERE tenant_id = ?
              AND policy_version = ? AND key_version = ? AND ip_hash = ?`,
            args: [input.tenantId, policyVersion, previousKey.version, previousHash],
          });
        }
      }
    }
    const claimed = await tx.execute({
      sql: `INSERT INTO geoip_cache_leases(
        tenant_id, policy_version, key_version, ip_hash, fence_token, lease_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      args: [input.tenantId, policyVersion, input.keys.current.version, currentHash, fenceToken, leaseExpiresAt],
    });
    return claimed.rowsAffected === 1 ? { state: 'claimed' as const, fenceToken } : { state: 'busy' as const };
  });
}

export async function completeGeoIpCache(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    ip: string;
    keys: GeoIpCacheKeyring;
    fenceToken: string;
    result: Extract<GeoIpLookupResult, { outcome: 'known' }>;
    now: Date;
    ttlMs: number;
    retentionDays: number;
  }>,
): Promise<boolean> {
  const ipHash = hashIp(input.tenantId, input.ip, input.keys.current.key);
  const observedAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + input.ttlMs).toISOString();
  const purgeAfter = new Date(input.now.getTime() + input.retentionDays * 86_400_000).toISOString();
  return store.transaction(async tx => {
    const lease = await tx.execute({
      sql: `DELETE FROM geoip_cache_leases
        WHERE tenant_id = ? AND policy_version = ? AND key_version = ?
          AND ip_hash = ? AND fence_token = ?`,
      args: [input.tenantId, policyVersion, input.keys.current.version, ipHash, input.fenceToken],
    });
    if (lease.rowsAffected !== 1) return false;
    await tx.execute({
      sql: `INSERT INTO geoip_cache_entries(
        tenant_id, policy_version, key_version, ip_hash, result_json, observed_at, expires_at, purge_after
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, policy_version, key_version, ip_hash) DO UPDATE SET
        result_json = excluded.result_json, observed_at = excluded.observed_at,
        expires_at = excluded.expires_at, purge_after = excluded.purge_after`,
      args: [
        input.tenantId,
        policyVersion,
        input.keys.current.version,
        ipHash,
        JSON.stringify(input.result),
        observedAt,
        expiresAt,
        purgeAfter,
      ],
    });
    return true;
  });
}

export async function releaseGeoIpCacheLease(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    ip: string;
    keys: GeoIpCacheKeyring;
    fenceToken: string;
  }>,
): Promise<void> {
  await store.execute({
    sql: `DELETE FROM geoip_cache_leases
      WHERE tenant_id = ? AND policy_version = ? AND key_version = ?
        AND ip_hash = ? AND fence_token = ?`,
    args: [
      input.tenantId,
      policyVersion,
      input.keys.current.version,
      hashIp(input.tenantId, input.ip, input.keys.current.key),
      input.fenceToken,
    ],
  });
}

/** Bounded retention sweep for the runtime's periodic maintenance loop. */
export async function purgeExpiredGeoIpCache(store: OperationalStore, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await store.transaction(async tx => {
    await tx.execute({
      sql: 'DELETE FROM geoip_cache_entries WHERE purge_after <= ?',
      args: [timestamp],
    });
    await tx.execute({
      sql: 'DELETE FROM geoip_cache_entries WHERE policy_version <> ?',
      args: [policyVersion],
    });
    await tx.execute({
      sql: 'DELETE FROM geoip_cache_leases WHERE lease_expires_at <= ?',
      args: [timestamp],
    });
  });
}

function hashIp(tenantId: string, ip: string, key: Uint8Array): string {
  return createHmac('sha256', key)
    .update('geoip-cache\u0000hmac-sha256\u0000', 'utf8')
    .update(tenantId, 'utf8')
    .update('\u0000', 'utf8')
    .update(ip, 'utf8')
    .digest('hex');
}
