import { z } from 'zod';
import type { Scan } from './contracts.js';

/** Bounded RFC 6901 location of an account identifier, never its value. */
export const principalJsonPointerSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    value =>
      value.startsWith('/') &&
      value.split('/').length <= 9 &&
      !/[\u0000-\u001f\u007f]/.test(value) &&
      !/~(?![01])/.test(value),
    'Use a JSON pointer with at most eight segments.',
  );

/** Read only a bounded scalar from the trusted private JSON response. */
export function privatePrincipal(body: unknown, pointer: string | undefined): string | null {
  if (!pointer || !principalJsonPointerSchema.safeParse(pointer).success) return null;
  let value: unknown = body;
  for (const encoded of pointer.slice(1).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return null;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

export type PrincipalComparison = 'SAME' | 'DISTINCT' | 'UNKNOWN';

/** A profile name, key difference or collection difference is not identity evidence. */
export function scanPrincipalComparison(scan: Scan, profileIds: readonly string[]): PrincipalComparison {
  if (profileIds.length !== 2 || profileIds[0] === profileIds[1]) return 'UNKNOWN';
  const roles = profileIds.map(id => scan.roles.filter(role => role.profileId === id));
  if (roles.some(items => items.length !== 1 || items[0]!.source !== 'rest-json' || items[0]!.identity !== 'READY'))
    return 'UNKNOWN';
  const comparisons = roles.flatMap(items =>
    (items[0]!.principalComparisons ?? []).filter(
      item => profileIds.includes(item.profileId) && item.profileId !== items[0]!.profileId,
    ),
  );
  return comparisons.length === 1 ? comparisons[0]!.result : 'UNKNOWN';
}
