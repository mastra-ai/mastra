/**
 * Shared OAuth/install `state` signing for web integrations.
 *
 * Both the GitHub and Linear OAuth flows round-trip a signed `state` value
 * through the third party to bind the callback to the `(orgId, userId)` tenant
 * that initiated it (CSRF protection + tenant routing). The signer is a system
 * facility: `MastraFactory` creates ONE signer at boot and hands it to every
 * registered integration through `IntegrationContext` (see
 * `./factory-integration.ts`), so all integrations sign and verify with the
 * same secret.
 *
 * Secret resolution happens in the factory, not here: explicit
 * `config.stateSecret` → the GitHub integration's webhook secret → a
 * per-process random secret. A random secret is NOT stable across replicas —
 * a `state` signed by one replica cannot be verified by another — which is
 * what the `stable` flag reports. The factory fails loud at boot when a
 * registered integration requires a stable signer but only a random one is
 * available.
 *
 * The wire format (base64url JSON payload + `.` + HMAC-SHA256 base64url
 * signature) is unchanged from the previous `github/config.ts` implementation
 * so in-flight OAuth states survive a deploy.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Verified `(orgId, userId)` tenant carried by a signed `state`. */
export interface StateTenant {
  orgId: string;
  userId: string;
}

/** Signs and verifies OAuth `state` values bound to a `(orgId, userId)` tenant. */
export interface StateSigner {
  /** Build a signed `state` bound to the tenant. */
  sign(orgId: string, userId: string): string;
  /** Verify a signed `state`; returns the bound tenant, or `null` if invalid. */
  verify(state: string | undefined): StateTenant | null;
  /**
   * True when the signer was built from an explicit deployment-stable secret.
   * False means a per-process random secret: fine for single-process/local
   * dev, broken for multi-replica deploys (see module docs).
   */
  readonly stable: boolean;
}

interface StatePayload {
  orgId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
}

/** Signed `state` values expire after this window to bound the CSRF token. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Create a state signer. With a `secret`, the signer is deployment-stable
 * (`stable: true`); without one it falls back to a per-process random secret
 * (`stable: false`).
 */
export function createStateSigner(secret?: string): StateSigner {
  const stable = typeof secret === 'string' && secret.length > 0;
  const key = stable ? secret : randomBytes(32).toString('hex');
  return {
    stable,
    sign(orgId: string, userId: string): string {
      const payload: StatePayload = {
        orgId,
        userId,
        nonce: randomBytes(8).toString('hex'),
        issuedAt: Date.now(),
      };
      const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
      const sig = createHmac('sha256', key).update(body).digest('base64url');
      return `${body}.${sig}`;
    },
    verify(state: string | undefined): StateTenant | null {
      if (!state) return null;
      const dot = state.lastIndexOf('.');
      if (dot <= 0) return null;
      const body = state.slice(0, dot);
      const sig = state.slice(dot + 1);
      const expected = createHmac('sha256', key).update(body).digest('base64url');
      const sigBuf = Buffer.from(sig);
      const expectedBuf = Buffer.from(expected);
      if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
      }
      try {
        const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
        if (typeof parsed.orgId !== 'string' || typeof parsed.userId !== 'string') return null;
        if (typeof parsed.issuedAt !== 'number' || !Number.isFinite(parsed.issuedAt)) return null;
        const age = Date.now() - parsed.issuedAt;
        if (age < 0 || age > STATE_MAX_AGE_MS) return null;
        return { orgId: parsed.orgId, userId: parsed.userId };
      } catch {
        return null;
      }
    },
  };
}
