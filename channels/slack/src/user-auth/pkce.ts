/**
 * PKCE (RFC 7636) utilities using the Web Crypto API (global in Node.js 20+).
 */

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Generate a PKCE code verifier and its S256 challenge. */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64urlEncode(verifierBytes);

  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64urlEncode(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

/** Generate a random OAuth `state` value. */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
