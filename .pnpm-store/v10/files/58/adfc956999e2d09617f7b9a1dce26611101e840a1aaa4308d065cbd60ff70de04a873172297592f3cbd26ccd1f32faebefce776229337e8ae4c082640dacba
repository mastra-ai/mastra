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
const workos_1 = require("../workos");
const interfaces_1 = require("./interfaces");
describe('SSO', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    const connectionResponse = {
        object: 'connection',
        id: 'conn_123',
        organization_id: 'org_123',
        name: 'Connection',
        connection_type: interfaces_1.ConnectionType.OktaSAML,
        state: 'active',
        domains: [],
        created_at: '2023-07-17T20:07:20.055Z',
        updated_at: '2023-07-17T20:07:20.055Z',
    };
    describe('SSO', () => {
        describe('with options', () => {
            it('requests Connections with query parameters', () => __awaiter(void 0, void 0, void 0, function* () {
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const listConnectionsResponse = {
                    object: 'list',
                    data: [connectionResponse],
                    list_metadata: {},
                };
                (0, test_utils_1.fetchOnce)(listConnectionsResponse);
                yield workos.sso.listConnections({
                    connectionType: interfaces_1.ConnectionType.OktaSAML,
                    organizationId: 'org_123',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toMatchObject({
                    connection_type: interfaces_1.ConnectionType.OktaSAML,
                    organization_id: 'org_123',
                });
            }));
        });
        describe('getAuthorizationUrl', () => {
            describe('with no custom api hostname', () => {
                it('generates an authorize url with the default api hostname', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        domain: 'lyft.com',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
            describe('with no domain or provider', () => {
                it('throws an error for incomplete arguments', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const urlFn = () => workos.sso.getAuthorizationUrl({
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(urlFn).toThrowErrorMatchingSnapshot();
                });
            });
            describe('with a provider', () => {
                it('generates an authorize url with the provider', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                        apiHostname: 'api.workos.dev',
                    });
                    const url = workos.sso.getAuthorizationUrl({
                        provider: 'Google',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
            describe('with a connection', () => {
                it('generates an authorize url with the connection', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                        apiHostname: 'api.workos.dev',
                    });
                    const url = workos.sso.getAuthorizationUrl({
                        connection: 'connection_123',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
            describe('with an `organization`', () => {
                it('generates an authorization URL with the organization', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                        apiHostname: 'api.workos.dev',
                    });
                    const url = workos.sso.getAuthorizationUrl({
                        organization: 'organization_123',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
            describe('with a custom api hostname', () => {
                it('generates an authorize url with the custom api hostname', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU', {
                        apiHostname: 'api.workos.dev',
                    });
                    const url = workos.sso.getAuthorizationUrl({
                        domain: 'lyft.com',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
            describe('with state', () => {
                it('generates an authorize url with the provided state', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        domain: 'lyft.com',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                        state: 'custom state',
                    });
                    expect(url).toMatchSnapshot();
                });
            });
            describe('with domainHint', () => {
                it('generates an authorize url with the provided domain hint', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        domainHint: 'lyft.com',
                        connection: 'connection_123',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                        state: 'custom state',
                    });
                    expect(url).toMatchInlineSnapshot(`"https://api.workos.com/sso/authorize?client_id=proj_123&connection=connection_123&domain_hint=lyft.com&redirect_uri=example.com%2Fsso%2Fworkos%2Fcallback&response_type=code&state=custom+state"`);
                });
            });
            describe('with loginHint', () => {
                it('generates an authorize url with the provided login hint', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        loginHint: 'foo@workos.com',
                        connection: 'connection_123',
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                        state: 'custom state',
                    });
                    expect(url).toMatchInlineSnapshot(`"https://api.workos.com/sso/authorize?client_id=proj_123&connection=connection_123&login_hint=foo%40workos.com&redirect_uri=example.com%2Fsso%2Fworkos%2Fcallback&response_type=code&state=custom+state"`);
                });
            });
            describe('with providerScopes', () => {
                it('generates an authorize url with the provided provider scopes', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        provider: 'Google',
                        providerScopes: ['profile', 'email', 'calendar'],
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchSnapshot();
                });
                it('handles empty provider scopes array', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        provider: 'Google',
                        providerScopes: [],
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchInlineSnapshot(`"https://api.workos.com/sso/authorize?client_id=proj_123&provider=Google&redirect_uri=example.com%2Fsso%2Fworkos%2Fcallback&response_type=code"`);
                });
            });
            describe('with providerQueryParams', () => {
                it('generates an authorize url with the provided provider query params', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        provider: 'Google',
                        providerQueryParams: {
                            custom_param: 'custom_value',
                            another_param: 123,
                            bool_param: true,
                        },
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchInlineSnapshot(`"https://api.workos.com/sso/authorize?client_id=proj_123&provider=Google&provider_query_params%5Banother_param%5D=123&provider_query_params%5Bbool_param%5D=true&provider_query_params%5Bcustom_param%5D=custom_value&redirect_uri=example.com%2Fsso%2Fworkos%2Fcallback&response_type=code"`);
                });
                it('handles empty provider query params', () => {
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const url = workos.sso.getAuthorizationUrl({
                        provider: 'Google',
                        providerQueryParams: {},
                        clientId: 'proj_123',
                        redirectUri: 'example.com/sso/workos/callback',
                    });
                    expect(url).toMatchInlineSnapshot(`"https://api.workos.com/sso/authorize?client_id=proj_123&provider=Google&redirect_uri=example.com%2Fsso%2Fworkos%2Fcallback&response_type=code"`);
                });
            });
        });
        describe('getProfileAndToken', () => {
            describe('with all information provided', () => {
                it('sends a request to the WorkOS api for a profile', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)({
                        access_token: '01DMEK0J53CVMC32CK5SE0KZ8Q',
                        profile: {
                            id: 'prof_123',
                            idp_id: '123',
                            organization_id: 'org_123',
                            connection_id: 'conn_123',
                            connection_type: 'OktaSAML',
                            email: 'foo@test.com',
                            first_name: 'foo',
                            last_name: 'bar',
                            role: {
                                slug: 'admin',
                            },
                            groups: ['Admins', 'Developers'],
                            raw_attributes: {
                                email: 'foo@test.com',
                                first_name: 'foo',
                                last_name: 'bar',
                                groups: ['Admins', 'Developers'],
                                license: 'professional',
                            },
                            custom_attributes: {
                                license: 'professional',
                            },
                        },
                    });
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const { accessToken, profile } = yield workos.sso.getProfileAndToken({
                        code: 'authorization_code',
                        clientId: 'proj_123',
                    });
                    expect(jest_fetch_mock_1.default.mock.calls.length).toEqual(1);
                    expect((0, test_utils_1.fetchBody)()).toMatchSnapshot();
                    expect((0, test_utils_1.fetchHeaders)()).toMatchSnapshot();
                    expect(accessToken).toBe('01DMEK0J53CVMC32CK5SE0KZ8Q');
                    expect(profile).toMatchSnapshot();
                }));
            });
            describe('without a groups attribute', () => {
                it('sends a request to the WorkOS api for a profile', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)({
                        access_token: '01DMEK0J53CVMC32CK5SE0KZ8Q',
                        profile: {
                            id: 'prof_123',
                            idp_id: '123',
                            organization_id: 'org_123',
                            connection_id: 'conn_123',
                            connection_type: 'OktaSAML',
                            email: 'foo@test.com',
                            first_name: 'foo',
                            last_name: 'bar',
                            role: {
                                slug: 'admin',
                            },
                            raw_attributes: {
                                email: 'foo@test.com',
                                first_name: 'foo',
                                last_name: 'bar',
                            },
                            custom_attributes: {},
                        },
                    });
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const { accessToken, profile } = yield workos.sso.getProfileAndToken({
                        code: 'authorization_code',
                        clientId: 'proj_123',
                    });
                    expect(jest_fetch_mock_1.default.mock.calls.length).toEqual(1);
                    expect((0, test_utils_1.fetchBody)()).toMatchSnapshot();
                    expect((0, test_utils_1.fetchHeaders)()).toMatchSnapshot();
                    expect(accessToken).toBe('01DMEK0J53CVMC32CK5SE0KZ8Q');
                    expect(profile).toMatchSnapshot();
                }));
            });
            describe('with oauth tokens in the response', () => {
                it('returns the oauth tokens from the profile and token response', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)({
                        access_token: '01DMEK0J53CVMC32CK5SE0KZ8Q',
                        profile: {
                            id: 'prof_123',
                            idp_id: '123',
                            organization_id: 'org_123',
                            connection_id: 'conn_123',
                            connection_type: 'OktaSAML',
                            email: 'foo@test.com',
                            first_name: 'foo',
                            last_name: 'bar',
                            role: {
                                slug: 'admin',
                            },
                            groups: ['Admins', 'Developers'],
                            raw_attributes: {
                                email: 'foo@test.com',
                                first_name: 'foo',
                                last_name: 'bar',
                                groups: ['Admins', 'Developers'],
                            },
                            custom_attributes: {},
                        },
                        oauth_tokens: {
                            access_token: 'oauth_access_token',
                            refresh_token: 'oauth_refresh_token',
                            expires_at: 1640995200,
                            scopes: ['profile', 'email'],
                        },
                    });
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const { accessToken, profile, oauthTokens } = yield workos.sso.getProfileAndToken({
                        code: 'authorization_code',
                        clientId: 'proj_123',
                    });
                    expect(jest_fetch_mock_1.default.mock.calls.length).toEqual(1);
                    expect(accessToken).toBe('01DMEK0J53CVMC32CK5SE0KZ8Q');
                    expect(profile).toBeDefined();
                    expect(oauthTokens).toEqual({
                        accessToken: 'oauth_access_token',
                        refreshToken: 'oauth_refresh_token',
                        expiresAt: 1640995200,
                        scopes: ['profile', 'email'],
                    });
                }));
            });
            describe('without oauth tokens in the response', () => {
                it('returns undefined for oauth tokens when not present in response', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)({
                        access_token: '01DMEK0J53CVMC32CK5SE0KZ8Q',
                        profile: {
                            id: 'prof_123',
                            idp_id: '123',
                            organization_id: 'org_123',
                            connection_id: 'conn_123',
                            connection_type: 'OktaSAML',
                            email: 'foo@test.com',
                            first_name: 'foo',
                            last_name: 'bar',
                            role: {
                                slug: 'admin',
                            },
                            raw_attributes: {
                                email: 'foo@test.com',
                                first_name: 'foo',
                                last_name: 'bar',
                            },
                            custom_attributes: {},
                        },
                    });
                    const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                    const { accessToken, profile, oauthTokens } = yield workos.sso.getProfileAndToken({
                        code: 'authorization_code',
                        clientId: 'proj_123',
                    });
                    expect(jest_fetch_mock_1.default.mock.calls.length).toEqual(1);
                    expect(accessToken).toBe('01DMEK0J53CVMC32CK5SE0KZ8Q');
                    expect(profile).toBeDefined();
                    expect(oauthTokens).toBeUndefined();
                }));
            });
        });
        describe('getProfile', () => {
            it('calls the `/sso/profile` endpoint with the provided access token', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    id: 'prof_123',
                    idp_id: '123',
                    organization_id: 'org_123',
                    connection_id: 'conn_123',
                    connection_type: 'OktaSAML',
                    email: 'foo@test.com',
                    first_name: 'foo',
                    last_name: 'bar',
                    role: {
                        slug: 'admin',
                    },
                    groups: ['Admins', 'Developers'],
                    raw_attributes: {
                        email: 'foo@test.com',
                        first_name: 'foo',
                        last_name: 'bar',
                        groups: ['Admins', 'Developers'],
                    },
                    custom_attributes: {},
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const profile = yield workos.sso.getProfile({
                    accessToken: 'access_token',
                });
                expect(jest_fetch_mock_1.default.mock.calls.length).toEqual(1);
                expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                    Authorization: 'Bearer access_token',
                });
                expect(profile.id).toBe('prof_123');
            }));
        });
        describe('deleteConnection', () => {
            it('sends request to delete a Connection', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)();
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield workos.sso.deleteConnection('conn_123');
                expect((0, test_utils_1.fetchURL)()).toContain('/connections/conn_123');
            }));
        });
        describe('getConnection', () => {
            it(`requests a Connection`, () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(connectionResponse);
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const subject = yield workos.sso.getConnection('conn_123');
                expect((0, test_utils_1.fetchURL)()).toContain('/connections/conn_123');
                expect(subject.connectionType).toEqual('OktaSAML');
            }));
        });
        describe('listConnections', () => {
            it(`requests a list of Connections`, () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    data: [connectionResponse],
                    list_metadata: {},
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const subject = yield workos.sso.listConnections({
                    organizationId: 'org_1234',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/connections');
                expect(subject.data).toHaveLength(1);
            }));
        });
    });
});
