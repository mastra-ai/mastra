import { createHmac, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'crypto';

/**
 * Verify a Slack request signature.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(params: {
  signingSecret: string;
  timestamp: string;
  body: string;
  signature: string;
}): boolean {
  const { signingSecret, timestamp, body, signature } = params;
  // Check timestamp to prevent replay attacks (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(now - requestTime) > 300) {
    return false;
  }

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')}`;

  // Timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * Parse URL-encoded form body from Slack slash commands.
 * Uses URLSearchParams which correctly handles `+` as space.
 */
export function parseSlackFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) {
    params[key] = value;
  }
  return params;
}

// ---------------------------------------------------------------------------
// Encryption / Decryption — AES-256-GCM with HKDF-SHA256 key derivation
// ---------------------------------------------------------------------------
//
// Ciphertext format:  aes-256-gcm-hkdf:<salt>:<iv>:<authTag>:<ciphertext>
// All components are base64-encoded.
//
// To add a new algorithm in the future:
//   1. Add a new prefix constant and decrypt branch
//   2. Update encrypt() to emit the new prefix
// ---------------------------------------------------------------------------

const ALGO_PREFIX = 'aes-256-gcm-hkdf';

/**
 * Encrypt sensitive data using AES-256-GCM with HKDF-SHA256 key derivation.
 * Returns: `aes-256-gcm-hkdf:base64(salt):base64(iv):base64(authTag):base64(ciphertext)`
 */
export function encrypt(plaintext: string, key: string): string {
  const salt = randomBytes(16);
  const derived = Buffer.from(hkdfSync('sha256', key, salt, 'mastra-slack-encryption', 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derived, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ALGO_PREFIX}:${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt data produced by encrypt().
 */
export function decrypt(ciphertext: string, key: string): string {
  const colonIdx = ciphertext.indexOf(':');
  if (colonIdx === -1) {
    throw new Error('Invalid ciphertext format');
  }

  const prefix = ciphertext.slice(0, colonIdx);
  if (prefix !== ALGO_PREFIX) {
    throw new Error(`Unsupported encryption algorithm: ${prefix}`);
  }

  const payload = ciphertext.slice(colonIdx + 1);
  const [saltB64, ivB64, authTagB64, encryptedB64] = payload.split(':');
  if (!saltB64 || !ivB64 || !authTagB64 || encryptedB64 === undefined) {
    throw new Error('Invalid ciphertext payload');
  }

  const salt = Buffer.from(saltB64, 'base64');
  const derived = Buffer.from(hkdfSync('sha256', key, salt, 'mastra-slack-encryption', 32));
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', derived, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
