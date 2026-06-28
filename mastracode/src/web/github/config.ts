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
  stateSecret = explicitStateSecret() ?? randomBytes(32).toString('hex');
  return stateSecret;
}

/**
 * The explicit, deployment-stable state secret if one is configured. When
 * undefined, `getStateSecret()` falls back to a per-process random secret, which
 * is NOT stable across replicas: a `state` signed by one replica cannot be
 * verified by another. Multi-replica deploys must set an explicit secret.
 */
function explicitStateSecret(): string | undefined {
  return process.env.GITHUB_APP_WEBHOOK_SECRET || process.env.WORKOS_COOKIE_PASSWORD || undefined;
}

/**
 * True when a deployment-stable state secret is configured. Startup uses this to
 * fail loud when the GitHub feature is on but state signing would not be
 * replica-stable.
 */
export function hasExplicitStateSecret(): boolean {
  return explicitStateSecret() !== undefined;
}

/**
 * Fail loud at startup if the GitHub feature is on but no replica-stable state
 * secret is configured. A random per-process secret silently breaks the
 * OAuth/install callback whenever it lands on a different replica than the one
 * that signed the `state`. Returns without error when the feature is off (the
 * random fallback is acceptable for single-process/local dev).
 */
export function assertReplicaStableStateSecret(): void {
  if (!isGithubFeatureEnabled()) return;
  if (hasExplicitStateSecret()) return;
  throw new Error(
    'GitHub App feature is enabled but no replica-stable state secret is set. ' +
      'Set GITHUB_APP_WEBHOOK_SECRET (or WORKOS_COOKIE_PASSWORD) so OAuth/install ' +
      '`state` can be verified across replicas. Without it, the install callback ' +
      'fails whenever it lands on a different replica than the one that signed it.',
  );
}

interface StatePayload {
  orgId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
}

/** Verified `(orgId, userId)` tenant carried by a signed install `state`. */
export interface StateTenant {
  orgId: string;
  userId: string;
}

/** Signed `state` values expire after this window to bound the CSRF token. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Build a signed `state` bound to the `(orgId, userId)` tenant. The payload is
 * base64url JSON with an HMAC suffix so the callback can verify it was not
 * tampered with and belongs to the same org + user.
 */
export function signState(orgId: string, userId: string): string {
  const payload: StatePayload = {
    orgId,
    userId,
    nonce: randomBytes(8).toString('hex'),
    issuedAt: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify a signed `state` and return the bound `(orgId, userId)` tenant, or
 * `null` if invalid.
 */
export function verifyState(state: string | undefined): StateTenant | null {
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
    if (typeof parsed.orgId !== 'string' || typeof parsed.userId !== 'string') return null;
    if (typeof parsed.issuedAt !== 'number') return null;
    if (Date.now() - parsed.issuedAt > STATE_MAX_AGE_MS) return null;
    return { orgId: parsed.orgId, userId: parsed.userId };
  } catch {
    return null;
  }
}

/** For tests: reset the cached state secret. */
export function __resetStateSecretForTests(): void {
  stateSecret = undefined;
}
