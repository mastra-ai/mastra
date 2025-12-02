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
const workos_1 = require("../workos");
const authentication_action_context_json_1 = __importDefault(require("./fixtures/authentication-action-context.json"));
const user_registration_action_context_json_1 = __importDefault(require("./fixtures/user-registration-action-context.json"));
const node_crypto_provider_1 = require("../common/crypto/node-crypto-provider");
const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
describe('Actions', () => {
    let secret;
    beforeEach(() => {
        secret = 'secret';
    });
    const makeSigHeader = (payload, secret) => {
        const timestamp = Date.now() * 1000;
        const unhashedString = `${timestamp}.${JSON.stringify(payload)}`;
        const signatureHash = crypto_1.default
            .createHmac('sha256', secret)
            .update(unhashedString)
            .digest()
            .toString('hex');
        return `t=${timestamp}, v1=${signatureHash}`;
    };
    describe('signResponse', () => {
        describe('type: authentication', () => {
            it('returns a signed response', () => __awaiter(void 0, void 0, void 0, function* () {
                const nodeCryptoProvider = new node_crypto_provider_1.NodeCryptoProvider();
                const response = yield workos.actions.signResponse({
                    type: 'authentication',
                    verdict: 'Allow',
                }, secret);
                const signedPayload = `${response.payload.timestamp}.${JSON.stringify(response.payload)}`;
                const expectedSig = yield nodeCryptoProvider.computeHMACSignatureAsync(signedPayload, secret);
                expect(response.object).toEqual('authentication_action_response');
                expect(response.payload.verdict).toEqual('Allow');
                expect(response.payload.timestamp).toBeGreaterThan(0);
                expect(response.signature).toEqual(expectedSig);
            }));
        });
        describe('type: user_registration', () => {
            it('returns a signed response', () => __awaiter(void 0, void 0, void 0, function* () {
                const nodeCryptoProvider = new node_crypto_provider_1.NodeCryptoProvider();
                const response = yield workos.actions.signResponse({
                    type: 'user_registration',
                    verdict: 'Deny',
                    errorMessage: 'User already exists',
                }, secret);
                const signedPayload = `${response.payload.timestamp}.${JSON.stringify(response.payload)}`;
                const expectedSig = yield nodeCryptoProvider.computeHMACSignatureAsync(signedPayload, secret);
                expect(response.object).toEqual('user_registration_action_response');
                expect(response.payload.verdict).toEqual('Deny');
                expect(response.payload.timestamp).toBeGreaterThan(0);
                expect(response.signature).toEqual(expectedSig);
            }));
        });
    });
    describe('verifyHeader', () => {
        it('verifies the header', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.actions.verifyHeader({
                payload: authentication_action_context_json_1.default,
                sigHeader: makeSigHeader(authentication_action_context_json_1.default, secret),
                secret,
            })).resolves.not.toThrow();
        }));
        it('throws when the header is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.actions.verifyHeader({
                payload: authentication_action_context_json_1.default,
                sigHeader: 't=123, v1=123',
                secret,
            })).rejects.toThrow();
        }));
    });
    describe('constructAction', () => {
        it('returns an authentication action', () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = authentication_action_context_json_1.default;
            const sigHeader = makeSigHeader(payload, secret);
            const action = yield workos.actions.constructAction({
                payload,
                sigHeader,
                secret,
            });
            expect(action).toEqual({
                id: '01JATCMZJY26PQ59XT9BNT0FNN',
                user: {
                    object: 'user',
                    id: '01JATCHZVEC5EPANDPEZVM68Y9',
                    email: 'jane@foocorp.com',
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emailVerified: true,
                    profilePictureUrl: 'https://example.com/jane.jpg',
                    createdAt: '2024-10-22T17:12:50.746Z',
                    updatedAt: '2024-10-22T17:12:50.746Z',
                    externalId: null,
                    metadata: {},
                },
                ipAddress: '50.141.123.10',
                userAgent: 'Mozilla/5.0',
                deviceFingerprint: 'notafingerprint',
                issuer: 'test',
                object: 'authentication_action_context',
                organization: {
                    object: 'organization',
                    id: '01JATCMZJY26PQ59XT9BNT0FNN',
                    name: 'Foo Corp',
                    allowProfilesOutsideOrganization: false,
                    domains: [],
                    createdAt: '2024-10-22T17:12:50.746Z',
                    updatedAt: '2024-10-22T17:12:50.746Z',
                    externalId: null,
                    metadata: {},
                },
                organizationMembership: {
                    object: 'organization_membership',
                    id: '01JATCNVYCHT1SZGENR4QTXKRK',
                    userId: '01JATCHZVEC5EPANDPEZVM68Y9',
                    organizationId: '01JATCMZJY26PQ59XT9BNT0FNN',
                    role: {
                        slug: 'member',
                    },
                    status: 'active',
                    createdAt: '2024-10-22T17:12:50.746Z',
                    updatedAt: '2024-10-22T17:12:50.746Z',
                },
            });
        }));
        it('returns a user registration action', () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = user_registration_action_context_json_1.default;
            const sigHeader = makeSigHeader(payload, secret);
            const action = yield workos.actions.constructAction({
                payload,
                sigHeader,
                secret,
            });
            expect(action).toEqual({
                id: '01JATCMZJY26PQ59XT9BNT0FNN',
                object: 'user_registration_action_context',
                userData: {
                    object: 'user_data',
                    email: 'jane@foocorp.com',
                    firstName: 'Jane',
                    lastName: 'Doe',
                },
                ipAddress: '50.141.123.10',
                userAgent: 'Mozilla/5.0',
                deviceFingerprint: 'notafingerprint',
                invitation: expect.objectContaining({
                    object: 'invitation',
                    id: '01JBVZWH8HJ855YZ5BWHG1WNZN',
                    email: 'jane@foocorp.com',
                    expiresAt: '2024-10-22T17:12:50.746Z',
                    createdAt: '2024-10-21T17:12:50.746Z',
                    updatedAt: '2024-10-21T17:12:50.746Z',
                    acceptedAt: '2024-10-22T17:13:50.746Z',
                }),
            });
        }));
    });
});
