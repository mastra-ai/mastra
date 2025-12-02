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
exports.Webhooks = void 0;
const serializers_1 = require("../common/serializers");
const signature_provider_1 = require("../common/crypto/signature-provider");
class Webhooks {
    constructor(cryptoProvider) {
        this.signatureProvider = new signature_provider_1.SignatureProvider(cryptoProvider);
    }
    get verifyHeader() {
        return this.signatureProvider.verifyHeader.bind(this.signatureProvider);
    }
    get computeSignature() {
        return this.signatureProvider.computeSignature.bind(this.signatureProvider);
    }
    get getTimestampAndSignatureHash() {
        return this.signatureProvider.getTimestampAndSignatureHash.bind(this.signatureProvider);
    }
    constructEvent({ payload, sigHeader, secret, tolerance = 180000, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = { payload, sigHeader, secret, tolerance };
            yield this.verifyHeader(options);
            const webhookPayload = payload;
            return (0, serializers_1.deserializeEvent)(webhookPayload);
        });
    }
}
exports.Webhooks = Webhooks;
