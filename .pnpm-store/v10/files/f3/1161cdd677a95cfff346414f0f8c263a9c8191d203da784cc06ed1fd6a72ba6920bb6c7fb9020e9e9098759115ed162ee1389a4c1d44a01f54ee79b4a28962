"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.NodeCryptoProvider = void 0;
const crypto = __importStar(require("crypto"));
const crypto_provider_1 = require("./crypto-provider");
/**
 * `CryptoProvider which uses the Node `crypto` package for its computations.
 */
class NodeCryptoProvider extends crypto_provider_1.CryptoProvider {
    /** @override */
    computeHMACSignature(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('hex');
    }
    /** @override */
    computeHMACSignatureAsync(payload, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            const signature = this.computeHMACSignature(payload, secret);
            return signature;
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
            // Generate a random key for HMAC
            const key = crypto.randomBytes(32); // Generates a 256-bit key
            const hmacA = crypto.createHmac('sha256', key).update(bufferA).digest();
            const hmacB = crypto.createHmac('sha256', key).update(bufferB).digest();
            // Perform a constant time comparison
            return crypto.timingSafeEqual(hmacA, hmacB);
        });
    }
    encrypt(plaintext, key, iv, aad) {
        return __awaiter(this, void 0, void 0, function* () {
            const actualIv = iv || crypto.randomBytes(32);
            const cipher = crypto.createCipheriv('aes-256-gcm', key, actualIv);
            if (aad) {
                cipher.setAAD(Buffer.from(aad));
            }
            const ciphertext = Buffer.concat([
                cipher.update(Buffer.from(plaintext)),
                cipher.final(),
            ]);
            const tag = cipher.getAuthTag();
            return {
                ciphertext: new Uint8Array(ciphertext),
                iv: new Uint8Array(actualIv),
                tag: new Uint8Array(tag),
            };
        });
    }
    decrypt(ciphertext, key, iv, tag, aad) {
        return __awaiter(this, void 0, void 0, function* () {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(Buffer.from(tag));
            if (aad) {
                decipher.setAAD(Buffer.from(aad));
            }
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(ciphertext)),
                decipher.final(),
            ]);
            return new Uint8Array(decrypted);
        });
    }
    randomBytes(length) {
        return new Uint8Array(crypto.randomBytes(length));
    }
}
exports.NodeCryptoProvider = NodeCryptoProvider;
