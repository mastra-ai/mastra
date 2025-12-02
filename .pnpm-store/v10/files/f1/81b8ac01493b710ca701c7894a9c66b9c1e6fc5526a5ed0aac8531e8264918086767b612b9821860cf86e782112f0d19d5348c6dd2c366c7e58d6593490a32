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
const node_crypto_provider_1 = require("./node-crypto-provider");
const subtle_crypto_provider_1 = require("./subtle-crypto-provider");
const webhook_json_1 = __importDefault(require("../../webhooks/fixtures/webhook.json"));
const signature_provider_1 = require("./signature-provider");
describe('CryptoProvider', () => {
    let payload;
    let secret;
    let timestamp;
    let signatureHash;
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
    describe('when computing HMAC signature', () => {
        it('returns the same for the Node crypto and Web Crypto versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const nodeCryptoProvider = new node_crypto_provider_1.NodeCryptoProvider();
            const subtleCryptoProvider = new subtle_crypto_provider_1.SubtleCryptoProvider();
            const stringifiedPayload = JSON.stringify(payload);
            const payloadHMAC = `${timestamp}.${stringifiedPayload}`;
            const nodeCompare = yield nodeCryptoProvider.computeHMACSignatureAsync(payloadHMAC, secret);
            const subtleCompare = yield subtleCryptoProvider.computeHMACSignatureAsync(payloadHMAC, secret);
            expect(nodeCompare).toEqual(subtleCompare);
        }));
    });
    describe('when securely comparing', () => {
        it('returns the same for the Node crypto and Web Crypto versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const nodeCryptoProvider = new node_crypto_provider_1.NodeCryptoProvider();
            const subtleCryptoProvider = new subtle_crypto_provider_1.SubtleCryptoProvider();
            const signatureProvider = new signature_provider_1.SignatureProvider(subtleCryptoProvider);
            const signature = yield signatureProvider.computeSignature(timestamp, payload, secret);
            expect(nodeCryptoProvider.secureCompare(signature, signatureHash)).toEqual(subtleCryptoProvider.secureCompare(signature, signatureHash));
            expect(nodeCryptoProvider.secureCompare(signature, 'foo')).toEqual(subtleCryptoProvider.secureCompare(signature, 'foo'));
        }));
    });
});
