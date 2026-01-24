import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { EncryptionProvider } from './base';

const scryptAsync = promisify(scrypt);

/**
 * AES-256-GCM encryption provider using Node.js crypto.
 */
export class NodeCryptoEncryptionProvider implements EncryptionProvider {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private key: Buffer | null = null;

  constructor(private readonly secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('Encryption secret must be at least 32 characters');
    }
  }

  private async getKey(): Promise<Buffer> {
    if (!this.key) {
      this.key = (await scryptAsync(this.secret, 'salt', this.keyLength)) as Buffer;
    }
    return this.key;
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.getKey();
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv, { authTagLength: this.authTagLength });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    const key = await this.getKey();
    const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');

    if (!ivB64 || !authTagB64 || !encryptedB64) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = createDecipheriv(this.algorithm, key, iv, { authTagLength: this.authTagLength });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  async hash(value: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(`${salt}:${value}`).digest('hex');
    return `${salt}:${hash}`;
  }

  async verifyHash(value: string, hashWithSalt: string): Promise<boolean> {
    const [salt, storedHash] = hashWithSalt.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const computedHash = createHash('sha256').update(`${salt}:${value}`).digest('hex');
    return timingSafeEqual(Buffer.from(storedHash), Buffer.from(computedHash));
  }
}
