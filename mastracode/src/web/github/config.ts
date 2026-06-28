/**
 * Shared configuration + state-signing helpers for the GitHub App feature.
 *
 * The GitHub feature is enabled only when *all three* hold:
 *  - the GitHub App env vars are present (`isGithubAppConfigured`),
 *  - web auth is enabled (a per-user installation requires a logged-in user),
 *  - the application database is configured (`isAppDbConfigured`).
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isWebAuthEnabled } from '../auth';
import { isGithubAppConfigured } from './client';
import { isAppDbConfigured } from './db';

/**
 * True when the GitHub App project feature should be active.
 */
export function isGithubFeatureEnabled(): boolean {
  return isGithubAppConfigured() && isWebAuthEnabled() && isAppDbConfigured();
}

/**
 * Secret used to sign the OAuth/install `state`. Falls back to a per-process
 * random secret when no explicit one is configured (state is short-lived).
 */
let stateSecret: string | undefined;
function getStateSecret(): string {
  if (stateSecret) return stateSecret;
  stateSecret =
    process.env.GITHUB_APP_WEBHOOK_SECRET || process.env.WORKOS_COOKIE_PASSWORD || randomBytes(32).toString('hex');
  return stateSecret;
}

interface StatePayload {
  userId: string;
  nonce: string;
  issuedAt: number;
}

/** Signed `state` values expire after this window to bound the CSRF token. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Build a signed `state` bound to the user id. The payload is base64url JSON
 * with an HMAC suffix so the callback can verify it was not tampered with and
 * belongs to the same user.
 */
export function signState(userId: string): string {
  const payload: StatePayload = { userId, nonce: randomBytes(8).toString('hex'), issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify a signed `state` and return the bound user id, or `null` if invalid.
 */
export function verifyState(state: string | undefined): string | null {
  if (!state) return null;
  const dot = state.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    if (typeof parsed.userId !== 'string' || typeof parsed.issuedAt !== 'number') return null;
    if (Date.now() - parsed.issuedAt > STATE_MAX_AGE_MS) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

/** For tests: reset the cached state secret. */
export function __resetStateSecretForTests(): void {
  stateSecret = undefined;
}
