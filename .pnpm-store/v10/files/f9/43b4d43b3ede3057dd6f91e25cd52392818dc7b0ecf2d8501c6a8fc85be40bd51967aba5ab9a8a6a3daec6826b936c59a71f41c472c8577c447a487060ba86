import { type Pbkdf2Opt } from './pbkdf2.ts';
import {
  abytes,
  ahash,
  anumber,
  checkOpts,
  kdfInputToBytes,
  type CHash,
  type KDFInput,
} from './utils.ts';

function _subtle(): typeof crypto.subtle {
  const cr = typeof globalThis === 'object' ? (globalThis as any).crypto : null;
  const sb = cr?.subtle;
  if (typeof sb === 'object' && sb != null) return sb;
  throw new Error('crypto.subtle must be defined');
}

export type WebHash = {
  (msg: Uint8Array): Promise<Uint8Array>;
  webCryptoName: string;
  outputLen: number;
  blockLen: number;
};

function createWebHash(name: string, blockLen: number, outputLen: number): WebHash {
  const hashC: any = async (msg: Uint8Array) => {
    abytes(msg);
    const crypto = _subtle();
    return new Uint8Array(await crypto.digest(name, msg as BufferSource));
  };
  hashC.webCryptoName = name; // make sure it won't interfere with function name
  hashC.outputLen = outputLen;
  hashC.blockLen = blockLen;
  hashC.create = () => {
    throw new Error('not implemented');
  };
  return hashC;
}

function ahashWeb(hash: WebHash) {
  ahash(hash as any as CHash);
  if (typeof hash.webCryptoName !== 'string') throw new Error('non-web hash');
}

/** WebCrypto SHA1 (RFC 3174) legacy hash function. It was cryptographically broken. */
// export const sha1: WebHash = createHash('SHA-1', 64, 20);

/** WebCrypto SHA2-256 hash function from RFC 4634. */
export const sha256: WebHash = /* @__PURE__ */ createWebHash('SHA-256', 64, 32);
/** WebCrypto SHA2-384 hash function from RFC 4634. */
export const sha384: WebHash = /* @__PURE__ */ createWebHash('SHA-384', 128, 48);
/** WebCrypto SHA2-512 hash function from RFC 4634. */
export const sha512: WebHash = /* @__PURE__ */ createWebHash('SHA-512', 128, 64);

/**
 * WebCrypto HMAC: RFC2104 message authentication code.
 * @param hash - function that would be used e.g. sha256. Webcrypto version.
 * @param key - key which would be used to authenticate message
 * @param message - message
 * @example
 * ```js
 * import { hmac, sha256 } from '@noble/hashes/webcrypto.js';
 * const mac1 = await hmac(sha256, 'key', 'message');
 * ```
 */
export const hmac: {
  (hash: WebHash, key: Uint8Array, message: Uint8Array): Promise<Uint8Array>;
  create(hash: WebHash, key: Uint8Array): any;
} = /* @__PURE__ */ (() => {
  const hmac_ = async (
    hash: WebHash,
    key: Uint8Array,
    message: Uint8Array
  ): Promise<Uint8Array> => {
    const crypto = _subtle();
    abytes(key, undefined, 'key');
    abytes(message, undefined, 'message');
    ahashWeb(hash);
    // WebCrypto keys can't be zeroized
    // prettier-ignore
    const wkey = await crypto.importKey(
      'raw',
      key as BufferSource,
      { name: 'HMAC', hash: hash.webCryptoName },
      false,
      ['sign']
    );
    return new Uint8Array(await crypto.sign('HMAC', wkey, message as BufferSource));
  };
  hmac_.create = (_hash: WebHash, _key: Uint8Array) => {
    throw new Error('not implemented');
  };
  return hmac_;
})();

/**
 * WebCrypto HKDF (RFC 5869): derive keys from an initial input.
 * Combines hkdf_extract + hkdf_expand in one step
 * @param hash - hash function that would be used (e.g. sha256). Webcrypto version.
 * @param ikm - input keying material, the initial key
 * @param salt - optional salt value (a non-secret random value)
 * @param info - optional context and application specific information (can be a zero-length string)
 * @param length - length of output keying material in bytes
 * @example
 * ```js
 * import { hkdf, sha256 } from '@noble/hashes/webcrypto.js';
 * import { randomBytes } from '@noble/hashes/utils.js';
 * const inputKey = randomBytes(32);
 * const salt = randomBytes(32);
 * const info = 'application-key';
 * const hk1w = await hkdf(sha256, inputKey, salt, info, 32);
 * ```
 */
export async function hkdf(
  hash: WebHash,
  ikm: Uint8Array,
  salt: Uint8Array | undefined,
  info: Uint8Array | undefined,
  length: number
): Promise<Uint8Array> {
  const crypto = _subtle();
  ahashWeb(hash);
  abytes(ikm, undefined, 'ikm');
  anumber(length, 'length');
  if (salt !== undefined) abytes(salt, undefined, 'salt');
  if (info !== undefined) abytes(info, undefined, 'info');
  const wkey = await crypto.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const opts = {
    name: 'HKDF',
    hash: hash.webCryptoName,
    salt: salt === undefined ? new Uint8Array(0) : salt,
    info: info === undefined ? new Uint8Array(0) : info,
  };
  return new Uint8Array(await crypto.deriveBits(opts, wkey, 8 * length));
}

/**
 * WebCrypto PBKDF2-HMAC: RFC 2898 key derivation function
 * @param hash - hash function that would be used e.g. sha256. Webcrypto version.
 * @param password - password from which a derived key is generated
 * @param salt - cryptographic salt
 * @param opts - {c, dkLen} where c is work factor and dkLen is output message size
 * @example
 * ```js
 * const key = await pbkdf2(sha256, 'password', 'salt', { dkLen: 32, c: Math.pow(2, 18) });
 * ```
 */
export async function pbkdf2(
  hash: WebHash,
  password: KDFInput,
  salt: KDFInput,
  opts: Pbkdf2Opt
): Promise<Uint8Array> {
  const crypto = _subtle();
  ahashWeb(hash);
  const _opts = checkOpts({ dkLen: 32 }, opts);
  const { c, dkLen } = _opts;
  anumber(c, 'c');
  anumber(dkLen, 'dkLen');
  const _password = kdfInputToBytes(password, 'password');
  const _salt = kdfInputToBytes(salt, 'salt');
  const key = await crypto.importKey('raw', _password as BufferSource, 'PBKDF2', false, [
    'deriveBits',
  ]);
  const deriveOpts = { name: 'PBKDF2', salt: _salt, iterations: c, hash: hash.webCryptoName };
  return new Uint8Array(await crypto.deriveBits(deriveOpts, key, 8 * dkLen));
}
