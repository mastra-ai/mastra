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
exports.SignatureProvider = void 0;
const exceptions_1 = require("../exceptions");
class SignatureProvider {
    constructor(cryptoProvider) {
        this.cryptoProvider = cryptoProvider;
    }
    verifyHeader({ payload, sigHeader, secret, tolerance = 180000, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const [timestamp, signatureHash] = this.getTimestampAndSignatureHash(sigHeader);
            if (!signatureHash || Object.keys(signatureHash).length === 0) {
                throw new exceptions_1.SignatureVerificationException('No signature hash found with expected scheme v1');
            }
            if (parseInt(timestamp, 10) < Date.now() - tolerance) {
                throw new exceptions_1.SignatureVerificationException('Timestamp outside the tolerance zone');
            }
            const expectedSig = yield this.computeSignature(timestamp, payload, secret);
            if ((yield this.cryptoProvider.secureCompare(expectedSig, signatureHash)) ===
                false) {
                throw new exceptions_1.SignatureVerificationException('Signature hash does not match the expected signature hash for payload');
            }
            return true;
        });
    }
    getTimestampAndSignatureHash(sigHeader) {
        const signature = sigHeader;
        const [t, v1] = signature.split(',');
        if (typeof t === 'undefined' || typeof v1 === 'undefined') {
            throw new exceptions_1.SignatureVerificationException('Signature or timestamp missing');
        }
        const { 1: timestamp } = t.split('=');
        const { 1: signatureHash } = v1.split('=');
        return [timestamp, signatureHash];
    }
    computeSignature(timestamp, payload, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            payload = JSON.stringify(payload);
            const signedPayload = `${timestamp}.${payload}`;
            return yield this.cryptoProvider.computeHMACSignatureAsync(signedPayload, secret);
        });
    }
}
exports.SignatureProvider = SignatureProvider;
