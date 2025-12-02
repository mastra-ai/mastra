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
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
const test_utils_1 = require("../common/utils/test-utils");
const exceptions_1 = require("../common/exceptions");
const workos_1 = require("../workos");
describe('MFA', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('getFactor', () => {
        it('returns the requested factor', () => __awaiter(void 0, void 0, void 0, function* () {
            const factor = {
                object: 'authentication_factor',
                id: 'auth_factor_1234',
                createdAt: '2022-03-15T20:39:19.892Z',
                updatedAt: '2022-03-15T20:39:19.892Z',
                type: 'totp',
                totp: {
                    issuer: 'WorkOS',
                    user: 'some_user',
                },
            };
            const factorResponse = {
                object: 'authentication_factor',
                id: 'auth_factor_1234',
                created_at: '2022-03-15T20:39:19.892Z',
                updated_at: '2022-03-15T20:39:19.892Z',
                type: 'totp',
                totp: {
                    issuer: 'WorkOS',
                    user: 'some_user',
                },
            };
            (0, test_utils_1.fetchOnce)(factorResponse);
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            const subject = yield workos.mfa.getFactor('test_123');
            expect(subject).toEqual(factor);
        }));
    });
    describe('deleteFactor', () => {
        it('sends request to delete a Factor', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            yield workos.mfa.deleteFactor('conn_123');
            expect((0, test_utils_1.fetchURL)()).toContain('/auth/factors/conn_123');
        }));
    });
    describe('enrollFactor', () => {
        describe('with generic', () => {
            it('enrolls a factor with generic type', () => __awaiter(void 0, void 0, void 0, function* () {
                const factor = {
                    object: 'authentication_factor',
                    id: 'auth_factor_1234',
                    createdAt: '2022-03-15T20:39:19.892Z',
                    updatedAt: '2022-03-15T20:39:19.892Z',
                    type: 'generic_otp',
                };
                const factorResponse = {
                    object: 'authentication_factor',
                    id: 'auth_factor_1234',
                    created_at: '2022-03-15T20:39:19.892Z',
                    updated_at: '2022-03-15T20:39:19.892Z',
                    type: 'generic_otp',
                };
                (0, test_utils_1.fetchOnce)(factorResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const subject = yield workos.mfa.enrollFactor({
                    type: 'generic_otp',
                });
                expect(subject).toEqual(factor);
            }));
        });
        describe('with totp', () => {
            it('enrolls a factor with totp type', () => __awaiter(void 0, void 0, void 0, function* () {
                const factor = {
                    object: 'authentication_factor',
                    id: 'auth_factor_1234',
                    createdAt: '2022-03-15T20:39:19.892Z',
                    updatedAt: '2022-03-15T20:39:19.892Z',
                    type: 'totp',
                    totp: {
                        issuer: 'WorkOS',
                        qrCode: 'qr-code-test',
                        secret: 'secret-test',
                        uri: 'uri-test',
                        user: 'some_user',
                    },
                };
                const factorResponse = {
                    object: 'authentication_factor',
                    id: 'auth_factor_1234',
                    created_at: '2022-03-15T20:39:19.892Z',
                    updated_at: '2022-03-15T20:39:19.892Z',
                    type: 'totp',
                    totp: {
                        issuer: 'WorkOS',
                        qr_code: 'qr-code-test',
                        secret: 'secret-test',
                        uri: 'uri-test',
                        user: 'some_user',
                    },
                };
                (0, test_utils_1.fetchOnce)(factorResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const subject = yield workos.mfa.enrollFactor({
                    type: 'totp',
                    issuer: 'WorkOS',
                    user: 'some_user',
                });
                expect(subject).toEqual(factor);
            }));
        });
        describe('with sms', () => {
            it('enrolls a factor with sms type', () => __awaiter(void 0, void 0, void 0, function* () {
                const factor = {
                    object: 'authentication_factor',
                    id: 'auth_factor_1234',
                    createdAt: '2022-03-15T20:39:19.892Z',
                    updatedAt: '2022-03-15T20:39:19.892Z',
                    type: 'sms',
                    sms: {
                        phoneNumber: '+15555555555',
                    },
                };
                const factorResponse = {
                    object: 'authentication_factor',
                    id: 'auth_factor_1234',
                    created_at: '2022-03-15T20:39:19.892Z',
                    updated_at: '2022-03-15T20:39:19.892Z',
                    type: 'sms',
                    sms: {
                        phone_number: '+15555555555',
                    },
                };
                (0, test_utils_1.fetchOnce)(factorResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const subject = yield workos.mfa.enrollFactor({
                    type: 'sms',
                    phoneNumber: '+1555555555',
                });
                expect(subject).toEqual(factor);
            }));
            describe('when phone number is invalid', () => {
                it('throws an exception', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)({
                        message: `Phone number is invalid: 'foo'`,
                        code: 'invalid_phone_number',
                    }, {
                        status: 422,
                        headers: { 'X-Request-ID': 'req_123' },
                    });
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                        apiHostname: 'api.workos.dev',
                    });
                    yield expect(workos.mfa.enrollFactor({
                        type: 'sms',
                        phoneNumber: 'foo',
                    })).rejects.toThrow(exceptions_1.UnprocessableEntityException);
                }));
            });
        });
    });
    describe('challengeFactor', () => {
        describe('with no sms template', () => {
            it('challenge a factor with no sms template', () => __awaiter(void 0, void 0, void 0, function* () {
                const challenge = {
                    object: 'authentication_challenge',
                    id: 'auth_challenge_1234',
                    createdAt: '2022-03-15T20:39:19.892Z',
                    updatedAt: '2022-03-15T20:39:19.892Z',
                    expiresAt: '2022-03-15T21:39:19.892Z',
                    code: '12345',
                    authenticationFactorId: 'auth_factor_1234',
                };
                const challengeResponse = {
                    object: 'authentication_challenge',
                    id: 'auth_challenge_1234',
                    created_at: '2022-03-15T20:39:19.892Z',
                    updated_at: '2022-03-15T20:39:19.892Z',
                    expires_at: '2022-03-15T21:39:19.892Z',
                    code: '12345',
                    authentication_factor_id: 'auth_factor_1234',
                };
                (0, test_utils_1.fetchOnce)(challengeResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const subject = yield workos.mfa.challengeFactor({
                    authenticationFactorId: 'auth_factor_1234',
                });
                expect(subject).toEqual(challenge);
            }));
        });
        describe('with sms template', () => {
            it('challenge a factor with sms template', () => __awaiter(void 0, void 0, void 0, function* () {
                const challenge = {
                    object: 'authentication_challenge',
                    id: 'auth_challenge_1234',
                    createdAt: '2022-03-15T20:39:19.892Z',
                    updatedAt: '2022-03-15T20:39:19.892Z',
                    expiresAt: '2022-03-15T21:39:19.892Z',
                    code: '12345',
                    authenticationFactorId: 'auth_factor_1234',
                };
                const challengeResponse = {
                    object: 'authentication_challenge',
                    id: 'auth_challenge_1234',
                    created_at: '2022-03-15T20:39:19.892Z',
                    updated_at: '2022-03-15T20:39:19.892Z',
                    expires_at: '2022-03-15T21:39:19.892Z',
                    code: '12345',
                    authentication_factor_id: 'auth_factor_1234',
                };
                (0, test_utils_1.fetchOnce)(challengeResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const subject = yield workos.mfa.challengeFactor({
                    authenticationFactorId: 'auth_factor_1234',
                    smsTemplate: 'This is your code: 12345',
                });
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    sms_template: 'This is your code: 12345',
                });
                expect(subject).toEqual(challenge);
            }));
        });
    });
    describe('verifyChallenge', () => {
        describe('verify with successful response', () => {
            it('verifies a successful factor', () => __awaiter(void 0, void 0, void 0, function* () {
                const verifyResponse = {
                    challenge: {
                        object: 'authentication_challenge',
                        id: 'auth_challenge_1234',
                        createdAt: '2022-03-15T20:39:19.892Z',
                        updatedAt: '2022-03-15T20:39:19.892Z',
                        expiresAt: '2022-03-15T21:39:19.892Z',
                        code: '12345',
                        authenticationFactorId: 'auth_factor_1234',
                    },
                    valid: true,
                };
                const verifyResponseResponse = {
                    challenge: {
                        object: 'authentication_challenge',
                        id: 'auth_challenge_1234',
                        created_at: '2022-03-15T20:39:19.892Z',
                        updated_at: '2022-03-15T20:39:19.892Z',
                        expires_at: '2022-03-15T21:39:19.892Z',
                        code: '12345',
                        authentication_factor_id: 'auth_factor_1234',
                    },
                    valid: true,
                };
                (0, test_utils_1.fetchOnce)(verifyResponseResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const subject = yield workos.mfa.verifyChallenge({
                    authenticationChallengeId: 'auth_challenge_1234',
                    code: '12345',
                });
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    code: '12345',
                });
                expect(subject).toEqual(verifyResponse);
            }));
        });
        describe('when the challenge has been previously verified', () => {
            it('throws an exception', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    message: `The authentication challenge '12345' has already been verified.`,
                    code: 'authentication_challenge_previously_verified',
                }, {
                    status: 422,
                    headers: { 'X-Request-ID': 'req_123' },
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                yield expect(workos.mfa.verifyChallenge({
                    authenticationChallengeId: 'auth_challenge_1234',
                    code: '12345',
                })).rejects.toThrow(exceptions_1.UnprocessableEntityException);
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    code: '12345',
                });
            }));
        });
        describe('when the challenge has expired', () => {
            it('throws an exception', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    message: `The authentication challenge '12345' has expired.`,
                    code: 'authentication_challenge_expired',
                }, {
                    status: 422,
                    headers: { 'X-Request-ID': 'req_123' },
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                yield expect(workos.mfa.verifyChallenge({
                    authenticationChallengeId: 'auth_challenge_1234',
                    code: '12345',
                })).rejects.toThrow(exceptions_1.UnprocessableEntityException);
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    code: '12345',
                });
            }));
            it('exception has code', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    message: `The authentication challenge '12345' has expired.`,
                    code: 'authentication_challenge_expired',
                }, {
                    status: 422,
                    headers: { 'X-Request-ID': 'req_123' },
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                try {
                    yield workos.mfa.verifyChallenge({
                        authenticationChallengeId: 'auth_challenge_1234',
                        code: '12345',
                    });
                }
                catch (error) {
                    expect(error).toMatchObject({
                        code: 'authentication_challenge_expired',
                    });
                }
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    code: '12345',
                });
            }));
        });
    });
});
