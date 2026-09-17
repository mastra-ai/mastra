import { Buffer } from 'node:buffer';

/**
 * Verify that a request came from Slack
 */
export async function verifySlackRequest(
  signingSecret: string,
  requestSignature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  // Reject old requests (more than 5 minutes old)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo || !/^v0=[0-9a-f]{64}$/.test(requestSignature)) {
    return false;
  }

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  return globalThis.crypto.subtle.verify(
    'HMAC',
    key,
    Buffer.from(requestSignature.slice(3), 'hex'),
    new TextEncoder().encode(`v0:${timestamp}:${body}`),
  );
}
