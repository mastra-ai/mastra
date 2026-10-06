/**
 * Encrypted session cookies and OAuth state, both as JWE tokens.
 *
 * `jose` handles encryption, integrity, and `exp` validation, so a cookie or
 * state value that is tampered with or expired fails to decrypt. Nothing is
 * stored server-side, which keeps logins working across restarts and multiple
 * instances.
 */

import { EncryptJWT, jwtDecrypt } from 'jose';
import type { JWTPayload } from 'jose';

/** Fixed salt: the cookie password is the secret, the salt only separates uses. */
const KEY_SALT = new TextEncoder().encode('mastra-auth-oidc');

/** PBKDF2 iterations used to turn the cookie password into an AES key. */
const KEY_ITERATIONS = 100_000;

/**
 * Derive a 256-bit AES-GCM key from the cookie password.
 *
 * Call this once per provider and reuse the result: PBKDF2 is deliberately
 * slow, and re-deriving per request would add that cost to every call.
 */
export async function deriveSessionKey(password: string): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: KEY_SALT, iterations: KEY_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * What a sealed token may be used for.
 *
 * Session cookies and OAuth state are sealed with the same key, so each one
 * records its purpose as the `aud` claim and checks it on the way back out.
 * Without that, a session cookie would decrypt cleanly when replayed as a
 * state parameter, and vice versa.
 */
export const SEAL_SESSION = 'mastra-oidc:session';
export const SEAL_STATE = 'mastra-oidc:state';

export type SealPurpose = typeof SEAL_SESSION | typeof SEAL_STATE;

/**
 * Encrypt a payload into a compact JWE that expires after `ttlSeconds`.
 */
export async function seal(
  payload: JWTPayload,
  key: Uint8Array,
  ttlSeconds: number,
  purpose: SealPurpose,
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setAudience(purpose)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(key);
}

/**
 * Decrypt a JWE produced by {@link seal}.
 *
 * @throws If the token is malformed, was not encrypted with this key, was
 * sealed for a different purpose, or has expired
 */
export async function unseal<T>(token: string, key: Uint8Array, purpose: SealPurpose): Promise<T> {
  const { payload } = await jwtDecrypt(token, key, { audience: purpose });
  return payload as T;
}

/**
 * The Mastra server appends the post-login redirect to the OAuth state as a
 * `|`-separated suffix. These helpers keep the sealed token and that suffix apart.
 */
export function stateSuffix(state: string): string {
  const separator = state.indexOf('|');
  return separator === -1 ? '' : state.slice(separator);
}

export function stateToken(state: string): string {
  const separator = state.indexOf('|');
  return separator === -1 ? state : state.slice(0, separator);
}
