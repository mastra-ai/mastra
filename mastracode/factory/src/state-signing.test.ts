import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStateSigner } from './state-signing.js';

const encoder = new TextEncoder();

async function signHmac(value: string, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Buffer.from(signature).toString('base64url');
}

// ── State-secret deploy scenario (ported from github/state-secret-scenario) ──
// The OAuth/install `state` is HMAC-signed. Each `createStateSigner(secret)`
// models one replica: with an explicit secret every replica resolves the SAME
// key, without one each replica gets its own per-process random key.

describe('sign/verify round-trip', () => {
  it('verifies its own signed state and returns the bound tenant', async () => {
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1');
    await expect(signer.verify(state)).resolves.toEqual({
      orgId: 'orgA',
      userId: 'user1',
      nonce: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
  });

  it('round-trips an optional initiating Factory', async () => {
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1', { factoryProjectId: 'fp-1' });

    await expect(signer.verify(state)).resolves.toEqual({
      orgId: 'orgA',
      userId: 'user1',
      factoryProjectId: 'fp-1',
      nonce: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
  });

  it('rejects missing or malformed state', async () => {
    const signer = createStateSigner('secret');
    await expect(signer.verify(undefined)).resolves.toBeNull();
    await expect(signer.verify('')).resolves.toBeNull();
    await expect(signer.verify('no-dot-separator')).resolves.toBeNull();
  });

  it('gives every state a distinct nonce so callers can enforce single use', async () => {
    const signer = createStateSigner('secret');

    const first = await signer.verify(await signer.sign('orgA', 'user1'));
    const second = await signer.verify(await signer.sign('orgA', 'user1'));

    expect(first?.nonce).toBeTruthy();
    expect(second?.nonce).not.toBe(first?.nonce);
  });

  it('rejects a signed state carrying no nonce', async () => {
    // A caller keying single-use bookkeeping on the nonce must never receive a
    // verified tenant without one, or the replay guard silently degrades.
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1');
    const { nonce: _dropped, ...noNonce } = JSON.parse(Buffer.from(state.split('.')[0]!, 'base64url').toString('utf8'));
    const body = Buffer.from(JSON.stringify(noNonce), 'utf8').toString('base64url');
    const sig = await signHmac(body, 'secret');

    await expect(signer.verify(`${body}.${sig}`)).resolves.toBeNull();
  });

  it('rejects tampered payloads', async () => {
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1');
    const [body, sig] = state.split('.') as [string, string];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.orgId = 'orgB';
    const forgedBody = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
    await expect(signer.verify(`${forgedBody}.${sig}`)).resolves.toBeNull();
  });

  it('rejects a tampered Factory return context', async () => {
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1', { factoryProjectId: 'fp-1' });
    const [body, sig] = state.split('.') as [string, string];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.factoryProjectId = 'fp-2';
    const forgedBody = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');

    await expect(signer.verify(`${forgedBody}.${sig}`)).resolves.toBeNull();
  });

  it('rejects tampered signatures', async () => {
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1');
    const flipped = state.slice(0, -1) + (state.endsWith('A') ? 'B' : 'A');
    await expect(signer.verify(flipped)).resolves.toBeNull();
  });
});

describe('state age validation', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects a state issued in the future', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:01:00Z'));
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1');

    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
    await expect(signer.verify(state)).resolves.toBeNull();
  });

  it('accepts the expiration boundary and rejects one millisecond beyond it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
    const signer = createStateSigner('secret');
    const state = await signer.sign('orgA', 'user1');

    vi.advanceTimersByTime(10 * 60 * 1000);
    await expect(signer.verify(state)).resolves.toEqual({
      orgId: 'orgA',
      userId: 'user1',
      nonce: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    vi.advanceTimersByTime(1);
    await expect(signer.verify(state)).resolves.toBeNull();
  });
});

describe('explicit secret verifies across replicas', () => {
  it('state signed on replica A verifies on replica B with the same secret', async () => {
    const replicaA = createStateSigner('shared-stable-secret');
    const replicaB = createStateSigner('shared-stable-secret');

    const state = await replicaA.sign('orgA', 'user1');

    await expect(replicaB.verify(state)).resolves.toEqual({
      orgId: 'orgA',
      userId: 'user1',
      nonce: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(replicaA.stable).toBe(true);
    expect(replicaB.stable).toBe(true);
  });

  it('state signed under one secret is rejected under another', async () => {
    const state = await createStateSigner('secret-1').sign('orgA', 'user1');
    await expect(createStateSigner('secret-2').verify(state)).resolves.toBeNull();
  });
});

describe('random fallback fails across replicas', () => {
  it('state signed on replica A fails to verify on replica B with no explicit secret', async () => {
    const replicaA = createStateSigner();
    const replicaB = createStateSigner();

    expect(replicaA.stable).toBe(false);
    const state = await replicaA.sign('orgA', 'user1');

    await expect(replicaB.verify(state)).resolves.toBeNull();
  });

  it('same process (same signer) still verifies its own random-signed state', async () => {
    const signer = createStateSigner();
    const state = await signer.sign('orgA', 'user1');
    await expect(signer.verify(state)).resolves.toEqual({
      orgId: 'orgA',
      userId: 'user1',
      nonce: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
  });
});

describe('stability flag', () => {
  it('is stable only for a non-empty explicit secret', () => {
    expect(createStateSigner('s').stable).toBe(true);
    expect(createStateSigner('').stable).toBe(false);
    expect(createStateSigner().stable).toBe(false);
  });
});
