/**
 * PKCE (Proof Key for Code Exchange) cryptographic utilities.
 * Implements RFC 7636 S256 challenge method.
 *
 * @internal This module is not exported from the main package.
 */

const encoder = new TextEncoder();

/**
 * Generate a code verifier for PKCE.
 * Uses 32 random bytes encoded as base64url (43 characters).
 *
 * Per RFC 7636: code_verifier must be 43-128 characters using unreserved characters.
 */
export function generateCodeVerifier(): string {
  // 32 bytes -> 43 chars base64url
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

/**
 * Compute the S256 code challenge from a verifier.
 * challenge = BASE64URL(SHA256(verifier))
 *
 * Per RFC 7636: S256 method uses SHA-256 hash of the verifier.
 */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return Buffer.from(digest).toString('base64url');
}

/**
 * Generate a state parameter for CSRF protection.
 * Uses 16 random bytes encoded as base64url (22 characters).
 */
export function generateState(): string {
  // 16 bytes -> 22 chars base64url
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
}
