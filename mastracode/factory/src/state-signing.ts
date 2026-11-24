/**
 * Shared OAuth/install `state` signing for web integrations.
 *
 * The GitHub, Linear, and Slack OAuth/OIDC flows each round-trip a signed `state`
 * value
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

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Where a flow started, so its callback can send the user back there: `slack` for a link
 * posted in Slack, `setup` for a Factory's member setup page.
 */
export type StateOrigin = 'slack' | 'setup';

const STATE_ORIGINS: readonly StateOrigin[] = ['slack', 'setup'];

/** True for a value the signer accepts as a {@link StateOrigin}. */
export function isStateOrigin(value: unknown): value is StateOrigin {
  return typeof value === 'string' && (STATE_ORIGINS as readonly string[]).includes(value);
}

/** Context a caller can bind into a signed `state` beside the tenant. */
export interface StateContext {
  /** Factory that initiated the integration flow. */
  factoryProjectId?: string;
  /** Where the flow started. */
  from?: StateOrigin;
}

/** Verified tenant and optional Factory context carried by a signed `state`. */
export interface StateTenant {
  orgId: string;
  userId: string;
  /** Factory that initiated the integration flow, when the caller supplied one. */
  factoryProjectId?: string;
  /** Where the flow started, when the caller supplied it. */
  from?: StateOrigin;
  /**
   * Per-`state` random value. A signed `state` stays valid for its whole
   * lifetime, so a flow that must not run twice off one `state` (account
   * binding, for instance) can key single-use bookkeeping on this.
   */
  nonce: string;
}

/** Signs and verifies OAuth `state` values bound to a tenant and optional Factory. */
export interface StateSigner {
  /** Build a signed `state` bound to the tenant and optional initiating Factory. */
  sign(orgId: string, userId: string, context?: StateContext): string;
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
  factoryProjectId?: string;
  from?: StateOrigin;
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
  const key = stable ? secret : Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  return {
    stable,
    sign(orgId: string, userId: string, context?: StateContext): string {
      const payload: StatePayload = {
        orgId,
        userId,
        ...(context?.factoryProjectId ? { factoryProjectId: context.factoryProjectId } : {}),
        ...(context?.from ? { from: context.from } : {}),
        nonce: Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(8))).toString('hex'),
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
        if (typeof parsed.nonce !== 'string' || parsed.nonce.length === 0) return null;
        if (
          parsed.factoryProjectId !== undefined &&
          (typeof parsed.factoryProjectId !== 'string' || parsed.factoryProjectId.length === 0)
        ) {
          return null;
        }
        if (parsed.from !== undefined && !isStateOrigin(parsed.from)) return null;
        const age = Date.now() - parsed.issuedAt;
        if (age < 0 || age > STATE_MAX_AGE_MS) return null;
        return {
          orgId: parsed.orgId,
          userId: parsed.userId,
          ...(parsed.factoryProjectId ? { factoryProjectId: parsed.factoryProjectId } : {}),
          ...(parsed.from ? { from: parsed.from } : {}),
          nonce: parsed.nonce,
        };
      } catch {
        return null;
      }
    },
  };
}
