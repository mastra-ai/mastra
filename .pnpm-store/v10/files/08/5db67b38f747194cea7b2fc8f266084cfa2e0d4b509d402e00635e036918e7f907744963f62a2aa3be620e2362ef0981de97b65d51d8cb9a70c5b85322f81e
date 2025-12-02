/**
 * WebCrypto-based AES gcm/ctr/cbc, `managedNonce` and `randomBytes`.
 * We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
 * @module
 */
import { abytes, anumber } from "./utils.js";
function getWebcryptoSubtle() {
    const cr = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (cr && typeof cr.subtle === 'object' && cr.subtle != null)
        return cr.subtle;
    throw new Error('crypto.subtle must be defined');
}
/**
 * Internal webcrypto utils. Can be overridden of crypto.subtle is not present,
 * for example in React Native.
 */
export const utils = {
    async encrypt(key, keyParams, cryptParams, plaintext) {
        const cr = getWebcryptoSubtle();
        const iKey = await cr.importKey('raw', key, keyParams, true, ['encrypt']);
        const ciphertext = await cr.encrypt(cryptParams, iKey, plaintext);
        return new Uint8Array(ciphertext);
    },
    async decrypt(key, keyParams, cryptParams, ciphertext) {
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
};
function getCryptParams(algo, nonce, AAD) {
    if (algo === mode.CBC)
        return { name: mode.CBC, iv: nonce };
    if (algo === mode.CTR)
        return { name: mode.CTR, counter: nonce, length: 64 };
    if (algo === mode.GCM) {
        if (AAD)
            return { name: mode.GCM, iv: nonce, additionalData: AAD };
        else
            return { name: mode.GCM, iv: nonce };
    }
    throw new Error('unknown aes block mode');
}
function generate(algo, nonceLength) {
    anumber(nonceLength);
    const res = (key, nonce, AAD) => {
        abytes(key);
        abytes(nonce);
        const keyParams = { name: algo, length: key.length * 8 };
        const cryptParams = getCryptParams(algo, nonce, AAD);
        let consumed = false;
        return {
            // keyLength,
            encrypt(plaintext) {
                abytes(plaintext);
                if (consumed)
                    throw new Error('Cannot encrypt() twice with same key / nonce');
                consumed = true;
                return utils.encrypt(key, keyParams, cryptParams, plaintext);
            },
            decrypt(ciphertext) {
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
export const cbc = /* @__PURE__ */ (() => generate(mode.CBC, 16))();
/** AES-CTR, native webcrypto version */
export const ctr = /* @__PURE__ */ (() => generate(mode.CTR, 16))();
/** AES-GCM, native webcrypto version */
export const gcm = /* @__PURE__ */ (() => generate(mode.GCM, 12))();
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
//# sourceMappingURL=webcrypto.js.map