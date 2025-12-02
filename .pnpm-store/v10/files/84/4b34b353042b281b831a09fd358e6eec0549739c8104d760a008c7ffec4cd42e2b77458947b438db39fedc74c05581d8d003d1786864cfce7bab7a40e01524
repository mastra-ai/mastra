import { CryptoProvider } from './crypto-provider';
/**
 * `CryptoProvider which uses the Node `crypto` package for its computations.
 */
export declare class NodeCryptoProvider extends CryptoProvider {
    /** @override */
    computeHMACSignature(payload: string, secret: string): string;
    /** @override */
    computeHMACSignatureAsync(payload: string, secret: string): Promise<string>;
    /** @override */
    secureCompare(stringA: string, stringB: string): Promise<boolean>;
    encrypt(plaintext: Uint8Array, key: Uint8Array, iv?: Uint8Array, aad?: Uint8Array): Promise<{
        ciphertext: Uint8Array;
        iv: Uint8Array;
        tag: Uint8Array;
    }>;
    decrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, tag: Uint8Array, aad?: Uint8Array): Promise<Uint8Array>;
    randomBytes(length: number): Uint8Array;
}
