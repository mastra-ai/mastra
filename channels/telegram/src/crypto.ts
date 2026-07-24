import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Opt-in AES-256-GCM encryption for installation secrets at rest, with
 * HKDF-SHA256 key derivation (mirrors `@mastra/slack`'s `crypto.ts`). Each value
 * gets a fresh random 16-byte salt + 12-byte IV; the salt travels in the
 * ciphertext, so the same passphrase never derives the same key twice. The
 * algorithm prefix lets plaintext and encrypted values coexist during migration,
 * so {@link decrypt} can no-op on plaintext.
 *
 * Format: `aes-256-gcm-hkdf:base64(salt):base64(iv):base64(authTag):base64(ciphertext)`
 */
const ALGO_PREFIX = 'aes-256-gcm-hkdf';
const HKDF_INFO = 'mastra-telegram-encryption';

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', passphrase, salt, HKDF_INFO, 32));
}

/** Whether a stored value was produced by {@link encrypt}. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${ALGO_PREFIX}:`);
}

/** Encrypt a UTF-8 string with a per-value random salt + IV. */
export function encrypt(plaintext: string, passphrase: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ALGO_PREFIX}:${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Decrypt a value from {@link encrypt}. Plaintext (unprefixed) is returned unchanged. */
export function decrypt(value: string, passphrase: string): string {
  if (!isEncrypted(value)) return value;
  const [, saltB64, ivB64, tagB64, ctB64] = value.split(':');
  if (!saltB64 || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error('Invalid ciphertext payload');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, Buffer.from(saltB64, 'base64')),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
