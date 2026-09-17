import { createHmac, timingSafeEqual } from 'node:crypto';

export type PkceState = Readonly<{
  state: string;
  verifier: string;
  next: string;
  issuedAtMs: number;
}>;

export function safeDashboardNext(value: string | undefined): string {
  return value === '/' || value === '/dashboard' ? value : '/dashboard';
}

export function sealPkceState(secret: string, value: PkceState): string {
  const encoded = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function openPkceState(secret: string, token: string | undefined, nowMs: number): PkceState | null {
  if (!token) return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.state !== 'string' ||
      typeof candidate.verifier !== 'string' ||
      typeof candidate.next !== 'string' ||
      typeof candidate.issuedAtMs !== 'number'
    )
      return null;
    if (
      candidate.state.length < 16 ||
      candidate.verifier.length < 32 ||
      nowMs - candidate.issuedAtMs > 600_000 ||
      candidate.issuedAtMs > nowMs + 60_000
    )
      return null;
    return {
      state: candidate.state,
      verifier: candidate.verifier,
      next: safeDashboardNext(candidate.next),
      issuedAtMs: candidate.issuedAtMs,
    };
  } catch {
    return null;
  }
}
