/**
 * Abstract interface for encryption operations.
 */
export interface EncryptionProvider {
  /**
   * Encrypt a plaintext value.
   *
   * @param plaintext - Value to encrypt
   * @returns Base64-encoded encrypted value
   */
  encrypt(plaintext: string): Promise<string>;

  /**
   * Decrypt an encrypted value.
   *
   * @param ciphertext - Base64-encoded encrypted value
   * @returns Decrypted plaintext
   */
  decrypt(ciphertext: string): Promise<string>;

  /**
   * Hash a value (one-way).
   * Used for API tokens.
   *
   * @param value - Value to hash
   * @returns Hashed value
   */
  hash(value: string): Promise<string>;

  /**
   * Verify a value against a hash.
   *
   * @param value - Plain value
   * @param hash - Hash to verify against
   * @returns True if matches
   */
  verifyHash(value: string, hash: string): Promise<boolean>;
}
