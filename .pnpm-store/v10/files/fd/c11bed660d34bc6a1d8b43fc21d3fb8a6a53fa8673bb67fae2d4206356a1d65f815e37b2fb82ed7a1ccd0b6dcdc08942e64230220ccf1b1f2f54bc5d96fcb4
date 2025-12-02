import type { JWK, KeyLike } from '../types';
export interface PEMImportOptions {
    /**
     * (Only effective in Web Crypto API runtimes) The value to use as
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey SubtleCrypto.importKey()}
     * `extractable` argument. Default is false.
     */
    extractable?: boolean;
}
/**
 * Imports a PEM-encoded SPKI string as a runtime-specific public key representation (KeyObject or
 * CryptoKey).
 *
 * Note: The OID id-RSASSA-PSS (1.2.840.113549.1.1.10) is not supported in
 * {@link https://w3c.github.io/webcrypto/ Web Cryptography API}, use the OID rsaEncryption
 * (1.2.840.113549.1.1.1) instead for all RSA algorithms.
 *
 * @param spki PEM-encoded SPKI string
 * @param alg (Only effective in Web Crypto API runtimes) JSON Web Algorithm identifier to be used
 *   with the imported key, its presence is only enforced in Web Crypto API runtimes. See
 *   {@link https://github.com/panva/jose/issues/210 Algorithm Key Requirements}.
 */
export declare function importSPKI<KeyLikeType extends KeyLike = KeyLike>(spki: string, alg: string, options?: PEMImportOptions): Promise<KeyLikeType>;
/**
 * Imports the SPKI from an X.509 string certificate as a runtime-specific public key representation
 * (KeyObject or CryptoKey).
 *
 * Note: The OID id-RSASSA-PSS (1.2.840.113549.1.1.10) is not supported in
 * {@link https://w3c.github.io/webcrypto/ Web Cryptography API}, use the OID rsaEncryption
 * (1.2.840.113549.1.1.1) instead for all RSA algorithms.
 *
 * @param x509 X.509 certificate string
 * @param alg (Only effective in Web Crypto API runtimes) JSON Web Algorithm identifier to be used
 *   with the imported key, its presence is only enforced in Web Crypto API runtimes. See
 *   {@link https://github.com/panva/jose/issues/210 Algorithm Key Requirements}.
 */
export declare function importX509<KeyLikeType extends KeyLike = KeyLike>(x509: string, alg: string, options?: PEMImportOptions): Promise<KeyLikeType>;
/**
 * Imports a PEM-encoded PKCS#8 string as a runtime-specific private key representation (KeyObject
 * or CryptoKey).
 *
 * Note: The OID id-RSASSA-PSS (1.2.840.113549.1.1.10) is not supported in
 * {@link https://w3c.github.io/webcrypto/ Web Cryptography API}, use the OID rsaEncryption
 * (1.2.840.113549.1.1.1) instead for all RSA algorithms.
 *
 * @param pkcs8 PEM-encoded PKCS#8 string
 * @param alg (Only effective in Web Crypto API runtimes) JSON Web Algorithm identifier to be used
 *   with the imported key, its presence is only enforced in Web Crypto API runtimes. See
 *   {@link https://github.com/panva/jose/issues/210 Algorithm Key Requirements}.
 */
export declare function importPKCS8<KeyLikeType extends KeyLike = KeyLike>(pkcs8: string, alg: string, options?: PEMImportOptions): Promise<KeyLikeType>;
/**
 * Imports a JWK to a runtime-specific key representation (KeyLike). Either the JWK "alg"
 * (Algorithm) Parameter, or the optional "alg" argument, must be present.
 *
 * Note: When the runtime is using {@link https://w3c.github.io/webcrypto/ Web Cryptography API} the
 * jwk parameters "use", "key_ops", and "ext" are also used in the resulting `CryptoKey`.
 *
 * @param jwk JSON Web Key.
 * @param alg (Only effective in Web Crypto API runtimes) JSON Web Algorithm identifier to be used
 *   with the imported key. Default is the "alg" property on the JWK, its presence is only enforced
 *   in Web Crypto API runtimes. See
 *   {@link https://github.com/panva/jose/issues/210 Algorithm Key Requirements}.
 */
export declare function importJWK<KeyLikeType extends KeyLike = KeyLike>(jwk: JWK, alg?: string): Promise<KeyLikeType | Uint8Array>;
