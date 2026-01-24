import { describe, it, expect, beforeEach } from 'vitest';

import { NodeCryptoEncryptionProvider } from '../../encryption/node-crypto';

describe('NodeCryptoEncryptionProvider', () => {
  const secret = 'test-secret-key-that-is-at-least-32-chars-long';
  let provider: NodeCryptoEncryptionProvider;

  beforeEach(() => {
    provider = new NodeCryptoEncryptionProvider(secret);
  });

  describe('constructor', () => {
    it('should throw for short secret', () => {
      expect(() => new NodeCryptoEncryptionProvider('short')).toThrow('at least 32 characters');
    });

    it('should accept a secret of exactly 32 characters', () => {
      const exactSecret = 'a'.repeat(32);
      expect(() => new NodeCryptoEncryptionProvider(exactSecret)).not.toThrow();
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext each time', async () => {
      const plaintext = 'Hello, World!';
      const encrypted1 = await provider.encrypt(plaintext);
      const encrypted2 = await provider.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle unicode', async () => {
      const plaintext = 'Hello World';
      const encrypted = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', async () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong key', async () => {
      const encrypted = await provider.encrypt('secret');
      const wrongProvider = new NodeCryptoEncryptionProvider('different-secret-key-at-least-32-chars');

      await expect(wrongProvider.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe('hash/verifyHash', () => {
    it('should hash and verify correctly', async () => {
      const value = 'my-api-token';
      const hash = await provider.hash(value);
      const isValid = await provider.verifyHash(value, hash);

      expect(isValid).toBe(true);
    });

    it('should fail verification for wrong value', async () => {
      const hash = await provider.hash('correct-value');
      const isValid = await provider.verifyHash('wrong-value', hash);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes with different salts', async () => {
      const value = 'same-value';
      const hash1 = await provider.hash(value);
      const hash2 = await provider.hash(value);

      expect(hash1).not.toBe(hash2);
      // But both should verify
      expect(await provider.verifyHash(value, hash1)).toBe(true);
      expect(await provider.verifyHash(value, hash2)).toBe(true);
    });

    it('should handle empty string', async () => {
      const hash = await provider.hash('');
      const isValid = await provider.verifyHash('', hash);

      expect(isValid).toBe(true);
    });
  });
});
