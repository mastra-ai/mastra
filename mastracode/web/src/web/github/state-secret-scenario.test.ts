import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetStateSecretForTests,
  assertReplicaStableStateSecret,
  hasExplicitStateSecret,
  isGithubFeatureEnabled,
  signState,
  verifyState,
} from './config';

// ── Phase 6 state-secret deploy scenario ─────────────────────────────────
// The OAuth/install `state` is HMAC-signed with a secret. With no explicit
// secret it falls back to a per-process random one, which breaks across
// replicas: a `state` signed by replica A cannot be verified by replica B.
// These tests simulate a second replica via `__resetStateSecretForTests()`
// (drops the cached secret, forcing a fresh resolution as a new process would).

const GITHUB_ENV_KEYS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_SECRET',
  'GITHUB_APP_SLUG',
  'WORKOS_API_KEY',
  'WORKOS_CLIENT_ID',
  'APP_DATABASE_URL',
  'GITHUB_APP_WEBHOOK_SECRET',
  'WORKOS_COOKIE_PASSWORD',
] as const;

const saved: Record<string, string | undefined> = {};

function enableGithubFeature(): void {
  process.env.GITHUB_APP_ID = 'app-id';
  process.env.GITHUB_APP_PRIVATE_KEY = 'pk';
  process.env.GITHUB_APP_CLIENT_ID = 'client-id';
  process.env.GITHUB_APP_CLIENT_SECRET = 'client-secret';
  process.env.GITHUB_APP_SLUG = 'slug';
  process.env.WORKOS_API_KEY = 'workos-key';
  process.env.WORKOS_CLIENT_ID = 'workos-client';
  process.env.APP_DATABASE_URL = 'postgres://localhost/app';
}

beforeEach(() => {
  for (const k of GITHUB_ENV_KEYS) saved[k] = process.env[k];
  for (const k of GITHUB_ENV_KEYS) delete process.env[k];
  __resetStateSecretForTests();
});

afterEach(() => {
  for (const k of GITHUB_ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetStateSecretForTests();
});

describe('explicit secret verifies across replicas', () => {
  it('state signed on replica A verifies on replica B when an explicit secret is set', () => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'shared-stable-secret';
    __resetStateSecretForTests();

    // Replica A signs.
    const state = signState('orgA', 'user1');

    // Replica B: simulate a fresh process by dropping the cached secret. Because
    // the secret is read from env, B resolves the SAME secret.
    __resetStateSecretForTests();
    const tenant = verifyState(state);

    expect(tenant).toEqual({ orgId: 'orgA', userId: 'user1' });
  });

  it('WORKOS_COOKIE_PASSWORD also provides a stable secret', () => {
    process.env.WORKOS_COOKIE_PASSWORD = 'cookie-pw-stable';
    __resetStateSecretForTests();
    const state = signState('orgA', 'user1');
    __resetStateSecretForTests();
    expect(verifyState(state)).toEqual({ orgId: 'orgA', userId: 'user1' });
  });
});

describe('random fallback fails across replicas', () => {
  it('state signed on replica A fails to verify on replica B with no explicit secret', () => {
    // No explicit secret → per-process random.
    expect(hasExplicitStateSecret()).toBe(false);
    const state = signState('orgA', 'user1');

    // Replica B with a *different* random secret cannot verify.
    __resetStateSecretForTests();
    expect(verifyState(state)).toBeNull();
  });

  it('same process (no reset) still verifies its own random-signed state', () => {
    const state = signState('orgA', 'user1');
    // No reset → same in-process random secret → verifies.
    expect(verifyState(state)).toEqual({ orgId: 'orgA', userId: 'user1' });
  });
});

describe('startup guard', () => {
  it('throws when the GitHub feature is on but no explicit secret is set', () => {
    enableGithubFeature();
    expect(isGithubFeatureEnabled()).toBe(true);
    expect(hasExplicitStateSecret()).toBe(false);
    expect(() => assertReplicaStableStateSecret()).toThrow(/replica-stable state secret/);
  });

  it('passes when the GitHub feature is on and an explicit secret is set', () => {
    enableGithubFeature();
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'shared-stable-secret';
    expect(() => assertReplicaStableStateSecret()).not.toThrow();
  });

  it('is a no-op when the GitHub feature is off (random fallback is fine locally)', () => {
    // No GitHub env → feature off.
    expect(isGithubFeatureEnabled()).toBe(false);
    expect(() => assertReplicaStableStateSecret()).not.toThrow();
  });
});
