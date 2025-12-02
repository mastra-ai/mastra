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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
const test_utils_1 = require("../common/utils/test-utils");
const workos_1 = require("../workos");
const deactivate_organization_membership_json_1 = __importDefault(require("./fixtures/deactivate-organization-membership.json"));
const email_verification_json_1 = __importDefault(require("./fixtures/email_verification.json"));
const invitation_json_1 = __importDefault(require("./fixtures/invitation.json"));
const list_factors_json_1 = __importDefault(require("./fixtures/list-factors.json"));
const list_invitations_json_1 = __importDefault(require("./fixtures/list-invitations.json"));
const list_organization_memberships_json_1 = __importDefault(require("./fixtures/list-organization-memberships.json"));
const list_sessions_json_1 = __importDefault(require("./fixtures/list-sessions.json"));
const list_user_feature_flags_json_1 = __importDefault(require("./fixtures/list-user-feature-flags.json"));
const list_users_json_1 = __importDefault(require("./fixtures/list-users.json"));
const magic_auth_json_1 = __importDefault(require("./fixtures/magic_auth.json"));
const organization_membership_json_1 = __importDefault(require("./fixtures/organization-membership.json"));
const password_reset_json_1 = __importDefault(require("./fixtures/password_reset.json"));
const user_json_1 = __importDefault(require("./fixtures/user.json"));
const identity_json_1 = __importDefault(require("./fixtures/identity.json"));
const jose = __importStar(require("jose"));
const iron_session_1 = require("iron-session");
const userId = 'user_01H5JQDV7R7ATEYZDEG0W5PRYS';
const organizationMembershipId = 'om_01H5JQDV7R7ATEYZDEG0W5PRYS';
const emailVerificationId = 'email_verification_01H5JQDV7R7ATEYZDEG0W5PRYS';
const invitationId = 'invitation_01H5JQDV7R7ATEYZDEG0W5PRYS';
const invitationToken = 'Z1uX3RbwcIl5fIGJJJCXXisdI';
const magicAuthId = 'magic_auth_01H5JQDV7R7ATEYZDEG0W5PRYS';
const passwordResetId = 'password_reset_01H5JQDV7R7ATEYZDEG0W5PRYS';
describe('UserManagement', () => {
    let workos;
    beforeAll(() => {
        workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
            apiHostname: 'api.workos.test',
            clientId: 'proj_123',
        });
    });
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('getUser', () => {
        it('sends a Get User request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            const user = yield workos.userManagement.getUser(userId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}`);
            expect(user).toMatchObject({
                object: 'user',
                id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'test01@example.com',
                profilePictureUrl: 'https://example.com/profile_picture.jpg',
                firstName: 'Test 01',
                lastName: 'User',
                emailVerified: true,
                lastSignInAt: '2023-07-18T02:07:19.911Z',
                locale: 'en-US',
            });
        }));
    });
    describe('getUserByExternalId', () => {
        it('sends a Get User request', () => __awaiter(void 0, void 0, void 0, function* () {
            const externalId = 'user_external_id';
            (0, test_utils_1.fetchOnce)(Object.assign(Object.assign({}, user_json_1.default), { external_id: externalId }));
            const user = yield workos.userManagement.getUserByExternalId(externalId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/external_id/${externalId}`);
            expect(user).toMatchObject({
                object: 'user',
                id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'test01@example.com',
                profilePictureUrl: 'https://example.com/profile_picture.jpg',
                firstName: 'Test 01',
                lastName: 'User',
                emailVerified: true,
                lastSignInAt: '2023-07-18T02:07:19.911Z',
                locale: 'en-US',
                externalId,
            });
        }));
    });
    describe('listUsers', () => {
        it('lists users', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_users_json_1.default);
            const userList = yield workos.userManagement.listUsers();
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/users');
            expect(userList).toMatchObject({
                object: 'list',
                data: [
                    {
                        object: 'user',
                        email: 'test01@example.com',
                    },
                ],
                listMetadata: {
                    before: null,
                    after: null,
                },
            });
        }));
        it('sends the correct params when filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_users_json_1.default);
            yield workos.userManagement.listUsers({
                email: 'foo@example.com',
                organizationId: 'org_someorg',
                after: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                limit: 10,
            });
            expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                email: 'foo@example.com',
                organization_id: 'org_someorg',
                after: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                limit: '10',
                order: 'desc',
            });
        }));
    });
    describe('createUser', () => {
        it('sends a Create User request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            const user = yield workos.userManagement.createUser({
                email: 'test01@example.com',
                password: 'extra-secure',
                firstName: 'Test 01',
                lastName: 'User',
                emailVerified: true,
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/users');
            expect(user).toMatchObject({
                object: 'user',
                email: 'test01@example.com',
                firstName: 'Test 01',
                lastName: 'User',
                emailVerified: true,
                profilePictureUrl: 'https://example.com/profile_picture.jpg',
                createdAt: '2023-07-18T02:07:19.911Z',
                updatedAt: '2023-07-18T02:07:19.911Z',
            });
        }));
        it('adds metadata to the request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            yield workos.userManagement.createUser({
                email: 'test01@example.com',
                metadata: { key: 'value' },
            });
            expect((0, test_utils_1.fetchBody)()).toMatchObject({
                metadata: { key: 'value' },
            });
        }));
    });
    describe('authenticateUserWithMagicAuth', () => {
        it('sends a magic auth authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithMagicAuth({
                clientId: 'proj_whatever',
                code: '123456',
                email: user_json_1.default.email,
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithMagicAuth({
                        clientId: 'proj_whatever',
                        code: '123456',
                        email: user_json_1.default.email,
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithMagicAuth({
                        clientId: 'proj_whatever',
                        code: '123456',
                        email: user_json_1.default.email,
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithPassword', () => {
        it('sends an password authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithPassword({
                clientId: 'proj_whatever',
                email: 'test01@example.com',
                password: 'extra-secure',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithPassword({
                        clientId: 'proj_whatever',
                        email: 'test01@example.com',
                        password: 'extra-secure',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithPassword({
                        clientId: 'proj_whatever',
                        email: 'test01@example.com',
                        password: 'extra-secure',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithCode', () => {
        it('sends a token authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithCode({
                clientId: 'proj_whatever',
                code: 'or this',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                client_secret: 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU',
                code: 'or this',
                grant_type: 'authorization_code',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        it('sends a token authentication request when including the code_verifier', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithCode({
                clientId: 'proj_whatever',
                code: 'or this',
                codeVerifier: 'code_verifier_value',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                client_secret: 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU',
                code: 'or this',
                code_verifier: 'code_verifier_value',
                grant_type: 'authorization_code',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        it('deserializes authentication_method', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                user: user_json_1.default,
                authentication_method: 'Password',
            });
            const resp = yield workos.userManagement.authenticateWithCode({
                clientId: 'proj_whatever',
                code: 'or this',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
                authenticationMethod: 'Password',
            });
        }));
        describe('when the code is for an impersonator', () => {
            it('deserializes the impersonator metadata', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    impersonator: {
                        email: 'admin@example.com',
                        reason: 'A good reason.',
                    },
                });
                const resp = yield workos.userManagement.authenticateWithCode({
                    clientId: 'proj_whatever',
                    code: 'or this',
                });
                expect(resp).toMatchObject({
                    user: {
                        email: 'test01@example.com',
                    },
                    impersonator: {
                        email: 'admin@example.com',
                        reason: 'A good reason.',
                    },
                });
            }));
        });
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithCode({
                        clientId: 'proj_whatever',
                        code: 'or this',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithCode({
                        clientId: 'proj_whatever',
                        code: 'or this',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
        describe('when oauth_tokens is present', () => {
            it('deserializes oauth_tokens', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    oauth_tokens: {
                        access_token: 'access_token',
                        refresh_token: 'refresh',
                        expires_at: 123,
                        scopes: ['read:users'],
                    },
                });
                const resp = yield workos.userManagement.authenticateWithCode({
                    clientId: 'proj_whatever',
                    code: 'or this',
                });
                expect(resp).toMatchObject({
                    user: {
                        email: 'test01@example.com',
                    },
                    oauthTokens: {
                        accessToken: 'access_token',
                        refreshToken: 'refresh',
                        expiresAt: 123,
                        scopes: ['read:users'],
                    },
                });
            }));
        });
    });
    describe('authenticateWithCodeAndVerifier', () => {
        it('sends a token authentication request with required code_verifier', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithCodeAndVerifier({
                clientId: 'proj_whatever',
                code: 'auth_code_123',
                codeVerifier: 'required_code_verifier',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                code: 'auth_code_123',
                code_verifier: 'required_code_verifier',
                grant_type: 'authorization_code',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        it('sends a token authentication request with invitation token', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithCodeAndVerifier({
                clientId: 'proj_whatever',
                code: 'auth_code_123',
                codeVerifier: 'required_code_verifier',
                invitationToken: 'invitation_123',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                code: 'auth_code_123',
                code_verifier: 'required_code_verifier',
                invitation_token: 'invitation_123',
                grant_type: 'authorization_code',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithCodeAndVerifier({
                        clientId: 'proj_whatever',
                        code: 'auth_code_123',
                        codeVerifier: 'required_code_verifier',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithCodeAndVerifier({
                        clientId: 'proj_whatever',
                        code: 'auth_code_123',
                        codeVerifier: 'required_code_verifier',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithRefreshToken', () => {
        it('sends a refresh_token authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                user: user_json_1.default,
                access_token: 'access_token',
                refresh_token: 'refreshToken2',
            });
            const resp = yield workos.userManagement.authenticateWithRefreshToken({
                clientId: 'proj_whatever',
                refreshToken: 'refresh_token1',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                client_secret: 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU',
                refresh_token: 'refresh_token1',
                grant_type: 'refresh_token',
            });
            expect(resp).toMatchObject({
                accessToken: 'access_token',
                refreshToken: 'refreshToken2',
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithRefreshToken({
                        clientId: 'proj_whatever',
                        refreshToken: 'refresh_token1',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithRefreshToken({
                        clientId: 'proj_whatever',
                        refreshToken: 'refresh_token1',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithTotp', () => {
        it('sends a token authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithTotp({
                clientId: 'proj_whatever',
                code: 'or this',
                authenticationChallengeId: 'auth_challenge_01H96FETXGTW1QMBSBT2T36PW0',
                pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                code: 'or this',
                client_secret: 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU',
                grant_type: 'urn:workos:oauth:grant-type:mfa-totp',
                authentication_challenge_id: 'auth_challenge_01H96FETXGTW1QMBSBT2T36PW0',
                pending_authentication_token: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithTotp({
                        clientId: 'proj_whatever',
                        code: 'or this',
                        authenticationChallengeId: 'auth_challenge_01H96FETXGTW1QMBSBT2T36PW0',
                        pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithTotp({
                        clientId: 'proj_whatever',
                        code: 'or this',
                        authenticationChallengeId: 'auth_challenge_01H96FETXGTW1QMBSBT2T36PW0',
                        pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithEmailVerification', () => {
        it('sends an email verification authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithEmailVerification({
                clientId: 'proj_whatever',
                code: 'or this',
                pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                code: 'or this',
                client_secret: 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU',
                grant_type: 'urn:workos:oauth:grant-type:email-verification:code',
                pending_authentication_token: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithEmailVerification({
                        clientId: 'proj_whatever',
                        code: 'or this',
                        pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithEmailVerification({
                        clientId: 'proj_whatever',
                        code: 'or this',
                        pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithOrganizationSelection', () => {
        it('sends an Organization Selection Authentication request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.authenticateWithOrganizationSelection({
                clientId: 'proj_whatever',
                pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                organizationId: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/authenticate');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                client_id: 'proj_whatever',
                client_secret: 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU',
                grant_type: 'urn:workos:oauth:grant-type:organization-selection',
                pending_authentication_token: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                organization_id: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
            });
            expect(resp).toMatchObject({
                user: {
                    email: 'test01@example.com',
                },
            });
        }));
        describe('when sealSession = true', () => {
            beforeEach(() => {
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                });
            });
            describe('when the cookie password is undefined', () => {
                it('throws an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    yield expect(workos.userManagement.authenticateWithOrganizationSelection({
                        clientId: 'proj_whatever',
                        pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                        organizationId: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        session: { sealSession: true },
                    })).rejects.toThrow('Cookie password is required');
                }));
            });
            describe('when successfully authenticated', () => {
                it('returns the sealed session data', () => __awaiter(void 0, void 0, void 0, function* () {
                    const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                    const response = yield workos.userManagement.authenticateWithOrganizationSelection({
                        clientId: 'proj_whatever',
                        pendingAuthenticationToken: 'cTDQJTTkTkkVYxQUlKBIxEsFs',
                        organizationId: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        session: { sealSession: true, cookiePassword },
                    });
                    expect(response).toEqual({
                        sealedSession: expect.any(String),
                        accessToken: expect.any(String),
                        authenticationMethod: undefined,
                        impersonator: undefined,
                        organizationId: undefined,
                        refreshToken: undefined,
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    });
                }));
            });
        });
    });
    describe('authenticateWithSessionCookie', () => {
        beforeEach(() => {
            // Mock createRemoteJWKSet
            jest
                .spyOn(jose, 'createRemoteJWKSet')
                .mockImplementation((_url, _options) => {
                // This function simulates the token verification process
                const verifyFunction = (_protectedHeader, _token) => {
                    return Promise.resolve({
                        type: 'public',
                    });
                };
                // Return an object that includes the verify function and the additional expected properties
                return {
                    __call__: verifyFunction,
                    coolingDown: false,
                    fresh: false,
                    reloading: false,
                    reload: jest.fn().mockResolvedValue(undefined),
                    jwks: () => undefined,
                };
            });
        });
        it('throws an error when the cookie password is undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData: 'session_cookie',
            })).rejects.toThrow('Cookie password is required');
        }));
        it('returns authenticated = false when the session cookie is empty', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData: '',
                cookiePassword: 'secret',
            })).resolves.toEqual({
                authenticated: false,
                reason: 'no_session_cookie_provided',
            });
        }));
        it('returns authenticated = false when session cookie is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData: 'thisisacookie',
                cookiePassword: 'secret',
            })).resolves.toEqual({
                authenticated: false,
                reason: 'invalid_session_cookie',
            });
        }));
        it('returns authenticated = false when session cookie cannot be unsealed', () => __awaiter(void 0, void 0, void 0, function* () {
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'abc123',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData,
                cookiePassword: 'secretpasswordwhichisalsolongbutnottherightone',
            })).resolves.toEqual({
                authenticated: false,
                reason: 'invalid_session_cookie',
            });
        }));
        it('returns authenticated = false when the JWT is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(jose, 'jwtVerify').mockImplementationOnce(() => {
                throw new Error('Invalid JWT');
            });
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'abc123',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData,
                cookiePassword,
            })).resolves.toEqual({ authenticated: false, reason: 'invalid_jwt' });
        }));
        it('returns the JWT claims when provided a valid JWT', () => __awaiter(void 0, void 0, void 0, function* () {
            jest
                .spyOn(jose, 'jwtVerify')
                .mockResolvedValue({});
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const accessToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdXRoZW50aWNhdGVkIjp0cnVlLCJpbXBlcnNvbmF0b3IiOnsiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJlYXNvbiI6InRlc3QifSwic2lkIjoic2Vzc2lvbl8xMjMiLCJvcmdfaWQiOiJvcmdfMTIzIiwicm9sZSI6Im1lbWJlciIsInBlcm1pc3Npb25zIjpbInBvc3RzOmNyZWF0ZSIsInBvc3RzOmRlbGV0ZSJdLCJlbnRpdGxlbWVudHMiOlsiYXVkaXQtbG9ncyJdLCJmZWF0dXJlX2ZsYWdzIjpbImRhcmstbW9kZSIsImJldGEtZmVhdHVyZXMiXSwidXNlciI6eyJvYmplY3QiOiJ1c2VyIiwiaWQiOiJ1c2VyXzAxSDVKUURWN1I3QVRFWVpERUcwVzVQUllTIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn19.YVNjR8S2xGn2jAoLuEcBQNJ1_xY3OzjRE1-BK0zjfQE';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken,
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData,
                cookiePassword,
            })).resolves.toEqual({
                authenticated: true,
                sessionId: 'session_123',
                organizationId: 'org_123',
                role: 'member',
                permissions: ['posts:create', 'posts:delete'],
                entitlements: ['audit-logs'],
                featureFlags: ['dark-mode', 'beta-features'],
                user: expect.objectContaining({
                    email: 'test@example.com',
                }),
                accessToken,
            });
        }));
        it('returns the JWT claims when provided a valid JWT with multiple roles', () => __awaiter(void 0, void 0, void 0, function* () {
            jest
                .spyOn(jose, 'jwtVerify')
                .mockResolvedValue({});
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const accessToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdXRoZW50aWNhdGVkIjp0cnVlLCJpbXBlcnNvbmF0b3IiOnsiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJlYXNvbiI6InRlc3QifSwic2lkIjoic2Vzc2lvbl8xMjMiLCJvcmdfaWQiOiJvcmdfMTIzIiwicm9sZSI6ImFkbWluIiwicm9sZXMiOlsiYWRtaW4iLCJtZW1iZXIiXSwicGVybWlzc2lvbnMiOlsicG9zdHM6Y3JlYXRlIiwicG9zdHM6ZGVsZXRlIl0sImVudGl0bGVtZW50cyI6WyJhdWRpdC1sb2dzIl0sImZlYXR1cmVfZmxhZ3MiOlsiZGFyay1tb2RlIiwiYmV0YS1mZWF0dXJlcyJdLCJ1c2VyIjp7Im9iamVjdCI6InVzZXIiLCJpZCI6InVzZXJfMDFINUpRRFY3UjdBVEVZWkRFRzBXNVBSWVMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifX0.hsMptIB7PmbF5pxxtgTtCdUyOAhA11ZIAP-JY5zU5fE';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken,
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.authenticateWithSessionCookie({
                sessionData,
                cookiePassword,
            })).resolves.toEqual({
                authenticated: true,
                sessionId: 'session_123',
                organizationId: 'org_123',
                role: 'admin',
                roles: ['admin', 'member'],
                permissions: ['posts:create', 'posts:delete'],
                entitlements: ['audit-logs'],
                featureFlags: ['dark-mode', 'beta-features'],
                user: expect.objectContaining({
                    email: 'test@example.com',
                }),
                accessToken,
            });
        }));
    });
    describe('refreshAndSealSessionData', () => {
        it('throws an error when the cookie password is undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.refreshAndSealSessionData({
                sessionData: 'session_cookie',
            })).rejects.toThrow('Cookie password is required');
        }));
        it('returns authenticated = false when the session cookie is empty', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.refreshAndSealSessionData({
                sessionData: '',
                cookiePassword: 'secret',
            })).resolves.toEqual({
                authenticated: false,
                reason: 'no_session_cookie_provided',
            });
        }));
        it('returns authenticated = false when session cookie is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.refreshAndSealSessionData({
                sessionData: 'thisisacookie',
                cookiePassword: 'secret',
            })).resolves.toEqual({
                authenticated: false,
                reason: 'invalid_session_cookie',
            });
        }));
        it('returns authenticated = false when session cookie cannot be unsealed', () => __awaiter(void 0, void 0, void 0, function* () {
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'abc123',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.refreshAndSealSessionData({
                sessionData,
                cookiePassword: 'secretpasswordwhichisalsolongbutnottherightone',
            })).resolves.toEqual({
                authenticated: false,
                reason: 'invalid_session_cookie',
            });
        }));
        it('returns the sealed refreshed session cookie when provided a valid existing session cookie', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                user: user_json_1.default,
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                refresh_token: 'refresh_token',
            });
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.refreshAndSealSessionData({
                sessionData,
                cookiePassword,
            })).resolves.toEqual({
                sealedSession: expect.any(String),
                authenticated: true,
            });
        }));
    });
    describe('getSessionFromCookie', () => {
        it('throws an error when the cookie password is undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.getSessionFromCookie({
                sessionData: 'session_cookie',
            })).rejects.toThrow('Cookie password is required');
        }));
        it('returns undefined when the session cookie cannot be unsealed', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.getSessionFromCookie({
                sessionData: '',
                cookiePassword: 'secret',
            })).resolves.toBeUndefined();
        }));
        it('returns the unsealed session cookie data when provided a valid session cookie', () => __awaiter(void 0, void 0, void 0, function* () {
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionCookieData = {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            };
            const sessionData = yield (0, iron_session_1.sealData)(sessionCookieData, {
                password: cookiePassword,
            });
            yield expect(workos.userManagement.getSessionFromCookie({
                sessionData,
                cookiePassword,
            })).resolves.toEqual(sessionCookieData);
        }));
    });
    describe('getEmailVerification', () => {
        it('sends a Get EmailVerification request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(email_verification_json_1.default);
            const emailVerification = yield workos.userManagement.getEmailVerification(emailVerificationId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/email_verification/${emailVerificationId}`);
            expect(emailVerification).toMatchObject({
                id: 'email_verification_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'dane@workos.com',
                expiresAt: '2023-07-18T02:07:19.911Z',
                code: '123456',
                createdAt: '2023-07-18T02:07:19.911Z',
                updatedAt: '2023-07-18T02:07:19.911Z',
            });
        }));
    });
    describe('sendVerificationEmail', () => {
        it('sends a Create Email Verification Challenge request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.sendVerificationEmail({
                userId,
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/email_verification/send`);
            expect(resp).toMatchObject({
                user: {
                    createdAt: '2023-07-18T02:07:19.911Z',
                    email: 'test01@example.com',
                    emailVerified: true,
                    firstName: 'Test 01',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    lastName: 'User',
                    object: 'user',
                    updatedAt: '2023-07-18T02:07:19.911Z',
                },
            });
        }));
        describe('verifyEmail', () => {
            it('sends a Complete Email Verification request', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
                const resp = yield workos.userManagement.verifyEmail({
                    userId,
                    code: '123456',
                });
                expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/email_verification/confirm`);
                expect(resp.user).toMatchObject({
                    email: 'test01@example.com',
                });
            }));
        });
    });
    describe('getMagicAuth', () => {
        it('sends a Get Magic Auth request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(magic_auth_json_1.default);
            const magicAuth = yield workos.userManagement.getMagicAuth(magicAuthId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/magic_auth/${magicAuthId}`);
            expect(magicAuth).toMatchObject({
                id: 'magic_auth_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'dane@workos.com',
                expiresAt: '2023-07-18T02:07:19.911Z',
                code: '123456',
                createdAt: '2023-07-18T02:07:19.911Z',
                updatedAt: '2023-07-18T02:07:19.911Z',
            });
        }));
    });
    describe('createMagicAuth', () => {
        it('sends a Create Magic Auth request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(magic_auth_json_1.default);
            const response = yield workos.userManagement.createMagicAuth({
                email: 'bob.loblaw@example.com',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/magic_auth');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                email: 'bob.loblaw@example.com',
            });
            expect(response).toMatchObject({
                id: 'magic_auth_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'dane@workos.com',
                expiresAt: '2023-07-18T02:07:19.911Z',
                code: '123456',
                createdAt: '2023-07-18T02:07:19.911Z',
                updatedAt: '2023-07-18T02:07:19.911Z',
            });
        }));
    });
    describe('sendMagicAuthCode', () => {
        it('sends a Send Magic Auth Code request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const response = yield workos.userManagement.sendMagicAuthCode({
                email: 'bob.loblaw@example.com',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/magic_auth/send');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                email: 'bob.loblaw@example.com',
            });
            expect(response).toBeUndefined();
        }));
    });
    describe('getPasswordReset', () => {
        it('sends a Get PaswordReset request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(password_reset_json_1.default);
            const passwordReset = yield workos.userManagement.getPasswordReset(passwordResetId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/password_reset/${passwordResetId}`);
            expect(passwordReset).toMatchObject({
                id: 'password_reset_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'dane@workos.com',
                passwordResetToken: 'Z1uX3RbwcIl5fIGJJJCXXisdI',
                passwordResetUrl: 'https://your-app.com/reset-password?token=Z1uX3RbwcIl5fIGJJJCXXisdI',
                expiresAt: '2023-07-18T02:07:19.911Z',
                createdAt: '2023-07-18T02:07:19.911Z',
            });
        }));
    });
    describe('createMagicAuth', () => {
        it('sends a Create Magic Auth request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(password_reset_json_1.default);
            const response = yield workos.userManagement.createPasswordReset({
                email: 'dane@workos.com',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/password_reset');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                email: 'dane@workos.com',
            });
            expect(response).toMatchObject({
                id: 'password_reset_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'dane@workos.com',
                passwordResetToken: 'Z1uX3RbwcIl5fIGJJJCXXisdI',
                passwordResetUrl: 'https://your-app.com/reset-password?token=Z1uX3RbwcIl5fIGJJJCXXisdI',
                expiresAt: '2023-07-18T02:07:19.911Z',
                createdAt: '2023-07-18T02:07:19.911Z',
            });
        }));
    });
    describe('sendPasswordResetEmail', () => {
        it('sends a Send Password Reset Email request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const resp = yield workos.userManagement.sendPasswordResetEmail({
                email: 'test01@example.com',
                passwordResetUrl: 'https://example.com/forgot-password',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/password_reset/send`);
            expect(resp).toBeUndefined();
        }));
    });
    describe('resetPassword', () => {
        it('sends a Reset Password request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const resp = yield workos.userManagement.resetPassword({
                token: '',
                newPassword: 'correct horse battery staple',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/password_reset/confirm`);
            expect(resp.user).toMatchObject({
                email: 'test01@example.com',
            });
        }));
    });
    describe('updateUser', () => {
        it('sends a updateUser request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            const resp = yield workos.userManagement.updateUser({
                userId,
                firstName: 'Dane',
                lastName: 'Williams',
                emailVerified: true,
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}`);
            expect((0, test_utils_1.fetchBody)()).toEqual({
                first_name: 'Dane',
                last_name: 'Williams',
                email_verified: true,
            });
            expect(resp).toMatchObject({
                email: 'test01@example.com',
                profilePictureUrl: 'https://example.com/profile_picture.jpg',
            });
        }));
        describe('when only one property is provided', () => {
            it('sends a updateUser request', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(user_json_1.default);
                const resp = yield workos.userManagement.updateUser({
                    userId,
                    firstName: 'Dane',
                });
                expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}`);
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    first_name: 'Dane',
                });
                expect(resp).toMatchObject({
                    email: 'test01@example.com',
                    profilePictureUrl: 'https://example.com/profile_picture.jpg',
                });
            }));
        });
        it('adds metadata to the request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            yield workos.userManagement.updateUser({
                userId,
                metadata: { key: 'value' },
            });
            expect((0, test_utils_1.fetchBody)()).toMatchObject({
                metadata: { key: 'value' },
            });
        }));
        it('removes metadata from the request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            yield workos.userManagement.updateUser({
                userId,
                metadata: { key: null },
            });
            expect((0, test_utils_1.fetchBody)()).toMatchObject({
                metadata: {},
            });
        }));
        it('updates user locale', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(user_json_1.default);
            const resp = yield workos.userManagement.updateUser({
                userId,
                locale: 'en-US',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}`);
            expect((0, test_utils_1.fetchBody)()).toEqual({
                locale: 'en-US',
            });
            expect(resp).toMatchObject({
                id: userId,
                locale: 'en-US',
            });
        }));
    });
    describe('enrollAuthFactor', () => {
        it('sends an enrollAuthFactor request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                authentication_factor: {
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
                },
                authentication_challenge: {
                    object: 'authentication_challenge',
                    id: 'auth_challenge_1234',
                    created_at: '2022-03-15T20:39:19.892Z',
                    updated_at: '2022-03-15T20:39:19.892Z',
                    expires_at: '2022-03-15T21:39:19.892Z',
                    code: '12345',
                    authentication_factor_id: 'auth_factor_1234',
                },
            });
            const resp = yield workos.userManagement.enrollAuthFactor({
                userId,
                type: 'totp',
                totpIssuer: 'WorkOS',
                totpUser: 'some_user',
                totpSecret: 'secret-test',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/auth_factors`);
            expect(resp).toMatchObject({
                authenticationFactor: {
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
                },
                authenticationChallenge: {
                    object: 'authentication_challenge',
                    id: 'auth_challenge_1234',
                    createdAt: '2022-03-15T20:39:19.892Z',
                    updatedAt: '2022-03-15T20:39:19.892Z',
                    expiresAt: '2022-03-15T21:39:19.892Z',
                    code: '12345',
                    authenticationFactorId: 'auth_factor_1234',
                },
            });
        }));
    });
    describe('listAuthFactors', () => {
        it('sends a listAuthFactors request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_factors_json_1.default);
            const resp = yield workos.userManagement.listAuthFactors({ userId });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/auth_factors`);
            expect(resp).toMatchObject({
                object: 'list',
                data: [
                    {
                        object: 'authentication_factor',
                        id: 'auth_factor_1234',
                        createdAt: '2022-03-15T20:39:19.892Z',
                        updatedAt: '2022-03-15T20:39:19.892Z',
                        type: 'totp',
                        totp: {
                            issuer: 'WorkOS',
                            user: 'some_user',
                        },
                    },
                ],
                listMetadata: {
                    before: null,
                    after: null,
                },
            });
        }));
    });
    describe('listUserFeatureFlags', () => {
        it('returns feature flags for the user', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_user_feature_flags_json_1.default);
            const { data, object, listMetadata } = yield workos.userManagement.listUserFeatureFlags({ userId });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/feature-flags`);
            expect(object).toEqual('list');
            expect(listMetadata).toEqual({});
            expect(data).toHaveLength(3);
            expect(data).toEqual([
                {
                    object: 'feature_flag',
                    id: 'flag_01EHQMYV6MBK39QC5PZXHY59C5',
                    name: 'Advanced Dashboard',
                    slug: 'advanced-dashboard',
                    description: 'Enable advanced dashboard features',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    object: 'feature_flag',
                    id: 'flag_01EHQMYV6MBK39QC5PZXHY59C6',
                    name: 'Beta Features',
                    slug: 'beta-features',
                    description: null,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    object: 'feature_flag',
                    id: 'flag_01EHQMYV6MBK39QC5PZXHY59C7',
                    name: 'Premium Support',
                    slug: 'premium-support',
                    description: 'Access to premium support features',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
            ]);
        }));
        describe('with the before option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_user_feature_flags_json_1.default);
                const { data } = yield workos.userManagement.listUserFeatureFlags({
                    userId,
                    before: 'flag_before_id',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    before: 'flag_before_id',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/feature-flags`);
                expect(data).toHaveLength(3);
            }));
        });
        describe('with the after option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_user_feature_flags_json_1.default);
                const { data } = yield workos.userManagement.listUserFeatureFlags({
                    userId,
                    after: 'flag_after_id',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    after: 'flag_after_id',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/feature-flags`);
                expect(data).toHaveLength(3);
            }));
        });
        describe('with the limit option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_user_feature_flags_json_1.default);
                const { data } = yield workos.userManagement.listUserFeatureFlags({
                    userId,
                    limit: 3,
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    limit: '3',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/feature-flags`);
                expect(data).toHaveLength(3);
            }));
        });
    });
    describe('listSessions', () => {
        it('sends a listSessions request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_sessions_json_1.default);
            const resp = yield workos.userManagement.listSessions(userId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/sessions`);
            expect(resp).toMatchObject({
                object: 'list',
                data: [
                    {
                        object: 'session',
                        id: 'session_01K0T5TNC755C7FGRQFJRS4QK5',
                        userId: 'user_01K0T5T62NBSETXQD3NVGEA2RN',
                        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                        ipAddress: '192.168.65.1',
                        authMethod: 'oauth',
                        status: 'active',
                        expiresAt: '2026-07-22T22:59:48.743Z',
                        endedAt: null,
                        createdAt: '2025-07-23T04:59:48.738Z',
                        updatedAt: '2025-07-23T04:59:48.738Z',
                    },
                ],
                listMetadata: {
                    before: null,
                    after: null,
                },
            });
        }));
    });
    describe('deleteUser', () => {
        it('sends a deleteUser request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const resp = yield workos.userManagement.deleteUser(userId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}`);
            expect(resp).toBeUndefined();
        }));
    });
    describe('getUserIdentities', () => {
        it('sends a Get User Identities request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(identity_json_1.default);
            const resp = yield workos.userManagement.getUserIdentities(userId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/users/${userId}/identities`);
            expect(resp).toMatchObject([
                {
                    idpId: '108872335',
                    type: 'OAuth',
                    provider: 'GithubOAuth',
                },
                {
                    idpId: '111966195055680542408',
                    type: 'OAuth',
                    provider: 'GoogleOAuth',
                },
            ]);
        }));
    });
    describe('getOrganizationMembership', () => {
        it('sends a Get OrganizationMembership request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(organization_membership_json_1.default, {
                status: 200,
            });
            const organizationMembership = yield workos.userManagement.getOrganizationMembership(organizationMembershipId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/organization_memberships/${organizationMembershipId}`);
            expect(organizationMembership).toMatchObject({
                object: 'organization_membership',
                id: 'om_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                status: 'active',
            });
        }));
    });
    describe('listOrganizationMemberships', () => {
        it('lists organization memberships', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_organization_memberships_json_1.default, {
                status: 200,
            });
            const organizationMembershipsList = yield workos.userManagement.listOrganizationMemberships({
                organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/organization_memberships');
            expect(organizationMembershipsList).toMatchObject({
                object: 'list',
                data: [
                    {
                        object: 'organization_membership',
                        organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        organizationName: 'Example Organization',
                        userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        status: 'active',
                    },
                ],
                listMetadata: {
                    before: null,
                    after: null,
                },
            });
        }));
        it('sends the correct params when filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_organization_memberships_json_1.default, {
                status: 200,
            });
            yield workos.userManagement.listOrganizationMemberships({
                userId: 'user_someuser',
                organizationId: 'org_someorg',
                statuses: ['active', 'inactive'],
                after: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                limit: 10,
            });
            expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                user_id: 'user_someuser',
                organization_id: 'org_someorg',
                statuses: 'active,inactive',
                after: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                limit: '10',
                order: 'desc',
            });
        }));
    });
    describe('createOrganizationMembership', () => {
        it('sends a create organization membership request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(organization_membership_json_1.default, {
                status: 200,
            });
            const organizationMembership = yield workos.userManagement.createOrganizationMembership({
                organizationId: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/organization_memberships');
            expect(organizationMembership).toMatchObject({
                object: 'organization_membership',
                organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                status: 'active',
                role: {
                    slug: 'member',
                },
            });
        }));
    });
    describe('updateOrganizationMembership', () => {
        it('sends an update organization membership request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(organization_membership_json_1.default, {
                status: 200,
            });
            const organizationMembership = yield workos.userManagement.updateOrganizationMembership(organizationMembershipId, {
                roleSlug: 'member',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/organization_memberships/${organizationMembershipId}`);
            expect(organizationMembership).toMatchObject({
                object: 'organization_membership',
                organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                status: 'active',
                role: {
                    slug: 'member',
                },
            });
        }));
    });
    describe('deleteOrganizationMembership', () => {
        it('sends a deleteOrganizationMembership request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const resp = yield workos.userManagement.deleteOrganizationMembership(organizationMembershipId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/organization_memberships/${organizationMembershipId}`);
            expect(resp).toBeUndefined();
        }));
    });
    describe('deactivateOrganizationMembership', () => {
        it('sends a deactivateOrganizationMembership request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(deactivate_organization_membership_json_1.default);
            const organizationMembership = yield workos.userManagement.deactivateOrganizationMembership(organizationMembershipId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/organization_memberships/${organizationMembershipId}/deactivate`);
            expect(organizationMembership).toMatchObject({
                object: 'organization_membership',
                organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                status: 'inactive',
                role: {
                    slug: 'member',
                },
            });
        }));
    });
    describe('reactivateOrganizationMembership', () => {
        it('sends a reactivateOrganizationMembership request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(organization_membership_json_1.default);
            const organizationMembership = yield workos.userManagement.reactivateOrganizationMembership(organizationMembershipId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/organization_memberships/${organizationMembershipId}/reactivate`);
            expect(organizationMembership).toMatchObject({
                object: 'organization_membership',
                organizationId: 'organization_01H5JQDV7R7ATEYZDEG0W5PRYS',
                userId: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                status: 'active',
                role: {
                    slug: 'member',
                },
            });
        }));
    });
    describe('getInvitation', () => {
        it('sends a Get Invitation request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(invitation_json_1.default);
            const invitation = yield workos.userManagement.getInvitation(invitationId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/invitations/${invitationId}`);
            expect(invitation).toMatchObject({
                object: 'invitation',
                id: invitationId,
            });
        }));
    });
    describe('findInvitationByToken', () => {
        it('sends a find invitation by token request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(invitation_json_1.default);
            const invitation = yield workos.userManagement.findInvitationByToken(invitationToken);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/invitations/by_token/${invitationToken}`);
            expect(invitation).toMatchObject({
                object: 'invitation',
                token: invitationToken,
            });
        }));
    });
    describe('listInvitations', () => {
        it('lists invitations', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_invitations_json_1.default);
            const invitationsList = yield workos.userManagement.listInvitations({
                organizationId: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
                email: 'dane@workos.com',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/invitations');
            expect(invitationsList).toMatchObject({
                object: 'list',
                data: [
                    {
                        object: 'invitation',
                        id: 'invitation_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        organizationId: 'org_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        email: 'dane@workos.com',
                    },
                ],
                listMetadata: {
                    before: null,
                    after: null,
                },
            });
        }));
        it('sends the correct params when filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_invitations_json_1.default);
            yield workos.userManagement.listInvitations({
                organizationId: 'org_someorg',
                after: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                limit: 10,
            });
            expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                organization_id: 'org_someorg',
                after: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                limit: '10',
                order: 'desc',
            });
        }));
    });
    describe('sendInvitation', () => {
        it('sends a Send Invitation request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(invitation_json_1.default);
            const response = yield workos.userManagement.sendInvitation({
                email: 'dane@workos.com',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/invitations');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                email: 'dane@workos.com',
            });
            expect(response).toMatchObject({
                object: 'invitation',
                email: 'dane@workos.com',
            });
        }));
        it('sends the correct params when provided', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(invitation_json_1.default);
            yield workos.userManagement.sendInvitation({
                email: 'dane@workos.com',
                organizationId: 'org_someorg',
                expiresInDays: 4,
                inviterUserId: 'user_someuser',
            });
            expect((0, test_utils_1.fetchBody)()).toEqual({
                email: 'dane@workos.com',
                organization_id: 'org_someorg',
                expires_in_days: 4,
                inviter_user_id: 'user_someuser',
            });
        }));
    });
    describe('acceptInvitation', () => {
        it('sends an Accept Invitation request', () => __awaiter(void 0, void 0, void 0, function* () {
            const invitationId = 'invitation_01H5JQDV7R7ATEYZDEG0W5PRYS';
            (0, test_utils_1.fetchOnce)(Object.assign(Object.assign({}, invitation_json_1.default), { state: 'accepted', accepted_user_id: 'user_01HGK4K4PXNSG85RNNV0GXYP5W' }));
            const response = yield workos.userManagement.acceptInvitation(invitationId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/invitations/${invitationId}/accept`);
            expect(response).toMatchObject({
                object: 'invitation',
                email: 'dane@workos.com',
                state: 'accepted',
                acceptedUserId: 'user_01HGK4K4PXNSG85RNNV0GXYP5W',
            });
        }));
    });
    describe('revokeInvitation', () => {
        it('send a Revoke Invitation request', () => __awaiter(void 0, void 0, void 0, function* () {
            const invitationId = 'invitation_01H5JQDV7R7ATEYZDEG0W5PRYS';
            (0, test_utils_1.fetchOnce)(invitation_json_1.default);
            const response = yield workos.userManagement.revokeInvitation(invitationId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/user_management/invitations/${invitationId}/revoke`);
            expect(response).toMatchObject({
                object: 'invitation',
                email: 'dane@workos.com',
            });
        }));
    });
    describe('revokeSession', () => {
        it('sends a Revoke Session request', () => __awaiter(void 0, void 0, void 0, function* () {
            const sessionId = 'session_12345';
            (0, test_utils_1.fetchOnce)({});
            yield workos.userManagement.revokeSession({
                sessionId,
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/user_management/sessions/revoke');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                session_id: 'session_12345',
            });
        }));
    });
    describe('getAuthorizationUrl', () => {
        describe('with a screenHint', () => {
            it('generates an authorize url with a screenHint', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    provider: 'authkit',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                    screenHint: 'sign-up',
                });
                expect(url).toMatchSnapshot();
            });
        });
        describe('with a code_challenge and code_challenge_method', () => {
            it('generates an authorize url', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    provider: 'authkit',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                    codeChallenge: 'code_challenge_value',
                    codeChallengeMethod: 'S256',
                });
                expect(url).toMatchSnapshot();
            });
        });
        describe('with no custom api hostname', () => {
            it('generates an authorize url with the default api hostname', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    provider: 'GoogleOAuth',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(url).toMatchSnapshot();
            });
        });
        describe('with no domain or provider', () => {
            it('throws an error for incomplete arguments', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const urlFn = () => workos.userManagement.getAuthorizationUrl({
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(urlFn).toThrowErrorMatchingSnapshot();
            });
        });
        describe('with a provider', () => {
            it('generates an authorize url with the provider', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    provider: 'GoogleOAuth',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(url).toMatchSnapshot();
            });
            describe('with providerScopes', () => {
                it('generates an authorize url that includes the specified scopes', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.userManagement.getAuthorizationUrl({
                        provider: 'GoogleOAuth',
                        providerScopes: [
                            'https://www.googleapis.com/auth/calendar',
                            'https://www.googleapis.com/auth/admin.directory.group',
                        ],
                        clientId: 'proj_123',
                        redirectUri: 'example.com/auth/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
                describe('with providerQueryParams', () => {
                    it('generates an authorize url that includes the specified query params', () => {
                        const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                        const url = workos.userManagement.getAuthorizationUrl({
                            provider: 'GoogleOAuth',
                            clientId: 'proj_123',
                            redirectUri: 'example.com/auth/workos/callback',
                            providerQueryParams: {
                                foo: 'bar',
                                baz: 123,
                                bool: true,
                            },
                        });
                        expect(url).toMatchSnapshot();
                    });
                });
            });
        });
        describe('with a connectionId', () => {
            it('generates an authorize url with the connection', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    connectionId: 'connection_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(url).toMatchSnapshot();
            });
            describe('with providerScopes', () => {
                it('generates an authorize url that includes the specified scopes', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.userManagement.getAuthorizationUrl({
                        connectionId: 'connection_123',
                        providerScopes: ['read_api', 'read_repository'],
                        clientId: 'proj_123',
                        redirectUri: 'example.com/auth/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
        });
        describe('with an organizationId', () => {
            it('generates an authorization URL with the organization', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    organizationId: 'organization_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(url).toMatchSnapshot();
            });
        });
        describe('with a custom api hostname', () => {
            it('generates an authorize url with the custom api hostname', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                    apiHostname: 'api.workos.dev',
                });
                const url = workos.userManagement.getAuthorizationUrl({
                    organizationId: 'organization_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(url).toMatchSnapshot();
            });
        });
        describe('with state', () => {
            it('generates an authorize url with the provided state', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    organizationId: 'organization_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                    state: 'custom state',
                });
                expect(url).toMatchSnapshot();
            });
        });
        describe('with domainHint', () => {
            it('generates an authorize url with the provided domain hint', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    domainHint: 'example.com',
                    connectionId: 'connection_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                    state: 'custom state',
                });
                expect(url).toMatchInlineSnapshot(`"https://api.workos.com/user_management/authorize?client_id=proj_123&connection_id=connection_123&domain_hint=example.com&redirect_uri=example.com%2Fauth%2Fworkos%2Fcallback&response_type=code&state=custom+state"`);
            });
        });
        describe('with loginHint', () => {
            it('generates an authorize url with the provided login hint', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    loginHint: 'foo@workos.com',
                    connectionId: 'connection_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                    state: 'custom state',
                });
                expect(url).toMatchInlineSnapshot(`"https://api.workos.com/user_management/authorize?client_id=proj_123&connection_id=connection_123&login_hint=foo%40workos.com&redirect_uri=example.com%2Fauth%2Fworkos%2Fcallback&response_type=code&state=custom+state"`);
            });
        });
        describe('with prompt', () => {
            it('generates an authorize url with the provided prompt', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    prompt: 'login',
                    connectionId: 'connection_123',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                    state: 'custom state',
                });
                expect(url).toMatchInlineSnapshot(`"https://api.workos.com/user_management/authorize?client_id=proj_123&connection_id=connection_123&prompt=login&redirect_uri=example.com%2Fauth%2Fworkos%2Fcallback&response_type=code&state=custom+state"`);
            });
            it('generates an authorize url with consent prompt', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getAuthorizationUrl({
                    prompt: 'consent',
                    provider: 'GoogleOAuth',
                    clientId: 'proj_123',
                    redirectUri: 'example.com/auth/workos/callback',
                });
                expect(url).toMatchInlineSnapshot(`"https://api.workos.com/user_management/authorize?client_id=proj_123&prompt=consent&provider=GoogleOAuth&redirect_uri=example.com%2Fauth%2Fworkos%2Fcallback&response_type=code"`);
            });
        });
    });
    describe('getLogoutUrl', () => {
        it('returns a logout url', () => {
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            const url = workos.userManagement.getLogoutUrl({
                sessionId: '123456',
            });
            expect(url).toBe('https://api.workos.com/user_management/sessions/logout?session_id=123456');
        });
        describe('when a `returnTo` is given', () => {
            it('includes a `return_to` in the URL', () => {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const url = workos.userManagement.getLogoutUrl({
                    sessionId: '123456',
                    returnTo: 'https://your-app.com/signed-out',
                });
                expect(url).toBe('https://api.workos.com/user_management/sessions/logout?session_id=123456&return_to=https%3A%2F%2Fyour-app.com%2Fsigned-out');
            });
        });
    });
    describe('getLogoutUrlFromSessionCookie', () => {
        beforeEach(() => {
            // Mock createRemoteJWKSet
            jest
                .spyOn(jose, 'createRemoteJWKSet')
                .mockImplementation((_url, _options) => {
                // This function simulates the token verification process
                const verifyFunction = (_protectedHeader, _token) => {
                    return Promise.resolve({
                        type: 'public',
                    });
                };
                // Return an object that includes the verify function and the additional expected properties
                return {
                    __call__: verifyFunction,
                    coolingDown: false,
                    fresh: false,
                    reloading: false,
                    reload: jest.fn().mockResolvedValue(undefined),
                    jwks: () => undefined,
                };
            });
        });
        it('throws an error when the cookie password is undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.getLogoutUrlFromSessionCookie({
                sessionData: 'session_cookie',
            })).rejects.toThrow('Cookie password is required');
        }));
        it('returns authenticated = false when the session cookie is empty', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.getLogoutUrlFromSessionCookie({
                sessionData: '',
                cookiePassword: 'secret',
            })).rejects.toThrowError(new Error('Failed to extract session ID for logout URL: no_session_cookie_provided'));
        }));
        it('returns authenticated = false when session cookie is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(workos.userManagement.getLogoutUrlFromSessionCookie({
                sessionData: 'thisisacookie',
                cookiePassword: 'secret',
            })).rejects.toThrowError(new Error('Failed to extract session ID for logout URL: invalid_session_cookie'));
        }));
        it('returns authenticated = false when session cookie cannot be unsealed', () => __awaiter(void 0, void 0, void 0, function* () {
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'abc123',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.getLogoutUrlFromSessionCookie({
                sessionData,
                cookiePassword: 'secretpasswordwhichisalsolongbutnottherightone',
            })).rejects.toThrowError(new Error('Failed to extract session ID for logout URL: invalid_session_cookie'));
        }));
        it('returns authenticated = false when the JWT is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(jose, 'jwtVerify').mockImplementationOnce(() => {
                throw new Error('Invalid JWT');
            });
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'abc123',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.getLogoutUrlFromSessionCookie({
                sessionData,
                cookiePassword,
            })).rejects.toThrowError(new Error('Failed to extract session ID for logout URL: invalid_jwt'));
        }));
        it('returns the logout URL for the session when provided a valid JWT', () => __awaiter(void 0, void 0, void 0, function* () {
            jest
                .spyOn(jose, 'jwtVerify')
                .mockResolvedValue({});
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            yield expect(workos.userManagement.getLogoutUrlFromSessionCookie({
                sessionData,
                cookiePassword,
            })).resolves.toEqual(`https://api.workos.test/user_management/sessions/logout?session_id=session_123`);
        }));
    });
    describe('getJwksUrl', () => {
        it('returns the jwks url', () => {
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            const url = workos.userManagement.getJwksUrl('client_whatever');
            expect(url).toBe('https://api.workos.com/sso/jwks/client_whatever');
        });
        it('throws an error if the clientId is blank', () => {
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            expect(() => {
                workos.userManagement.getJwksUrl('');
            }).toThrowError(TypeError);
        });
    });
});
