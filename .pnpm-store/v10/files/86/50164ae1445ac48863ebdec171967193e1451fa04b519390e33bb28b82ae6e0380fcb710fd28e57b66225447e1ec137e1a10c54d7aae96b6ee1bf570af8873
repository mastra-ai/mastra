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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const subtle_crypto_provider_1 = require("./subtle-crypto-provider");
const webhook_json_1 = __importDefault(require("../../webhooks/fixtures/webhook.json"));
const signature_provider_1 = require("./signature-provider");
describe('SignatureProvider', () => {
    let payload;
    let secret;
    let timestamp;
    let signatureHash;
    const signatureProvider = new signature_provider_1.SignatureProvider(new subtle_crypto_provider_1.SubtleCryptoProvider());
    beforeEach(() => {
        payload = webhook_json_1.default;
        secret = 'secret';
        timestamp = Date.now() * 1000;
        const unhashedString = `${timestamp}.${JSON.stringify(payload)}`;
        signatureHash = crypto_1.default
            .createHmac('sha256', secret)
            .update(unhashedString)
            .digest()
            .toString('hex');
    });
    describe('verifyHeader', () => {
        it('returns true when the signature is valid', () => __awaiter(void 0, void 0, void 0, function* () {
            const sigHeader = `t=${timestamp}, v1=${signatureHash}`;
            const options = { payload, sigHeader, secret };
            const result = yield signatureProvider.verifyHeader(options);
            expect(result).toBeTruthy();
        }));
    });
    describe('getTimestampAndSignatureHash', () => {
        it('returns the timestamp and signature when the signature is valid', () => {
            const sigHeader = `t=${timestamp}, v1=${signatureHash}`;
            const timestampAndSignature = signatureProvider.getTimestampAndSignatureHash(sigHeader);
            expect(timestampAndSignature).toEqual([
                timestamp.toString(),
                signatureHash,
            ]);
        });
    });
    describe('computeSignature', () => {
        it('returns the computed signature', () => __awaiter(void 0, void 0, void 0, function* () {
            const signature = yield signatureProvider.computeSignature(timestamp, payload, secret);
            expect(signature).toEqual(signatureHash);
        }));
    });
    describe('when in an environment that supports SubtleCrypto', () => {
        it('automatically uses the subtle crypto library', () => {
            // tslint:disable-next-line
            expect(signatureProvider['cryptoProvider']).toBeInstanceOf(subtle_crypto_provider_1.SubtleCryptoProvider);
        });
    });
});
