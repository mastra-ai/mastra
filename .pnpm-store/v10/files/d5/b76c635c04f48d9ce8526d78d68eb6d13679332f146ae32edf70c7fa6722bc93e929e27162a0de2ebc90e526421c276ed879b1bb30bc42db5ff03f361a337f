"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrap = exports.wrap = void 0;
const encrypt_js_1 = require("../runtime/encrypt.js");
const decrypt_js_1 = require("../runtime/decrypt.js");
const base64url_js_1 = require("../runtime/base64url.js");
async function wrap(alg, key, cek, iv) {
    const jweAlgorithm = alg.slice(0, 7);
    const wrapped = await (0, encrypt_js_1.default)(jweAlgorithm, cek, key, iv, new Uint8Array(0));
    return {
        encryptedKey: wrapped.ciphertext,
        iv: (0, base64url_js_1.encode)(wrapped.iv),
        tag: (0, base64url_js_1.encode)(wrapped.tag),
    };
}
exports.wrap = wrap;
async function unwrap(alg, key, encryptedKey, iv, tag) {
    const jweAlgorithm = alg.slice(0, 7);
    return (0, decrypt_js_1.default)(jweAlgorithm, key, encryptedKey, iv, tag, new Uint8Array(0));
}
exports.unwrap = unwrap;
