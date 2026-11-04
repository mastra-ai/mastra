import { createCipheriv, createDecipheriv, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

const ALGO_PREFIX = 'aes-256-gcm-hkdf';
const HKDF_INFO = 'mastra-ring-encryption';

/**
 * Encrypt a string with AES-256-GCM using an HKDF-SHA256 derived key.
 * Format: `aes-256-gcm-hkdf:base64(salt):base64(iv):base64(authTag):base64(ciphertext)`
 */
export function encrypt(plaintext: string, key: string): string {
  const salt = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const derived = Buffer.from(hkdfSync('sha256', key, salt, HKDF_INFO, 32));
  const iv = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(12)));
  const cipher = createCipheriv('aes-256-gcm', derived, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ALGO_PREFIX}:${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 */
export function decrypt(ciphertext: string, key: string): string {
  const [prefix, saltB64, ivB64, authTagB64, encryptedB64] = ciphertext.split(':');
  if (prefix !== ALGO_PREFIX || !saltB64 || !ivB64 || !authTagB64 || encryptedB64 === undefined) {
    throw new Error('[Ring] Invalid encrypted value');
  }
  const salt = Buffer.from(saltB64, 'base64');
  const derived = Buffer.from(hkdfSync('sha256', key, salt, HKDF_INFO, 32));
  const decipher = createDecipheriv('aes-256-gcm', derived, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedB64, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * Constant-time string comparison.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Ring account-linking nonce: `HMAC-SHA256(key, "<time>:<accountId>")`, URL-safe base64 without padding.
 */
export function computeLinkNonce(hmacKey: string, time: string, accountId: string): string {
  return createHmac('sha256', hmacKey).update(`${time}:${accountId}`).digest('base64url');
}

/**
 * Ring webhook signature: `sha256=` + hex HMAC-SHA256 of the raw request body.
 */
export function computeWebhookSignature(hmacKey: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', hmacKey).update(rawBody).digest('hex')}`;
}

/**
 * Whether a value was produced by `encrypt()`.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${ALGO_PREFIX}:`);
}

/**
 * Derive the key that signs media URLs from the Ring HMAC key, so the key Ring uses
 * to sign webhooks isn't also used to sign URLs that end up in thread history.
 */
export function deriveMediaKey(hmacKey: string): string {
  return Buffer.from(hkdfSync('sha256', hmacKey, '', 'mastra-ring-media', 32)).toString('hex');
}

/**
 * Sign a media URL path and its expiry so the media route can't be used as an open proxy to Ring.
 */
export function signMediaPath(mediaKey: string, path: string, expires: number): string {
  return createHmac('sha256', mediaKey).update(`media:${path}:${expires}`).digest('base64url');
}
