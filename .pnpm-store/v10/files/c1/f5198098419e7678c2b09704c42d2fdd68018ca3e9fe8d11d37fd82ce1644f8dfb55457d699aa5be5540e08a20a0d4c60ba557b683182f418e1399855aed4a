/**
 * WebCrypto-based AES gcm/ctr/cbc, `managedNonce` and `randomBytes`.
 * We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
 * @module
 */
import { abytes, anumber, type AsyncCipher } from './utils.ts';

function getWebcryptoSubtle(): any {
  const cr = typeof globalThis !== 'undefined' && (globalThis as any).crypto;
  if (cr && typeof cr.subtle === 'object' && cr.subtle != null) return cr.subtle;
  throw new Error('crypto.subtle must be defined');
}

/**
 * Internal webcrypto utils. Can be overridden of crypto.subtle is not present,
 * for example in React Native.
 */
export const utils: {
  encrypt: (key: Uint8Array, ...all: any[]) => Promise<Uint8Array>;
  decrypt: (key: Uint8Array, ...all: any[]) => Promise<Uint8Array>;
} = {
  async encrypt(
    key: Uint8Array,
    keyParams: any,
    cryptParams: any,
    plaintext: Uint8Array
  ): Promise<Uint8Array> {
    const cr = getWebcryptoSubtle();
    const iKey = await cr.importKey('raw', key, keyParams, true, ['encrypt']);
    const ciphertext = await cr.encrypt(cryptParams, iKey, plaintext);
    return new Uint8Array(ciphertext);
  },
  async decrypt(
    key: Uint8Array,
    keyParams: any,
    cryptParams: any,
    ciphertext: Uint8Array
  ): Promise<Uint8Array> {
    const cr = getWebcryptoSubtle();
    const iKey = await cr.importKey('raw', key, keyParams, true, ['decrypt']);
    const plaintext = await cr.decrypt(cryptParams, iKey, ciphertext);
    return new Uint8Array(plaintext);
  },
};

const mode = {
  CBC: 'AES-CBC',
  CTR: 'AES-CTR',
  GCM: 'AES-GCM',
} as const;
type BlockMode = (typeof mode)[keyof typeof mode];

function getCryptParams(algo: BlockMode, nonce: Uint8Array, AAD?: Uint8Array) {
  if (algo === mode.CBC) return { name: mode.CBC, iv: nonce };
  if (algo === mode.CTR) return { name: mode.CTR, counter: nonce, length: 64 };
  if (algo === mode.GCM) {
    if (AAD) return { name: mode.GCM, iv: nonce, additionalData: AAD };
    else return { name: mode.GCM, iv: nonce };
  }

  throw new Error('unknown aes block mode');
}

function generate(algo: BlockMode, nonceLength: number) {
  anumber(nonceLength);
  const res = (key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array): AsyncCipher => {
    abytes(key);
    abytes(nonce);
    const keyParams = { name: algo, length: key.length * 8 };
    const cryptParams = getCryptParams(algo, nonce, AAD);
    let consumed = false;
    return {
      // keyLength,
      encrypt(plaintext: Uint8Array) {
        abytes(plaintext);
        if (consumed) throw new Error('Cannot encrypt() twice with same key / nonce');
        consumed = true;
        return utils.encrypt(key, keyParams, cryptParams, plaintext);
      },
      decrypt(ciphertext: Uint8Array) {
        abytes(ciphertext);
        return utils.decrypt(key, keyParams, cryptParams, ciphertext);
      },
    };
  };
  res.nonceLength = nonceLength;
  res.blockSize = 16; // always for AES
  return res;
}

/** AES-CBC, native webcrypto version */
export const cbc: ((key: Uint8Array, iv: Uint8Array) => AsyncCipher) & {
  blockSize: number;
  nonceLength: number;
} = /* @__PURE__ */ (() => generate(mode.CBC, 16))();
/** AES-CTR, native webcrypto version */
export const ctr: ((key: Uint8Array, nonce: Uint8Array) => AsyncCipher) & {
  blockSize: number;
  nonceLength: number;
} = /* @__PURE__ */ (() => generate(mode.CTR, 16))();
/** AES-GCM, native webcrypto version */
export const gcm: ((key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => AsyncCipher) & {
  blockSize: number;
  nonceLength: number;
} = /* @__PURE__ */ (() => generate(mode.GCM, 12))();

// // Type tests
// import { siv, gcm, ctr, ecb, cbc } from '../aes.ts';
// import { xsalsa20poly1305 } from '../salsa.ts';
// import { chacha20poly1305, xchacha20poly1305 } from '../chacha.ts';

// const wsiv = managedNonce(siv);
// const wgcm = managedNonce(gcm);
// const wctr = managedNonce(ctr);
// const wcbc = managedNonce(cbc);
// const wsalsapoly = managedNonce(xsalsa20poly1305);
// const wchacha = managedNonce(chacha20poly1305);
// const wxchacha = managedNonce(xchacha20poly1305);

// // should fail
// const wcbc2 = managedNonce(managedNonce(cbc));
// const wctr = managedNonce(ctr);
// import { gcm as gcmSync } from '../aes.ts';
// const x1 = managedNonce(gcmSync); // const x1: (key: Uint8Array, AAD?: Uint8Array | undefined) => Cipher
// const x2 = managedNonce(gcm); // const x2: (key: Uint8Array, AAD?: Uint8Array | undefined) => AsyncCipher
