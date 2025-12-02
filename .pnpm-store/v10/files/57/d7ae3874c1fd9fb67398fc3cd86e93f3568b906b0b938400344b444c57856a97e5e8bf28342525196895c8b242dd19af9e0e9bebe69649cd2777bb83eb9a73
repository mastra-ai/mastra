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
exports.Mfa = void 0;
const serializers_1 = require("./serializers");
class Mfa {
    constructor(workos) {
        this.workos = workos;
    }
    deleteFactor(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/auth/factors/${id}`);
        });
    }
    getFactor(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/auth/factors/${id}`);
            return (0, serializers_1.deserializeFactor)(data);
        });
    }
    enrollFactor(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/auth/factors/enroll', Object.assign({ type: options.type }, (() => {
                switch (options.type) {
                    case 'sms':
                        return {
                            phone_number: options.phoneNumber,
                        };
                    case 'totp':
                        return {
                            totp_issuer: options.issuer,
                            totp_user: options.user,
                        };
                    default:
                        return {};
                }
            })()));
            return (0, serializers_1.deserializeFactorWithSecrets)(data);
        });
    }
    challengeFactor(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/auth/factors/${options.authenticationFactorId}/challenge`, {
                sms_template: 'smsTemplate' in options ? options.smsTemplate : undefined,
            });
            return (0, serializers_1.deserializeChallenge)(data);
        });
    }
    /**
     * @deprecated Please use `verifyChallenge` instead.
     */
    verifyFactor(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.verifyChallenge(options);
        });
    }
    verifyChallenge(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/auth/challenges/${options.authenticationChallengeId}/verify`, {
                code: options.code,
            });
            return (0, serializers_1.deserializeVerifyResponse)(data);
        });
    }
}
exports.Mfa = Mfa;
