import { afterEach, describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';

import { migrateOperationalStore } from '../../src/db/migrate.js';
import { claimGeoIpCache, purgeExpiredGeoIpCache } from '../../src/db/geoip-cache-operations.js';
import { EvidenceProviderResultSchema } from '../../src/evidence/contracts.js';
import { persistEvidenceItems } from '../../src/evidence/persistence.js';
import { GeoIpIdentityEvidenceProvider } from '../../src/providers/geoip-evidence-provider.js';
import { IpinfoLiteProvider } from '../../src/providers/geoip-provider.js';
import { resolveTrustedFact } from '../../src/triage/policy.js';
import { seedInvestigationInvestigation } from '../fixtures/evidence.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('integration durable GeoIP cache', () => {
  const cacheHmacKey = new Uint8Array(32).fill(7);
  it('preserves no-IP WorkOS fact provenance through wrapper, persistence, and policy', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const { context } = await seedInvestigationInvestigation(store);
    const base = {
      status: 'success' as const,
      provider: 'workos-identity',
      facts: [
        {
          semanticKey: 'previous-role',
          observedAt: context.occurredAt,
          factType: 'role.previous',
          value: 'member',
          confidence: 1,
          confidenceProvenance: 'provider' as const,
          rawPayloadRef: 'protected:workos:previous-role',
          sensitivity: 'confidential' as const,
          incomplete: false,
        },
      ],
    };
    const provider = new GeoIpIdentityEvidenceProvider({
      base: {
        source: 'identity',
        providerId: 'workos-identity',
        inspect: async () => base,
      },
      geoip: {
        lookup: async () => {
          throw new Error('GeoIP lookup must not run without an IP.');
        },
      },
      timeoutMs: 20,
    });

    const result = EvidenceProviderResultSchema.parse(
      await provider.inspect(
        {
          tenantId: context.tenantId,
          incidentId: context.incidentId,
          subjectId: context.subjectId,
          workflowRunId: context.workflowRunId,
          incidentKind: context.incidentKind,
          occurredAt: context.occurredAt,
        },
        { signal: new AbortController().signal, attempt: 1 },
      ),
    );
    expect(result).toEqual({
      ...base,
      provider: 'identity-geoip',
      facts: [{ ...base.facts[0], provider: 'workos-identity' }],
    });
    if (result.status !== 'success') throw new Error('fixture failed');

    const persisted = await persistEvidenceItems(store, {
      context,
      source: provider.source,
      provider: result.provider,
      facts: result.facts,
    });
    expect(persisted[0]).toMatchObject({
      source: 'identity',
      provider: 'workos-identity',
      fact: { confidenceProvenance: 'provider' },
    });
    expect(resolveTrustedFact(context, persisted, 'role.previous')).toEqual(persisted[0]);
    store.close();
  });

  it('preserves a base failure while keeping the wrapper provider contract', async () => {
    const base = {
      status: 'unavailable' as const,
      provider: 'workos-identity',
      error: {
        code: 'UNAVAILABLE' as const,
        retryable: true as const,
        safeRef: 'provider:workos-identity:attempt-1',
        attempt: 1,
      },
    };
    const provider = new GeoIpIdentityEvidenceProvider({
      base: {
        source: 'identity',
        providerId: 'workos-identity',
        inspect: async () => base,
      },
      geoip: {
        lookup: async () => ({
          outcome: 'unknown' as const,
          reasonCode: 'bogon',
        }),
      },
      timeoutMs: 20,
    });
    await expect(
      provider.inspect(
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          subjectId: 'subject-1',
          workflowRunId: 'workflow-run-1',
          incidentKind: 'unknown_device_login',
          occurredAt: '2026-08-29T00:00:00.000Z',
          ip: '235.167.17.62',
        },
        { signal: new AbortController().signal, attempt: 1 },
      ),
    ).resolves.toEqual({ ...base, provider: 'identity-geoip' });
  });

  it('persists WorkOS and GeoIP facts with separate origins when the lookup is known', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const { context } = await seedInvestigationInvestigation(store, 'disallowed_country_login');
    const provider = new GeoIpIdentityEvidenceProvider({
      base: {
        source: 'identity',
        providerId: 'workos-identity',
        inspect: async () => ({
          status: 'success' as const,
          provider: 'workos-identity',
          facts: [
            {
              semanticKey: 'session-subject',
              observedAt: context.occurredAt,
              factType: 'session.subject',
              value: context.subjectId,
              confidence: 1,
              confidenceProvenance: 'provider' as const,
              rawPayloadRef: 'protected:workos:session',
              sensitivity: 'confidential' as const,
              incomplete: false,
            },
          ],
        }),
      },
      geoip: {
        lookup: async () => ({
          outcome: 'known' as const,
          countryCode: 'BR',
          provider: 'ipinfo-lite' as const,
          confidence: 0.7 as const,
          confidenceProvenance: 'policy-v1' as const,
          observedAt: context.occurredAt,
        }),
      },
      timeoutMs: 20,
    });
    const result = EvidenceProviderResultSchema.parse(
      await provider.inspect(context, {
        signal: new AbortController().signal,
        attempt: 1,
      }),
    );
    if (result.status !== 'success') throw new Error('fixture failed');
    const evidence = await persistEvidenceItems(store, {
      context,
      source: 'identity',
      provider: result.provider,
      facts: result.facts,
    });
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'workos-identity',
          fact: expect.objectContaining({ factType: 'session.subject' }),
        }),
        expect.objectContaining({
          provider: 'identity-geoip',
          fact: expect.objectContaining({ factType: 'login.country' }),
        }),
      ]),
    );
    expect(evidence.find(item => item.fact.factType === 'session.subject')).toEqual(
      expect.objectContaining({ provider: 'workos-identity' }),
    );
    store.close();
  });

  it('survives a provider restart and stores only a hashed, expiring projection', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    let calls = 0;
    const now = new Date('2026-08-29T00:00:00.000Z');
    const first = new IpinfoLiteProvider({
      token: 'test-token',
      cacheHmacKey,
      timeoutMs: 1_500,
      store,
      now: () => now,
      transport: async () => {
        calls += 1;
        return { status: 200, json: async () => ({ country_code: 'BR' }) };
      },
    });
    await expect(
      first.lookup({
        tenantId: 'tenant-1',
        ip: '8.8.8.8',
        deadline: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toMatchObject({ outcome: 'known', countryCode: 'BR' });
    const second = new IpinfoLiteProvider({
      token: 'test-token',
      cacheHmacKey,
      timeoutMs: 1_500,
      store,
      now: () => now,
      transport: async () => {
        calls += 1;
        throw new Error('must use durable cache');
      },
    });
    await expect(
      second.lookup({
        tenantId: 'tenant-1',
        ip: '8.8.8.8',
        deadline: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toMatchObject({ outcome: 'known', countryCode: 'BR' });
    expect(calls).toBe(1);
    const row = await store.execute({
      sql: 'SELECT ip_hash, result_json, expires_at, purge_after FROM geoip_cache_entries',
    });
    expect(String(row.rows[0]?.ip_hash)).toHaveLength(64);
    expect(JSON.stringify(row.rows[0])).not.toContain('8.8.8.8');
    expect(String(row.rows[0]?.purge_after)).toBe('2026-09-28T00:00:00.000Z');
    store.close();
  });

  it('does not return or locally cache evidence after the durable fence is lost', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const now = new Date('2026-08-29T00:00:00.000Z');
    let calls = 0;
    const provider = new IpinfoLiteProvider({
      token: 'test-token',
      cacheHmacKey,
      timeoutMs: 1_500,
      store,
      now: () => now,
      transport: async () => {
        calls += 1;
        if (calls === 1) await store.execute({ sql: 'DELETE FROM geoip_cache_leases' });
        return { status: 200, json: async () => ({ country_code: 'BR' }) };
      },
    });
    await expect(
      provider.lookup({
        tenantId: 'tenant-1',
        ip: '8.8.8.8',
        deadline: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'unavailable' });
    await expect(store.execute({ sql: 'SELECT * FROM geoip_cache_entries' })).resolves.toMatchObject({ rows: [] });
    await expect(
      provider.lookup({
        tenantId: 'tenant-1',
        ip: '8.8.8.8',
        deadline: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toMatchObject({ outcome: 'known', countryCode: 'BR' });
    expect(calls).toBe(2);
    store.close();
  });

  it('isolates the local tier by tenant and purges retained rows without a lookup', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    let calls = 0;
    const now = new Date('2026-08-29T00:00:00.000Z');
    const provider = new IpinfoLiteProvider({
      token: 'test-token',
      cacheHmacKey,
      timeoutMs: 1_500,
      store,
      now: () => now,
      transport: async () => {
        calls += 1;
        return { status: 200, json: async () => ({ country_code: 'BR' }) };
      },
    });
    for (const tenantId of ['tenant-a', 'tenant-b']) {
      await provider.lookup({
        tenantId,
        ip: '8.8.8.8',
        deadline: new Date(now.getTime() + 1_000),
      });
    }
    expect(calls).toBe(2);
    const persisted = await store.execute({
      sql: 'SELECT tenant_id, key_version, ip_hash FROM geoip_cache_entries ORDER BY tenant_id',
    });
    expect(persisted.rows).toHaveLength(2);
    expect(persisted.rows.map(row => row.key_version)).toEqual(['hmac-sha256-v1', 'hmac-sha256-v1']);
    expect(persisted.rows[0]?.ip_hash).not.toBe(createHash('sha256').update('8.8.8.8').digest('hex'));
    expect(persisted.rows[0]?.ip_hash).not.toBe(persisted.rows[1]?.ip_hash);
    await purgeExpiredGeoIpCache(store, new Date('2026-09-29T00:00:00.000Z'));
    await expect(store.execute({ sql: 'SELECT * FROM geoip_cache_entries' })).resolves.toMatchObject({ rows: [] });
    store.close();
  });

  it('rotates A(v1) to B(v2) atomically, preserves TTL, and reads B directly', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const now = new Date('2026-08-29T00:00:00.000Z');
    const previous = new Uint8Array(32).fill(3);
    const current = new Uint8Array(32).fill(9);
    const hash = (tenantId: string, ip: string, key: Uint8Array) =>
      createHmac('sha256', key)
        .update('geoip-cache\u0000hmac-sha256\u0000', 'utf8')
        .update(tenantId, 'utf8')
        .update('\u0000', 'utf8')
        .update(ip, 'utf8')
        .digest('hex');
    let calls = 0;
    const first = new IpinfoLiteProvider({
      token: 'test-token',
      cacheHmacKey: previous,
      cacheHmacKeyVersion: 'hmac-sha256-v1',
      timeoutMs: 1_500,
      store,
      now: () => now,
      transport: async () => {
        calls += 1;
        return { status: 200, json: async () => ({ country_code: 'BR' }) };
      },
    });
    await first.lookup({
      tenantId: 'tenant-a',
      ip: '8.8.8.8',
      deadline: new Date(now.getTime() + 1_000),
    });
    const rotating = new IpinfoLiteProvider({
      token: 'test-token',
      cacheHmacKey: current,
      cacheHmacKeyVersion: 'hmac-sha256-v2',
      previousCacheHmacKey: previous,
      previousCacheHmacKeyVersion: 'hmac-sha256-v1',
      timeoutMs: 1_500,
      store,
      now: () => now,
      transport: async () => {
        throw new Error('rotation must use the prior durable hit');
      },
    });
    await expect(
      rotating.lookup({
        tenantId: 'tenant-a',
        ip: '8.8.8.8',
        deadline: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toMatchObject({ outcome: 'known', countryCode: 'BR' });
    expect(calls).toBe(1);
    await expect(
      store.execute({
        sql: `SELECT key_version, ip_hash, expires_at, purge_after
          FROM geoip_cache_entries ORDER BY key_version`,
      }),
    ).resolves.toMatchObject({
      rows: [
        {
          key_version: 'hmac-sha256-v2',
          ip_hash: hash('tenant-a', '8.8.8.8', current),
          expires_at: '2026-08-30T00:00:00.000Z',
          purge_after: '2026-09-28T00:00:00.000Z',
        },
      ],
    });
    // The prior HMAC is tenant-bound; it cannot warm a different tenant.
    await expect(
      claimGeoIpCache(store, {
        tenantId: 'tenant-b',
        ip: '8.8.8.8',
        keys: {
          current: { key: current, version: 'hmac-sha256-v2' },
          previous: { key: previous, version: 'hmac-sha256-v1' },
        },
        now,
        leaseMs: 1_000,
      }),
    ).resolves.toMatchObject({ state: 'claimed' });
    // A fresh caller with only B reads the rekeyed current entry; no fallback
    // to A and no provider lookup is needed on the second lookup.
    await expect(
      claimGeoIpCache(store, {
        tenantId: 'tenant-a',
        ip: '8.8.8.8',
        keys: { current: { key: current, version: 'hmac-sha256-v2' } },
        now,
        leaseMs: 1_000,
      }),
    ).resolves.toMatchObject({ state: 'hit', result: { countryCode: 'BR' } });
    await purgeExpiredGeoIpCache(store, new Date('2026-09-30T00:00:00.000Z'));
    await expect(store.execute({ sql: 'SELECT * FROM geoip_cache_entries' })).resolves.toMatchObject({ rows: [] });
    store.close();
  });
});
