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
const workos_1 = require("../workos");
const session_1 = require("./session");
const jose = __importStar(require("jose"));
const iron_session_1 = require("iron-session");
const user_json_1 = __importDefault(require("./fixtures/user.json"));
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
const test_utils_1 = require("../common/utils/test-utils");
describe('Session', () => {
    let workos;
    beforeAll(() => {
        workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
            clientId: 'client_123',
        });
    });
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('constructor', () => {
        it('throws an error if cookiePassword is not provided', () => {
            expect(() => {
                workos.userManagement.loadSealedSession({
                    sessionData: 'sessionData',
                    cookiePassword: '',
                });
            }).toThrow('cookiePassword is required');
        });
        it('creates a new Session instance', () => {
            const session = workos.userManagement.loadSealedSession({
                sessionData: 'sessionData',
                cookiePassword: 'cookiePassword',
            });
            expect(session).toBeInstanceOf(session_1.CookieSession);
        });
    });
    describe('authenticate', () => {
        it('returns a failed response if no sessionData is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const session = workos.userManagement.loadSealedSession({
                sessionData: '',
                cookiePassword: 'cookiePassword',
            });
            const response = yield session.authenticate();
            expect(response).toEqual({
                authenticated: false,
                reason: 'no_session_cookie_provided',
            });
        }));
        it('returns a failed response if no accessToken is found in the sessionData', () => __awaiter(void 0, void 0, void 0, function* () {
            const session = workos.userManagement.loadSealedSession({
                sessionData: 'sessionData',
                cookiePassword: 'cookiePassword',
            });
            const response = yield session.authenticate();
            expect(response).toEqual({
                authenticated: false,
                reason: 'invalid_session_cookie',
            });
        }));
        it('returns a failed response if the accessToken is not a valid JWT', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(jose, 'jwtVerify').mockImplementation(() => {
                throw new Error('Invalid JWT');
            });
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken: 'ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9',
                refreshToken: 'def456',
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            const session = workos.userManagement.loadSealedSession({
                sessionData,
                cookiePassword,
            });
            const response = yield session.authenticate();
            expect(response).toEqual({
                authenticated: false,
                reason: 'invalid_jwt',
            });
        }));
        it('returns a successful response if the sessionData is valid', () => __awaiter(void 0, void 0, void 0, function* () {
            jest
                .spyOn(jose, 'jwtVerify')
                .mockResolvedValue({});
            const cookiePassword = 'alongcookiesecretmadefortestingsessions';
            const accessToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdXRoZW50aWNhdGVkIjp0cnVlLCJpbXBlcnNvbmF0b3IiOnsiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJlYXNvbiI6InRlc3QifSwic2lkIjoic2Vzc2lvbl8xMjMiLCJvcmdfaWQiOiJvcmdfMTIzIiwicm9sZSI6Im1lbWJlciIsInJvbGVzIjpbIm1lbWJlciIsImFkbWluIl0sInBlcm1pc3Npb25zIjpbInBvc3RzOmNyZWF0ZSIsInBvc3RzOmRlbGV0ZSJdLCJlbnRpdGxlbWVudHMiOlsiYXVkaXQtbG9ncyJdLCJmZWF0dXJlX2ZsYWdzIjpbImRhcmstbW9kZSIsImJldGEtZmVhdHVyZXMiXSwidXNlciI6eyJvYmplY3QiOiJ1c2VyIiwiaWQiOiJ1c2VyXzAxSDVKUURWN1I3QVRFWVpERUcwVzVQUllTIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn19.TNUzJYn6lzLWFFsiWiKEgIshyUs-bKJQf1VxwNr1cGI';
            const sessionData = yield (0, iron_session_1.sealData)({
                accessToken,
                refreshToken: 'def456',
                impersonator: {
                    email: 'admin@example.com',
                    reason: 'test',
                },
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
            }, { password: cookiePassword });
            const session = workos.userManagement.loadSealedSession({
                sessionData,
                cookiePassword,
            });
            yield expect(session.authenticate()).resolves.toEqual({
                authenticated: true,
                impersonator: {
                    email: 'admin@example.com',
                    reason: 'test',
                },
                sessionId: 'session_123',
                organizationId: 'org_123',
                role: 'member',
                roles: ['member', 'admin'],
                permissions: ['posts:create', 'posts:delete'],
                entitlements: ['audit-logs'],
                featureFlags: ['dark-mode', 'beta-features'],
                user: {
                    object: 'user',
                    id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                    email: 'test@example.com',
                },
                accessToken,
            });
        }));
    });
    describe('refresh', () => {
        it('returns a failed response if invalid session data is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ user: user_json_1.default });
            const session = workos.userManagement.loadSealedSession({
                sessionData: '',
                cookiePassword: 'cookiePassword',
            });
            const response = yield session.refresh();
            expect(response).toEqual({
                authenticated: false,
                reason: 'invalid_session_cookie',
            });
        }));
        describe('when the session data is valid', () => {
            it('returns a successful response with a sealed and unsealed session', () => __awaiter(void 0, void 0, void 0, function* () {
                const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJzaWQiOiJzZXNzaW9uXzEyMyIsIm9yZ19pZCI6Im9yZ18xMjMiLCJyb2xlIjoibWVtYmVyIiwicm9sZXMiOlsibWVtYmVyIiwiYWRtaW4iXSwicGVybWlzc2lvbnMiOlsicG9zdHM6Y3JlYXRlIiwicG9zdHM6ZGVsZXRlIl19.N5zveP149QhRR5zNvzGJPiCX098uXaN8VM1_lwsMg4A';
                const refreshToken = 'def456';
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    accessToken,
                    refreshToken,
                });
                const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                const sessionData = yield (0, iron_session_1.sealData)({
                    accessToken,
                    refreshToken,
                    impersonator: {
                        email: 'admin@example.com',
                        reason: 'test',
                    },
                    user: {
                        object: 'user',
                        id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        email: 'test01@example.com',
                    },
                }, { password: cookiePassword });
                const session = workos.userManagement.loadSealedSession({
                    sessionData,
                    cookiePassword,
                });
                const response = yield session.refresh();
                expect(response).toEqual({
                    authenticated: true,
                    impersonator: {
                        email: 'admin@example.com',
                        reason: 'test',
                    },
                    organizationId: 'org_123',
                    sealedSession: expect.any(String),
                    session: expect.objectContaining({
                        sealedSession: expect.any(String),
                        user: expect.objectContaining({
                            email: 'test01@example.com',
                        }),
                    }),
                    entitlements: undefined,
                    permissions: ['posts:create', 'posts:delete'],
                    role: 'member',
                    roles: ['member', 'admin'],
                    sessionId: 'session_123',
                    user: expect.objectContaining({
                        email: 'test01@example.com',
                        id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        object: 'user',
                    }),
                });
            }));
            it('overwrites the cookie password if a new one is provided', () => __awaiter(void 0, void 0, void 0, function* () {
                const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJzdWIiOiAiMTIzNDU2Nzg5MCIsCiAgIm5hbWUiOiAiSm9obiBEb2UiLAogICJpYXQiOiAxNTE2MjM5MDIyLAogICJzaWQiOiAic2Vzc2lvbl8xMjMiLAogICJvcmdfaWQiOiAib3JnXzEyMyIsCiAgInJvbGUiOiAibWVtYmVyIiwKICAicGVybWlzc2lvbnMiOiBbInBvc3RzOmNyZWF0ZSIsICJwb3N0czpkZWxldGUiXQp9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
                const refreshToken = 'def456';
                (0, test_utils_1.fetchOnce)({
                    user: user_json_1.default,
                    accessToken,
                    refreshToken,
                });
                jest
                    .spyOn(jose, 'jwtVerify')
                    .mockResolvedValue({});
                const cookiePassword = 'alongcookiesecretmadefortestingsessions';
                const sessionData = yield (0, iron_session_1.sealData)({
                    accessToken,
                    refreshToken,
                    user: {
                        object: 'user',
                        id: 'user_01H5JQDV7R7ATEYZDEG0W5PRYS',
                        email: 'test01@example.com',
                    },
                }, { password: cookiePassword });
                const session = workos.userManagement.loadSealedSession({
                    sessionData,
                    cookiePassword,
                });
                const newCookiePassword = 'anevenlongercookiesecretmadefortestingsessions';
                const response = yield session.refresh({
                    cookiePassword: newCookiePassword,
                });
                expect(response.authenticated).toBe(true);
                const resp = yield session.authenticate();
                expect(resp.authenticated).toBe(true);
            }));
        });
    });
    describe('getLogoutUrl', () => {
        it('returns a logout URL for the user', () => __awaiter(void 0, void 0, void 0, function* () {
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
                    email: 'test01@example.com',
                },
            }, { password: cookiePassword });
            const session = workos.userManagement.loadSealedSession({
                sessionData,
                cookiePassword,
            });
            const url = yield session.getLogoutUrl();
            expect(url).toEqual('https://api.workos.com/user_management/sessions/logout?session_id=session_123');
        }));
        it('returns an error if the session is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            const session = workos.userManagement.loadSealedSession({
                sessionData: '',
                cookiePassword: 'cookiePassword',
            });
            yield expect(session.getLogoutUrl()).rejects.toThrow('Failed to extract session ID for logout URL: no_session_cookie_provided');
        }));
        describe('when a returnTo URL is provided', () => {
            it('returns a logout URL for the user', () => __awaiter(void 0, void 0, void 0, function* () {
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
                        email: 'test01@example.com',
                    },
                }, { password: cookiePassword });
                const session = workos.userManagement.loadSealedSession({
                    sessionData,
                    cookiePassword,
                });
                const url = yield session.getLogoutUrl({
                    returnTo: 'https://example.com/signed-out',
                });
                expect(url).toBe('https://api.workos.com/user_management/sessions/logout?session_id=session_123&return_to=https%3A%2F%2Fexample.com%2Fsigned-out');
            }));
        });
    });
});
