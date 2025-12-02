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
exports.Actions = void 0;
const signature_provider_1 = require("../common/crypto/signature-provider");
const unreachable_1 = require("../common/utils/unreachable");
const action_serializer_1 = require("./serializers/action.serializer");
class Actions {
    constructor(cryptoProvider) {
        this.signatureProvider = new signature_provider_1.SignatureProvider(cryptoProvider);
    }
    get computeSignature() {
        return this.signatureProvider.computeSignature.bind(this.signatureProvider);
    }
    get verifyHeader() {
        return this.signatureProvider.verifyHeader.bind(this.signatureProvider);
    }
    serializeType(type) {
        switch (type) {
            case 'authentication':
                return 'authentication_action_response';
            case 'user_registration':
                return 'user_registration_action_response';
            default:
                return (0, unreachable_1.unreachable)(type);
        }
    }
    signResponse(data, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            let errorMessage;
            const { verdict, type } = data;
            if (verdict === 'Deny' && data.errorMessage) {
                errorMessage = data.errorMessage;
            }
            const responsePayload = Object.assign({ timestamp: Date.now(), verdict }, (verdict === 'Deny' &&
                data.errorMessage && { error_message: errorMessage }));
            const response = {
                object: this.serializeType(type),
                payload: responsePayload,
                signature: yield this.computeSignature(responsePayload.timestamp, responsePayload, secret),
            };
            return response;
        });
    }
    constructAction({ payload, sigHeader, secret, tolerance = 30000, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = { payload, sigHeader, secret, tolerance };
            yield this.verifyHeader(options);
            return (0, action_serializer_1.deserializeAction)(payload);
        });
    }
}
exports.Actions = Actions;
