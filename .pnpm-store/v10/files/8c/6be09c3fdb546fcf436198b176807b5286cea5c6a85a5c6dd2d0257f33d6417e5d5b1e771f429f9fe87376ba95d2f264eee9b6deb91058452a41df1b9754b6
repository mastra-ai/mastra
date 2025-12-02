"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtleCryptoProvider = void 0;
const crypto_provider_1 = require("./crypto-provider");
/**
 * `CryptoProvider which uses the SubtleCrypto interface of the Web Crypto API.
 *
 * This only supports asynchronous operations.
 */
class SubtleCryptoProvider extends crypto_provider_1.CryptoProvider {
    constructor(subtleCrypto) {
        super();
        // If no subtle crypto is interface, default to the global namespace. This
        // is to allow custom interfaces (eg. using the Node webcrypto interface in
        // tests).
        this.subtleCrypto = subtleCrypto || crypto.subtle;
    }
    computeHMACSignature(_payload, _secret) {
        throw new Error('SubleCryptoProvider cannot be used in a synchronous context.');
    }
    /** @override */
    computeHMACSignatureAsync(payload, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const key = yield this.subtleCrypto.importKey('raw', encoder.encode(secret), {
                name: 'HMAC',
                hash: { name: 'SHA-256' },
            }, false, ['sign']);
            const signatureBuffer = yield this.subtleCrypto.sign('hmac', key, encoder.encode(payload));
            // crypto.subtle returns the signature in base64 format. This must be
            // encoded in hex to match the CryptoProvider contract. We map each byte in
            // the buffer to its corresponding hex octet and then combine into a string.
            const signatureBytes = new Uint8Array(signatureBuffer);
            const signatureHexCodes = new Array(signatureBytes.length);
            for (let i = 0; i < signatureBytes.length; i++) {
                signatureHexCodes[i] = byteHexMapping[signatureBytes[i]];
            }
            return signatureHexCodes.join('');
        });
    }
    /** @override */
    secureCompare(stringA, stringB) {
        return __awaiter(this, void 0, void 0, function* () {
            const bufferA = this.encoder.encode(stringA);
            const bufferB = this.encoder.encode(stringB);
            if (bufferA.length !== bufferB.length) {
                return false;
            }
            const algorithm = { name: 'HMAC', hash: 'SHA-256' };
            const key = (yield crypto.subtle.generateKey(algorithm, false, [
                'sign',
                'verify',
            ]));
            const hmac = yield crypto.subtle.sign(algorithm, key, bufferA);
            const equal = yield crypto.subtle.verify(algorithm, key, hmac, bufferB);
            return equal;
        });
    }
    encrypt(plaintext, key, iv, aad) {
        return __awaiter(this, void 0, void 0, function* () {
            const actualIv = iv || crypto.getRandomValues(new Uint8Array(32));
            const cryptoKey = yield this.subtleCrypto.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
            const encryptParams = {
                name: 'AES-GCM',
                iv: actualIv,
            };
            if (aad) {
                encryptParams.additionalData = aad;
            }
            const encryptedData = yield this.subtleCrypto.encrypt(encryptParams, cryptoKey, plaintext);
            const encryptedBytes = new Uint8Array(encryptedData);
            // Extract tag (last 16 bytes)
            const tagSize = 16;
            const tagStart = encryptedBytes.length - tagSize;
            const tag = encryptedBytes.slice(tagStart);
            const ciphertext = encryptedBytes.slice(0, tagStart);
            return {
                ciphertext,
                iv: actualIv,
                tag,
            };
        });
    }
    decrypt(ciphertext, key, iv, tag, aad) {
        return __awaiter(this, void 0, void 0, function* () {
            // SubtleCrypto expects tag to be appended to ciphertext for AES-GCM
            const combinedData = new Uint8Array(ciphertext.length + tag.length);
            combinedData.set(ciphertext, 0);
            combinedData.set(tag, ciphertext.length);
            const cryptoKey = yield this.subtleCrypto.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
            const decryptParams = {
                name: 'AES-GCM',
                iv,
            };
            if (aad) {
                decryptParams.additionalData = aad;
            }
            const decryptedData = yield this.subtleCrypto.decrypt(decryptParams, cryptoKey, combinedData);
            return new Uint8Array(decryptedData);
        });
    }
    randomBytes(length) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
    }
}
exports.SubtleCryptoProvider = SubtleCryptoProvider;
// Cached mapping of byte to hex representation. We do this once to avoid re-
// computing every time we need to convert the result of a signature to hex.
const byteHexMapping = new Array(256);
for (let i = 0; i < byteHexMapping.length; i++) {
    byteHexMapping[i] = i.toString(16).padStart(2, '0');
}
