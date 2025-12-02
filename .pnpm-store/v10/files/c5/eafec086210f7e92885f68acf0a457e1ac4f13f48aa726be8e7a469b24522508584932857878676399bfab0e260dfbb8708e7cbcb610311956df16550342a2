"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoUtils = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
function makeKey(keyBytes) {
    return Promise.resolve(keyBytes);
}
function randomBytes(size) {
    return node_crypto_1.default.randomBytes(size);
}
async function H(msg) {
    const sign = node_crypto_1.default.createHash("sha256");
    sign.update(msg);
    return sign.digest();
}
async function HMAC(key, msg) {
    const cryptoKey = key instanceof Uint8Array ? key : node_crypto_1.default.KeyObject.from(key);
    const hm = node_crypto_1.default.createHmac("sha256", cryptoKey);
    hm.update(msg);
    return hm.digest();
}
exports.cryptoUtils = {
    makeKey,
    randomBytes,
    H,
    HMAC,
};
