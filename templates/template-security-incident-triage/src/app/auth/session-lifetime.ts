import { createHmac, timingSafeEqual } from 'node:crypto';

/** Server-verifiable absolute session start; refreshes must never extend it. */
export function sealSessionIssuedAt(secret: string, issuedAtMs: number): string {
  const value = String(issuedAtMs);
  return `${value}.${createHmac('sha256', secret).update(value).digest('base64url')}`;
}

export function openSessionIssuedAt(
  secret: string,
  token: string | undefined,
  nowMs: number,
  maxAgeSeconds: number,
): number | null {
  if (!token) return null;
  const [value, signature, extra] = token.split('.');
  if (!value || !signature || extra || !/^\d{13}$/u.test(value)) return null;
  const expected = createHmac('sha256', secret).update(value).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    return null;
  const issuedAt = Number(value);
  return Number.isSafeInteger(issuedAt) && issuedAt <= nowMs && nowMs - issuedAt < maxAgeSeconds * 1000
    ? issuedAt
    : null;
}
