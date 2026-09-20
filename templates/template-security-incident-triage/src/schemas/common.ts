import { z } from 'zod';

export const schemaVersion = z.literal(1);
export const opaqueId = z.string().trim().min(1).max(128);
/**
 * Tenant identities are opaque, byte-exact identifiers. Their length is
 * counted in Unicode code points, matching SQLite's `length(TEXT)` semantics;
 * accepted identities are never trimmed or normalized.
 */
export const maxTenantIdCodePoints = 128;

export type CanonicalTenantPolicy = Readonly<{
  maxCodePoints: number;
}>;

/** Values are consumed by every tenant boundary; identity itself is untouched. */
export const canonicalTenantPolicy: CanonicalTenantPolicy = Object.freeze({
  maxCodePoints: maxTenantIdCodePoints,
});

export function isCanonicalTenantId(
  value: unknown,
  policy: CanonicalTenantPolicy = canonicalTenantPolicy,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value &&
    Array.from(value).length <= policy.maxCodePoints
  );
}

export const tenantIdSchema = z.string().refine(isCanonicalTenantId, 'tenant identity must be canonical and bounded');
export const shortText = z.string().trim().min(1).max(256);
export const longText = z.string().trim().min(1).max(4_096);
export const utcTimestamp = z.iso.datetime({
  offset: false,
  precision: 3,
});
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
export const evidenceReference = z.string().regex(/^\[evidence:[^\]\s]{1,128}\]$/u);
export const runbookReference = z.string().regex(/^\[runbook:[^\]@\s]{1,128}@[0-9]+\.[0-9]+\.[0-9]+\]$/u);
export const reference = z.union([evidenceReference, runbookReference]);

const jsonPrimitive = z.union([z.string().max(2_048), z.number().finite(), z.boolean(), z.null()]);

export const boundedJsonObject = z
  .record(z.string().min(1).max(64), jsonPrimitive)
  .refine(value => Object.keys(value).length <= 32, 'too many keys');

export const actorSchema = z
  .object({
    id: opaqueId,
    type: z.enum(['user', 'service', 'system', 'unknown']),
    displayName: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const targetSchema = z
  .object({
    id: opaqueId,
    type: z.enum(['user', 'session', 'membership', 'device', 'role', 'resource']),
  })
  .strict();
