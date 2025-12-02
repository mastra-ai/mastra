"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoUtils = void 0;
async function makeKey(key) {
    return await crypto.subtle.importKey("raw", key, {
        name: "HMAC",
        hash: { name: "SHA-256" },
    }, false, ["sign"]);
}
function randomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
}
async function H(msg) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", msg));
}
async function HMAC(key, msg) {
    const cryptoKey = key instanceof Uint8Array ? (await makeKey(key)) : key;
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msg));
}
exports.cryptoUtils = {
    makeKey,
    randomBytes,
    H,
    HMAC,
};
