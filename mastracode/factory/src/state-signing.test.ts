import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStateSigner } from './state-signing.js';

// ── State-secret deploy scenario (ported from github/state-secret-scenario) ──
// The OAuth/install `state` is HMAC-signed. Each `createStateSigner(secret)`
// models one replica: with an explicit secret every replica resolves the SAME
// key, without one each replica gets its own per-process random key.

describe('sign/verify round-trip', () => {
  it('verifies its own signed state and returns the bound tenant', () => {
    const signer = createStateSigner('secret');
    const state = signer.sign('orgA', 'user1');
    expect(signer.verify(state)).toEqual({ orgId: 'orgA', userId: 'user1' });
  });

  it('rejects missing or malformed state', () => {
    const signer = createStateSigner('secret');
    expect(signer.verify(undefined)).toBeNull();
    expect(signer.verify('')).toBeNull();
    expect(signer.verify('no-dot-separator')).toBeNull();
  });

  it('rejects tampered payloads', () => {
    const signer = createStateSigner('secret');
    const state = signer.sign('orgA', 'user1');
    const [body, sig] = state.split('.') as [string, string];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.orgId = 'orgB';
    const forgedBody = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
    expect(signer.verify(`${forgedBody}.${sig}`)).toBeNull();
  });

  it('rejects tampered signatures', () => {
    const signer = createStateSigner('secret');
    const state = signer.sign('orgA', 'user1');
    const flipped = state.slice(0, -1) + (state.endsWith('A') ? 'B' : 'A');
    expect(signer.verify(flipped)).toBeNull();
  });
});

describe('state age validation', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects a state issued in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:01:00Z'));
    const signer = createStateSigner('secret');
    const state = signer.sign('orgA', 'user1');

    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
    expect(signer.verify(state)).toBeNull();
  });

  it('accepts the expiration boundary and rejects one millisecond beyond it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
    const signer = createStateSigner('secret');
    const state = signer.sign('orgA', 'user1');

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(signer.verify(state)).toEqual({ orgId: 'orgA', userId: 'user1' });
    vi.advanceTimersByTime(1);
    expect(signer.verify(state)).toBeNull();
  });
});

describe('explicit secret verifies across replicas', () => {
  it('state signed on replica A verifies on replica B with the same secret', () => {
    const replicaA = createStateSigner('shared-stable-secret');
    const replicaB = createStateSigner('shared-stable-secret');

    const state = replicaA.sign('orgA', 'user1');

    expect(replicaB.verify(state)).toEqual({ orgId: 'orgA', userId: 'user1' });
    expect(replicaA.stable).toBe(true);
    expect(replicaB.stable).toBe(true);
  });

  it('state signed under one secret is rejected under another', () => {
    const state = createStateSigner('secret-1').sign('orgA', 'user1');
    expect(createStateSigner('secret-2').verify(state)).toBeNull();
  });
});

describe('random fallback fails across replicas', () => {
  it('state signed on replica A fails to verify on replica B with no explicit secret', () => {
    const replicaA = createStateSigner();
    const replicaB = createStateSigner();

    expect(replicaA.stable).toBe(false);
    const state = replicaA.sign('orgA', 'user1');

    expect(replicaB.verify(state)).toBeNull();
  });

  it('same process (same signer) still verifies its own random-signed state', () => {
    const signer = createStateSigner();
    const state = signer.sign('orgA', 'user1');
    expect(signer.verify(state)).toEqual({ orgId: 'orgA', userId: 'user1' });
  });
});

describe('stability flag', () => {
  it('is stable only for a non-empty explicit secret', () => {
    expect(createStateSigner('s').stable).toBe(true);
    expect(createStateSigner('').stable).toBe(false);
    expect(createStateSigner().stable).toBe(false);
  });
});
