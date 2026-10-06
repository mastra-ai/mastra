/**
 * Unit tests for the sealed-token primitives behind session cookies and OAuth
 * state. Everything the provider trusts without a server-side lookup is sealed
 * here, so these cover tampering, expiry, wrong keys, and purpose confusion.
 */

import { base64url } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SEAL_SESSION, SEAL_STATE, deriveSessionKey, seal, stateSuffix, stateToken, unseal } from './session';

const PASSWORD = 'a-cookie-password-that-is-at-least-32-chars';
const OTHER_PASSWORD = 'a-different-password-that-is-also-32-chars';

describe('deriveSessionKey', () => {
  it('returns a 256-bit key', async () => {
    expect((await deriveSessionKey(PASSWORD)).byteLength).toBe(32);
  });

  it('is deterministic for the same password', async () => {
    expect(await deriveSessionKey(PASSWORD)).toEqual(await deriveSessionKey(PASSWORD));
  });

  it('produces a different key for a different password', async () => {
    expect(await deriveSessionKey(PASSWORD)).not.toEqual(await deriveSessionKey(OTHER_PASSWORD));
  });
});

describe('seal and unseal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a payload', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const token = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);

    await expect(unseal(token, key, SEAL_SESSION)).resolves.toMatchObject({ user: { id: 'u1' } });
  });

  it('does not leak the payload into the token', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const token = await seal({ secret: 'super-secret-value' }, key, 60, SEAL_SESSION);

    expect(token).not.toContain('super-secret-value');
    expect(Buffer.from(token).toString('base64')).not.toContain('super-secret-value');
  });

  it('rejects a token sealed with a different key', async () => {
    const token = await seal({ user: { id: 'u1' } }, await deriveSessionKey(PASSWORD), 60, SEAL_SESSION);

    await expect(unseal(token, await deriveSessionKey(OTHER_PASSWORD), SEAL_SESSION)).rejects.toThrow();
  });

  it('rejects a token sealed for a different purpose', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const sessionToken = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);
    const state = await seal({ state: 's' }, key, 60, SEAL_STATE);

    // A session cookie must not be usable as OAuth state, or the reverse.
    await expect(unseal(sessionToken, key, SEAL_STATE)).rejects.toThrow();
    await expect(unseal(state, key, SEAL_SESSION)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const token = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);

    await expect(unseal(token, key, SEAL_SESSION)).resolves.toBeDefined();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);

    await expect(unseal(token, key, SEAL_SESSION)).rejects.toThrow();
  });

  it('rejects a tampered token', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const token = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);

    // Flip a bit in each segment in turn. Decode to bytes rather than editing
    // base64url characters: the final character of a segment can carry padding
    // bits, so a character swap there may decode to the very same bytes.
    const parts = token.split('.');
    for (const [index, name] of [
      [2, 'initialization vector'],
      [3, 'ciphertext'],
      [4, 'authentication tag'],
    ] as const) {
      const bytes = base64url.decode(parts[index]!);
      bytes[0]! ^= 0xff;

      const tampered = parts.with(index, base64url.encode(bytes)).join('.');
      await expect(unseal(tampered, key, SEAL_SESSION), `tampered ${name} must be rejected`).rejects.toThrow();
    }
  });

  it('rejects malformed input', async () => {
    const key = await deriveSessionKey(PASSWORD);

    for (const value of ['', 'not-a-token', 'a.b.c', 'a.b.c.d.e']) {
      await expect(unseal(value, key, SEAL_SESSION)).rejects.toThrow();
    }
  });

  it('produces a different token each time for the same payload', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const first = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);
    const second = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);

    expect(first).not.toBe(second);
  });

  it('seals to a cookie-safe value', async () => {
    const key = await deriveSessionKey(PASSWORD);
    const token = await seal({ user: { id: 'u1' } }, key, 60, SEAL_SESSION);

    // No characters that would terminate or split a Set-Cookie value.
    expect(token).toMatch(/^[A-Za-z0-9\-_.]+$/);
  });
});

describe('state suffix handling', () => {
  it('splits the sealed token from the server redirect suffix', () => {
    expect(stateToken('sealed|%2Fagents')).toBe('sealed');
    expect(stateSuffix('sealed|%2Fagents')).toBe('|%2Fagents');
  });

  it('treats a state with no suffix as the whole token', () => {
    expect(stateToken('sealed')).toBe('sealed');
    expect(stateSuffix('sealed')).toBe('');
  });

  it('keeps everything after the first separator', () => {
    expect(stateToken('sealed|a|b')).toBe('sealed');
    expect(stateSuffix('sealed|a|b')).toBe('|a|b');
  });
});
