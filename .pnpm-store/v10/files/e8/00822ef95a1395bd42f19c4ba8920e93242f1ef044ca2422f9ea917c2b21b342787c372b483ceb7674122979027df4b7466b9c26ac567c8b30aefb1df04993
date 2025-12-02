import { Buffer } from 'buffer/index.js';
export { Buffer } from 'buffer/index.js';

/**
 * seal() method options.
 */
interface SealOptionsSub {
    /**
     * The length of the salt (random buffer used to ensure that two identical objects will generate a different encrypted result). Defaults to 256.
     */
    saltBits: number;
    /**
     * The algorithm used. Defaults to 'aes-256-cbc' for encryption and 'sha256' for integrity.
     */
    algorithm: 'aes-128-ctr' | 'aes-256-cbc' | 'sha256';
    /**
     * The number of iterations used to derive a key from the password. Defaults to 1.
     */
    iterations: number;
    /**
     * Minimum password size. Defaults to 32.
     */
    minPasswordlength: number;
}
/**
 * Options for customizing the key derivation algorithm used to generate encryption and integrity verification keys as well as the algorithms and salt sizes used.
 */
interface SealOptions {
    /**
     * Encryption step options.
     */
    encryption: SealOptionsSub;
    /**
     * Integrity step options.
     */
    integrity: SealOptionsSub;
    /**
     * Sealed object lifetime in milliseconds where 0 means forever. Defaults to 0.
     */
    ttl: number;
    /**
     * Number of seconds of permitted clock skew for incoming expirations. Defaults to 60 seconds.
     */
    timestampSkewSec: number;
    /**
     * Local clock time offset, expressed in number of milliseconds (positive or negative). Defaults to 0.
     */
    localtimeOffsetMsec: number;
}
/**
 * Password secret string or buffer.
 */
type Password = Buffer | string;
/**
 * generateKey() method options.
 */
type GenerateKeyOptions = Pick<SealOptionsSub, 'algorithm' | 'iterations' | 'minPasswordlength'> & {
    saltBits?: number | undefined;
    salt?: string | undefined;
    iv?: Buffer | undefined;
    hmac?: boolean | undefined;
};
/**
 * Generated internal key object.
 */
interface Key {
    key: CryptoKey;
    salt: string;
    iv: Buffer;
}
/**
 * Generated HMAC internal results.
 */
interface HMacResult {
    digest: string;
    salt: string;
}
declare namespace password {
    /**
     * Secret object with optional id.
     */
    interface Secret {
        id?: string | undefined;
        secret: Password;
    }
    /**
     * Secret object with optional id and specified password for each encryption and integrity.
     */
    interface Specific {
        id?: string | undefined;
        encryption: Password;
        integrity: Password;
    }
    /**
     * Key-value pairs hash of password id to value.
     */
    type Hash = Record<string, Password | Secret | Specific>;
}
type RawPassword = Password | password.Secret | password.Specific;

declare const base64urlEncode: (value: Buffer | string) => string;
/**
 * The default encryption and integrity settings.
 */
declare const defaults: SealOptions;
declare const clone: (options: SealOptions) => SealOptions;
/**
 * Configuration of each supported algorithm.
 */
declare const algorithms: {
    readonly 'aes-128-ctr': {
        readonly keyBits: 128;
        readonly ivBits: 128;
        readonly name: "AES-CTR";
    };
    readonly 'aes-256-cbc': {
        readonly keyBits: 256;
        readonly ivBits: 128;
        readonly name: "AES-CBC";
    };
    readonly sha256: {
        readonly keyBits: 256;
        readonly name: "SHA-256";
    };
};
/**
 * MAC normalization format version.
 */
declare const macFormatVersion = "2";
/**
 * MAC normalization prefix.
 */
declare const macPrefix: string;
/**
 * Generate cryptographically strong pseudorandom bits.
 * @param _crypto Custom WebCrypto implementation
 * @param bits Number of bits to generate
 * @returns Buffer
 */
declare const randomBits: (_crypto: Crypto, bits: number) => Buffer;
/**
 * Generates a key from the password.
 * @param _crypto Custom WebCrypto implementation
 * @param password - A password string or buffer key
 * @param options - Object used to customize the key derivation algorithm
 * @returns An object with keys: key, salt, iv
 */
declare const generateKey: (_crypto: Crypto, password: Password, options: GenerateKeyOptions) => Promise<Key>;
/**
 * Encrypts data.
 * @param _crypto Custom WebCrypto implementation
 * @param password A password string or buffer key
 * @param options Object used to customize the key derivation algorithm
 * @param data String to encrypt
 * @returns An object with keys: encrypted, key
 */
declare const encrypt: (_crypto: Crypto, password: Password, options: GenerateKeyOptions, data: string) => Promise<{
    encrypted: Buffer;
    key: Key;
}>;
/**
 * Decrypts data.
 * @param _crypto Custom WebCrypto implementation
 * @param password A password string or buffer key
 * @param options Object used to customize the key derivation algorithm
 * @param data Buffer to decrypt
 * @returns Decrypted string
 */
declare const decrypt: (_crypto: Crypto, password: Password, options: GenerateKeyOptions, data: Buffer | string) => Promise<string>;
/**
 * Calculates a HMAC digest.
 * @param _crypto Custom WebCrypto implementation
 * @param password A password string or buffer
 * @param options Object used to customize the key derivation algorithm
 * @param data String to calculate the HMAC over
 * @returns An object with keys: digest, salt
 */
declare const hmacWithPassword: (_crypto: Crypto, password: Password, options: GenerateKeyOptions, data: string) => Promise<HMacResult>;
/**
 * Serializes, encrypts, and signs objects into an iron protocol string.
 * @param _crypto Custom WebCrypto implementation
 * @param object Data being sealed
 * @param password A string, buffer or object
 * @param options Object used to customize the key derivation algorithm
 * @returns Iron sealed string
 */
declare const seal: (_crypto: Crypto, object: unknown, password: RawPassword, options: SealOptions) => Promise<string>;
/**
 * Verifies, decrypts, and reconstruct an iron protocol string into an object.
 * @param _crypto Custom WebCrypto implementation
 * @param sealed The iron protocol string generated with seal()
 * @param password A string, buffer, or object
 * @param options Object used to customize the key derivation algorithm
 * @returns The verified decrypted object (can be null)
 */
declare const unseal: (_crypto: Crypto, sealed: string, password: Password | password.Hash, options: SealOptions) => Promise<unknown>;

export { GenerateKeyOptions, HMacResult, Key, Password, RawPassword, SealOptions, SealOptionsSub, algorithms, base64urlEncode, clone, decrypt, defaults, encrypt, generateKey, hmacWithPassword, macFormatVersion, macPrefix, password, randomBits, seal, unseal };
