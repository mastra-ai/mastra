import { isIP } from 'node:net';
import type { OperationalStore } from '../db/operational-store.js';
import { claimGeoIpCache, completeGeoIpCache, releaseGeoIpCacheLease } from '../db/geoip-cache-operations.js';
import type { GeoIpLookupResult, GeoIpProvider, GeoIpTransport } from './geoip-contracts.js';

export { GeoIpKnownSchema, GeoIpLookupResultSchema, GeoIpUnknownSchema } from './geoip-contracts.js';
export type { GeoIpLookupResult, GeoIpProvider, GeoIpTransport } from './geoip-contracts.js';

type CacheEntry = Readonly<{
  expiresAt: number;
  result: Extract<GeoIpLookupResult, { outcome: 'known' }>;
}>;

export class IpinfoLiteProvider implements GeoIpProvider {
  private readonly cache = new Map<string, CacheEntry>();
  constructor(
    private readonly options: Readonly<{
      token: string;
      /** Required whenever the durable cache is enabled; never persisted. */
      cacheHmacKey?: Uint8Array;
      /** Stable version persisted with entries written by this key. */
      cacheHmacKeyVersion?: string;
      previousCacheHmacKey?: Uint8Array;
      previousCacheHmacKeyVersion?: string;
      timeoutMs: number;
      cacheTtlMs?: number;
      retentionDays?: number;
      store?: OperationalStore;
      openStore?: () => OperationalStore;
      transport?: GeoIpTransport;
      now?: () => Date;
    }>,
  ) {}
  async lookup(
    input: Readonly<{
      tenantId?: string;
      ip: string;
      deadline: Date;
      signal?: AbortSignal;
    }>,
  ): Promise<GeoIpLookupResult> {
    const normalized = normalizeIp(input.ip);
    const local = localReason(normalized);
    if (local) return { outcome: 'unknown', reasonCode: local };
    if (input.signal?.aborted) return { outcome: 'unknown', reasonCode: 'timeout' };
    const now = (this.options.now ?? (() => new Date()))();
    // The process-local tier is only an optimisation; it must preserve the
    // same tenant boundary as the durable cache rather than leaking a result
    // from the first tenant that happened to ask for an IP.
    const cacheKey = input.tenantId ? `${input.tenantId}\u0000${normalized}` : normalized;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now.getTime()) return cached.result;
    const duration = Math.min(this.options.timeoutMs, input.deadline.getTime() - now.getTime());
    if (!Number.isFinite(duration) || duration <= 0) return { outcome: 'unknown', reasonCode: 'timeout' };
    const cacheStore = this.options.store ?? this.options.openStore?.();
    const ownsCacheStore = !this.options.store && Boolean(cacheStore);
    const cacheKeys = this.options.cacheHmacKey
      ? {
          current: {
            key: this.options.cacheHmacKey,
            version: this.options.cacheHmacKeyVersion ?? 'hmac-sha256-v1',
          },
          ...(this.options.previousCacheHmacKey && this.options.previousCacheHmacKeyVersion
            ? {
                previous: {
                  key: this.options.previousCacheHmacKey,
                  version: this.options.previousCacheHmacKeyVersion,
                },
              }
            : {}),
        }
      : undefined;
    // A caller that bypasses the integration factory must not quietly fall back to
    // the old unhashed durable key.  The local process cache is still safe
    // because it is never persisted and remains tenant-scoped.
    const useDurableCache = Boolean(cacheStore && input.tenantId && cacheKeys);
    let durableClaim: string | undefined;
    if (useDurableCache && cacheStore && input.tenantId && cacheKeys) {
      const durable = await claimGeoIpCache(cacheStore, {
        tenantId: input.tenantId,
        ip: normalized,
        keys: cacheKeys,
        now,
        leaseMs: Math.min(this.options.timeoutMs, Math.max(1, input.deadline.getTime() - now.getTime())),
      });
      if (durable.state === 'hit') {
        if (ownsCacheStore) cacheStore.close();
        return durable.result;
      }
      if (durable.state === 'busy') {
        if (ownsCacheStore) cacheStore.close();
        return { outcome: 'unknown', reasonCode: 'unavailable' };
      }
      durableClaim = durable.fenceToken;
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    input.signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), duration);
    try {
      const response = await (this.options.transport ?? defaultTransport)({
        url: `https://api.ipinfo.io/lite/${encodeURIComponent(normalized)}`,
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (response.status === 429) return { outcome: 'unknown', reasonCode: 'rate_limited' };
      if (response.status < 200 || response.status >= 300) return { outcome: 'unknown', reasonCode: 'unavailable' };
      const body = await response.json();
      if (isBogonResponse(body)) return { outcome: 'unknown', reasonCode: 'bogon' };
      const known = parseLiteResponse(body, now);
      if (!known) return { outcome: 'unknown', reasonCode: 'invalid_response' };
      if (useDurableCache && cacheStore && input.tenantId && durableClaim && cacheKeys) {
        const completed = await completeGeoIpCache(cacheStore, {
          tenantId: input.tenantId,
          ip: normalized,
          keys: cacheKeys,
          fenceToken: durableClaim,
          result: known,
          now,
          ttlMs: this.options.cacheTtlMs ?? 86_400_000,
          retentionDays: this.options.retentionDays ?? 30,
        });
        // A lost fence means another owner may now be authoritative. Never
        // expose or warm process-local evidence that was not durably
        // committed by this claim.
        if (!completed) {
          durableClaim = undefined;
          return { outcome: 'unknown', reasonCode: 'unavailable' };
        }
        durableClaim = undefined;
      }
      this.cache.set(cacheKey, {
        expiresAt: now.getTime() + (this.options.cacheTtlMs ?? 86_400_000),
        result: known,
      });
      return known;
    } catch {
      return {
        outcome: 'unknown',
        reasonCode: controller.signal.aborted ? 'timeout' : 'unavailable',
      };
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', onAbort);
      if (useDurableCache && cacheStore && input.tenantId && durableClaim && cacheKeys) {
        await releaseGeoIpCacheLease(cacheStore, {
          tenantId: input.tenantId,
          ip: normalized,
          keys: cacheKeys,
          fenceToken: durableClaim,
        });
      }
      if (ownsCacheStore) cacheStore?.close();
    }
  }
}

export class LocalGeoIpProvider implements GeoIpProvider {
  readonly calls: string[] = [];
  private readonly cache = new Map<string, CacheEntry>();
  constructor(
    private readonly results = new Map<string, GeoIpLookupResult>(),
    private readonly options: Readonly<{
      cacheTtlMs?: number;
      now?: () => Date;
    }> = {},
  ) {}
  async lookup(
    input: Readonly<{
      tenantId?: string;
      ip: string;
      deadline: Date;
      signal?: AbortSignal;
    }>,
  ): Promise<GeoIpLookupResult> {
    const normalized = normalizeIp(input.ip);
    const local = localReason(normalized);
    if (local) return { outcome: 'unknown', reasonCode: local };
    if (input.signal?.aborted || input.deadline.getTime() <= Date.now())
      return { outcome: 'unknown', reasonCode: 'timeout' };
    const now = (this.options.now ?? (() => new Date()))();
    const cacheKey = input.tenantId ? `${input.tenantId}\u0000${normalized}` : normalized;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now.getTime()) return cached.result;
    this.calls.push(normalized);
    const result = this.results.get(normalized) ?? {
      outcome: 'unknown' as const,
      reasonCode: 'disabled' as const,
    };
    if (result.outcome === 'known') {
      this.cache.set(cacheKey, {
        expiresAt: now.getTime() + (this.options.cacheTtlMs ?? 86_400_000),
        result,
      });
    }
    return result;
  }
}

function normalizeIp(value: string): string {
  const ip = value.trim().toLowerCase();
  if (!ip || /[\s/%]/u.test(ip) || isIP(ip) === 0) throw new Error('Invalid IP address.');
  return ip;
}
function localReason(ip: string): 'private' | 'bogon' | undefined {
  if (isIP(ip) === 4) return ipv4LocalReason(ip);
  if (ip === '::1' || /^f[cd][0-9a-f]*:/u.test(ip) || /^fe[89ab][0-9a-f]*:/u.test(ip)) return 'private';
  // Unspecified, IPv4-mapped, documentation and multicast IPv6 addresses
  // are not routable evidence. Do not send them to IPinfo even if a fake or
  // future provider happens to return a country for them.
  if (ip === '::' || /^ff[0-9a-f]*:/u.test(ip) || /^::ffff:/u.test(ip) || /^2001:0?db8:/u.test(ip)) return 'bogon';
  return undefined;
}

function ipv4LocalReason(ip: string): 'private' | 'bogon' | undefined {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part))) return 'bogon';
  const [a, b, c, d] = parts as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return 'private';
  if (a === 169 && b === 254) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  // IANA special-purpose/documentation ranges must never cross the provider
  // boundary. They are classified as bogon rather than treated as evidence.
  if (a === 100 && b >= 64 && b <= 127) return 'bogon';
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return 'bogon';
  if (a === 198 && (b === 18 || b === 19)) return 'bogon';
  if (a === 198 && b === 51 && c === 100) return 'bogon';
  if (a === 203 && b === 0 && c === 113) return 'bogon';
  if (a >= 224 || (a === 255 && b === 255 && c === 255 && d === 255)) return 'bogon';
  if (a === 192 && b === 0 && c === 0) return 'bogon';
  if (a === 192 && b === 88 && c === 99) return 'bogon';
  if (a === 192 && b === 31 && c === 196) return 'bogon';
  if (a === 192 && b === 52 && c === 193) return 'bogon';
  if (a === 192 && b === 175 && c === 48) return 'bogon';
  return undefined;
}
function parseLiteResponse(value: unknown, now: Date): Extract<GeoIpLookupResult, { outcome: 'known' }> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (row.bogon === true) return undefined;
  const countryCode =
    typeof row.country_code === 'string'
      ? row.country_code.toUpperCase()
      : typeof row.country === 'string'
        ? row.country.toUpperCase()
        : undefined;
  if (!countryCode || !/^[A-Z]{2}$/u.test(countryCode)) return undefined;
  const asn = typeof row.asn === 'string' && /^AS[0-9]+$/u.test(row.asn) ? row.asn : undefined;
  const providerName =
    typeof row.as_name === 'string' && row.as_name.trim()
      ? row.as_name.trim().slice(0, 256)
      : typeof row.as_domain === 'string' && row.as_domain.trim()
        ? row.as_domain.trim().slice(0, 256)
        : undefined;
  return {
    outcome: 'known',
    countryCode,
    ...(asn ? { asn } : {}),
    ...(providerName ? { providerName } : {}),
    observedAt: now.toISOString(),
    provider: 'ipinfo-lite',
    confidence: 0.7,
    confidenceProvenance: 'policy-v1',
  };
}

function isBogonResponse(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).bogon === true
  );
}
async function defaultTransport(
  input: Parameters<GeoIpTransport>[0],
): Promise<Readonly<{ status: number; json(): Promise<unknown> }>> {
  const response = await fetch(input.url, {
    headers: input.headers,
    signal: input.signal,
  });
  return { status: response.status, json: () => response.json() };
}
