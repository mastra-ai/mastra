import encrypt from '../runtime/encrypt.js';
import decrypt from '../runtime/decrypt.js';
import { encode as base64url } from '../runtime/base64url.js';
export async function wrap(alg, key, cek, iv) {
    const jweAlgorithm = alg.slice(0, 7);
    const wrapped = await encrypt(jweAlgorithm, cek, key, iv, new Uint8Array(0));
    return {
        encryptedKey: wrapped.ciphertext,
        iv: base64url(wrapped.iv),
        tag: base64url(wrapped.tag),
    };
}
export async function unwrap(alg, key, encryptedKey, iv, tag) {
    const jweAlgorithm = alg.slice(0, 7);
    return decrypt(jweAlgorithm, key, encryptedKey, iv, tag, new Uint8Array(0));
}
