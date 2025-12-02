/**
 * Interface encapsulating the various crypto computations used by the library,
 * allowing pluggable underlying crypto implementations.
 */
export declare abstract class CryptoProvider {
    encoder: TextEncoder;
    /**
     * Computes a SHA-256 HMAC given a secret and a payload (encoded in UTF-8).
     * The output HMAC should be encoded in hexadecimal.
     *
     * Sample values for implementations:
     * - computeHMACSignature('', 'test_secret') => 'f7f9bd47fb987337b5796fdc1fdb9ba221d0d5396814bfcaf9521f43fd8927fd'
     * - computeHMACSignature('\ud83d\ude00', 'test_secret') => '837da296d05c4fe31f61d5d7ead035099d9585a5bcde87de952012a78f0b0c43
     */
    abstract computeHMACSignature(payload: string, secret: string): string;
    /**
     * Asynchronous version of `computeHMACSignature`. Some implementations may
     * only allow support async signature computation.
     *
     * Computes a SHA-256 HMAC given a secret and a payload (encoded in UTF-8).
     * The output HMAC should be encoded in hexadecimal.
     *
     * Sample values for implementations:
     * - computeHMACSignature('', 'test_secret') => 'f7f9bd47fb987337b5796fdc1fdb9ba221d0d5396814bfcaf9521f43fd8927fd'
     * - computeHMACSignature('\ud83d\ude00', 'test_secret') => '837da296d05c4fe31f61d5d7ead035099d9585a5bcde87de952012a78f0b0c43
     */
    abstract computeHMACSignatureAsync(payload: string, secret: string): Promise<string>;
    /**
     * Cryptographically determine whether two signatures are equal
     */
    abstract secureCompare(stringA: string, stringB: string): Promise<boolean>;
    /**
     * Encrypts data using AES-256-GCM algorithm.
     *
     * @param plaintext The data to encrypt
     * @param key The encryption key (should be 32 bytes for AES-256)
     * @param iv Optional initialization vector (if not provided, a random one will be generated)
     * @param aad Optional additional authenticated data
     * @returns Object containing the encrypted ciphertext, the IV used, and the authentication tag
     */
    abstract encrypt(plaintext: Uint8Array, key: Uint8Array, iv?: Uint8Array, aad?: Uint8Array): Promise<{
        ciphertext: Uint8Array;
        iv: Uint8Array;
        tag: Uint8Array;
    }>;
    /**
     * Decrypts data that was encrypted using AES-256-GCM algorithm.
     *
     * @param ciphertext The encrypted data
     * @param key The decryption key (must be the same key used for encryption)
     * @param iv The initialization vector used during encryption
     * @param tag The authentication tag produced during encryption
     * @param aad Optional additional authenticated data (must match what was used during encryption)
     * @returns The decrypted data
     * @throws Will throw an error if authentication fails or the data has been tampered with
     */
    abstract decrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, tag: Uint8Array, aad?: Uint8Array): Promise<Uint8Array>;
    /**
     * Generates cryptographically secure random bytes.
     *
     * @param length The number of random bytes to generate
     * @returns A Uint8Array containing the random bytes
     */
    abstract randomBytes(length: number): Uint8Array;
}
