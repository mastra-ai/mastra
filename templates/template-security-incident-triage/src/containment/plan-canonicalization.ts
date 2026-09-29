import { createHash } from 'node:crypto';

import { DomainError } from '../domain/errors.js';
import type { ContainmentPlan } from '../schemas/containment.js';

export function canonicalizePlanValue(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function canonicalPlanBytes(plan: Record<string, unknown>): Uint8Array {
  const unsigned = { ...plan };
  delete unsigned.planHash;
  return new TextEncoder().encode(canonicalizePlanValue(unsigned));
}

export function calculatePlanHash(plan: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalPlanBytes(plan)).digest('hex');
}

export function verifyPlanHash(plan: ContainmentPlan): boolean {
  return calculatePlanHash(plan as unknown as Record<string, unknown>) === plan.planHash;
}

export function isPlanExpired(plan: Pick<ContainmentPlan, 'expiresAt'>, now: string): boolean {
  const current = Date.parse(now);
  const expiry = Date.parse(plan.expiresAt);
  if (!Number.isFinite(current) || !Number.isFinite(expiry)) throw new DomainError('VALIDATION_FAILED');
  return current >= expiry;
}

function normalize(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key?.endsWith('At')) {
      const parsed = Date.parse(value);
      if (!Number.isFinite(parsed)) throw new DomainError('VALIDATION_FAILED');
      return new Date(parsed).toISOString().normalize('NFC');
    }
    return value.normalize('NFC');
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new DomainError('VALIDATION_FAILED');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(item => normalize(item));
  if (typeof value !== 'object') throw new DomainError('VALIDATION_FAILED');
  const normalized = new Map<string, unknown>();
  for (const [rawKey, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) throw new DomainError('VALIDATION_FAILED');
    const normalizedKey = rawKey.normalize('NFC');
    if (normalized.has(normalizedKey)) throw new DomainError('VALIDATION_FAILED');
    normalized.set(normalizedKey, normalize(child, normalizedKey));
  }
  return Object.fromEntries(
    [...normalized.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}
