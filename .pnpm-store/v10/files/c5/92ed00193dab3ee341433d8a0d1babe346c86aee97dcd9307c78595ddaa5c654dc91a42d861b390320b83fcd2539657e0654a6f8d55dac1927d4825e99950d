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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManagement = void 0;
const jose_1 = require("jose");
const qs_1 = __importDefault(require("qs"));
const oauth_exception_1 = require("../common/exceptions/oauth.exception");
const fetch_and_deserialize_1 = require("../common/utils/fetch-and-deserialize");
const pagination_1 = require("../common/utils/pagination");
const serializers_1 = require("../mfa/serializers");
const feature_flag_serializer_1 = require("../feature-flags/serializers/feature-flag.serializer");
const authenticate_with_session_cookie_interface_1 = require("./interfaces/authenticate-with-session-cookie.interface");
const refresh_and_seal_session_data_interface_1 = require("./interfaces/refresh-and-seal-session-data.interface");
const revoke_session_options_interface_1 = require("./interfaces/revoke-session-options.interface");
const serializers_2 = require("./serializers");
const authenticate_with_email_verification_serializer_1 = require("./serializers/authenticate-with-email-verification.serializer");
const authenticate_with_organization_selection_options_serializer_1 = require("./serializers/authenticate-with-organization-selection-options.serializer");
const create_organization_membership_options_serializer_1 = require("./serializers/create-organization-membership-options.serializer");
const factor_serializer_1 = require("./serializers/factor.serializer");
const identity_serializer_1 = require("./serializers/identity.serializer");
const invitation_serializer_1 = require("./serializers/invitation.serializer");
const list_invitations_options_serializer_1 = require("./serializers/list-invitations-options.serializer");
const list_organization_memberships_options_serializer_1 = require("./serializers/list-organization-memberships-options.serializer");
const list_users_options_serializer_1 = require("./serializers/list-users-options.serializer");
const organization_membership_serializer_1 = require("./serializers/organization-membership.serializer");
const send_invitation_options_serializer_1 = require("./serializers/send-invitation-options.serializer");
const update_organization_membership_options_serializer_1 = require("./serializers/update-organization-membership-options.serializer");
const session_1 = require("./session");
const toQueryString = (options) => {
    return qs_1.default.stringify(options, {
        arrayFormat: 'repeat',
        // sorts the keys alphabetically to maintain backwards compatibility
        sort: (a, b) => a.localeCompare(b),
        // encodes space as + instead of %20 to maintain backwards compatibility
        format: 'RFC1738',
    });
};
class UserManagement {
    constructor(workos, ironSessionProvider) {
        this.workos = workos;
        const { clientId } = workos.options;
        this.clientId = clientId;
        this.ironSessionProvider = ironSessionProvider;
    }
    get jwks() {
        var _a;
        if (!this.clientId) {
            return;
        }
        // Set the JWKS URL. This is used to verify if the JWT is still valid
        (_a = this._jwks) !== null && _a !== void 0 ? _a : (this._jwks = (0, jose_1.createRemoteJWKSet)(new URL(this.getJwksUrl(this.clientId)), {
            cooldownDuration: 1000 * 60 * 5,
        }));
        return this._jwks;
    }
    /**
     * Loads a sealed session using the provided session data and cookie password.
     *
     * @param options - The options for loading the sealed session.
     * @param options.sessionData - The sealed session data.
     * @param options.cookiePassword - The password used to encrypt the session data.
     * @returns The session class.
     */
    loadSealedSession(options) {
        return new session_1.CookieSession(this, options.sessionData, options.cookiePassword);
    }
    getUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/users/${userId}`);
            return (0, serializers_2.deserializeUser)(data);
        });
    }
    getUserByExternalId(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/users/external_id/${externalId}`);
            return (0, serializers_2.deserializeUser)(data);
        });
    }
    listUsers(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/user_management/users', serializers_2.deserializeUser, options ? (0, list_users_options_serializer_1.serializeListUsersOptions)(options) : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/user_management/users', serializers_2.deserializeUser, params), options ? (0, list_users_options_serializer_1.serializeListUsersOptions)(options) : undefined);
        });
    }
    createUser(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/user_management/users', (0, serializers_2.serializeCreateUserOptions)(payload));
            return (0, serializers_2.deserializeUser)(data);
        });
    }
    authenticateWithMagicAuth(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, serializers_2.serializeAuthenticateWithMagicAuthOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithPassword(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, serializers_2.serializeAuthenticateWithPasswordOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithCode(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, serializers_2.serializeAuthenticateWithCodeOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithCodeAndVerifier(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, serializers_2.serializeAuthenticateWithCodeAndVerifierOptions)(remainingPayload));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithRefreshToken(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, serializers_2.serializeAuthenticateWithRefreshTokenOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithTotp(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, serializers_2.serializeAuthenticateWithTotpOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithEmailVerification(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, authenticate_with_email_verification_serializer_1.serializeAuthenticateWithEmailVerificationOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithOrganizationSelection(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = payload, remainingPayload = __rest(payload, ["session"]);
            const { data } = yield this.workos.post('/user_management/authenticate', (0, authenticate_with_organization_selection_options_serializer_1.serializeAuthenticateWithOrganizationSelectionOptions)(Object.assign(Object.assign({}, remainingPayload), { clientSecret: this.workos.key })));
            return this.prepareAuthenticationResponse({
                authenticationResponse: (0, serializers_2.deserializeAuthenticationResponse)(data),
                session,
            });
        });
    }
    authenticateWithSessionCookie({ sessionData, cookiePassword = process.env.WORKOS_COOKIE_PASSWORD, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!cookiePassword) {
                throw new Error('Cookie password is required');
            }
            if (!this.jwks) {
                throw new Error('Must provide clientId to initialize JWKS');
            }
            if (!sessionData) {
                return {
                    authenticated: false,
                    reason: authenticate_with_session_cookie_interface_1.AuthenticateWithSessionCookieFailureReason.NO_SESSION_COOKIE_PROVIDED,
                };
            }
            const session = yield this.ironSessionProvider.unsealData(sessionData, {
                password: cookiePassword,
            });
            if (!session.accessToken) {
                return {
                    authenticated: false,
                    reason: authenticate_with_session_cookie_interface_1.AuthenticateWithSessionCookieFailureReason.INVALID_SESSION_COOKIE,
                };
            }
            if (!(yield this.isValidJwt(session.accessToken))) {
                return {
                    authenticated: false,
                    reason: authenticate_with_session_cookie_interface_1.AuthenticateWithSessionCookieFailureReason.INVALID_JWT,
                };
            }
            const { sid: sessionId, org_id: organizationId, role, roles, permissions, entitlements, feature_flags: featureFlags, } = (0, jose_1.decodeJwt)(session.accessToken);
            return {
                authenticated: true,
                sessionId,
                organizationId,
                role,
                roles,
                user: session.user,
                permissions,
                entitlements,
                featureFlags,
                accessToken: session.accessToken,
            };
        });
    }
    isValidJwt(accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.jwks) {
                throw new Error('Must provide clientId to initialize JWKS');
            }
            try {
                yield (0, jose_1.jwtVerify)(accessToken, this.jwks);
                return true;
            }
            catch (e) {
                return false;
            }
        });
    }
    /**
     * @deprecated This method is deprecated and will be removed in a future major version.
     * Please use the new `loadSealedSession` helper and its corresponding methods instead.
     */
    refreshAndSealSessionData({ sessionData, organizationId, cookiePassword = process.env.WORKOS_COOKIE_PASSWORD, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!cookiePassword) {
                throw new Error('Cookie password is required');
            }
            if (!sessionData) {
                return {
                    authenticated: false,
                    reason: refresh_and_seal_session_data_interface_1.RefreshAndSealSessionDataFailureReason.NO_SESSION_COOKIE_PROVIDED,
                };
            }
            const session = yield this.ironSessionProvider.unsealData(sessionData, {
                password: cookiePassword,
            });
            if (!session.refreshToken || !session.user) {
                return {
                    authenticated: false,
                    reason: refresh_and_seal_session_data_interface_1.RefreshAndSealSessionDataFailureReason.INVALID_SESSION_COOKIE,
                };
            }
            const { org_id: organizationIdFromAccessToken } = (0, jose_1.decodeJwt)(session.accessToken);
            try {
                const { sealedSession } = yield this.authenticateWithRefreshToken({
                    clientId: this.workos.clientId,
                    refreshToken: session.refreshToken,
                    organizationId: organizationId !== null && organizationId !== void 0 ? organizationId : organizationIdFromAccessToken,
                    session: { sealSession: true, cookiePassword },
                });
                if (!sealedSession) {
                    return {
                        authenticated: false,
                        reason: refresh_and_seal_session_data_interface_1.RefreshAndSealSessionDataFailureReason.INVALID_SESSION_COOKIE,
                    };
                }
                return {
                    authenticated: true,
                    sealedSession,
                };
            }
            catch (error) {
                if (error instanceof oauth_exception_1.OauthException &&
                    // TODO: Add additional known errors and remove re-throw
                    (error.error === refresh_and_seal_session_data_interface_1.RefreshAndSealSessionDataFailureReason.INVALID_GRANT ||
                        error.error ===
                            refresh_and_seal_session_data_interface_1.RefreshAndSealSessionDataFailureReason.MFA_ENROLLMENT ||
                        error.error === refresh_and_seal_session_data_interface_1.RefreshAndSealSessionDataFailureReason.SSO_REQUIRED)) {
                    return {
                        authenticated: false,
                        reason: error.error,
                    };
                }
                throw error;
            }
        });
    }
    prepareAuthenticationResponse({ authenticationResponse, session, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (session === null || session === void 0 ? void 0 : session.sealSession) {
                return Object.assign(Object.assign({}, authenticationResponse), { sealedSession: yield this.sealSessionDataFromAuthenticationResponse({
                        authenticationResponse,
                        cookiePassword: session.cookiePassword,
                    }) });
            }
            return authenticationResponse;
        });
    }
    sealSessionDataFromAuthenticationResponse({ authenticationResponse, cookiePassword, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!cookiePassword) {
                throw new Error('Cookie password is required');
            }
            const { org_id: organizationIdFromAccessToken } = (0, jose_1.decodeJwt)(authenticationResponse.accessToken);
            const sessionData = {
                organizationId: organizationIdFromAccessToken,
                user: authenticationResponse.user,
                accessToken: authenticationResponse.accessToken,
                refreshToken: authenticationResponse.refreshToken,
                impersonator: authenticationResponse.impersonator,
            };
            return this.ironSessionProvider.sealData(sessionData, {
                password: cookiePassword,
            });
        });
    }
    getSessionFromCookie({ sessionData, cookiePassword = process.env.WORKOS_COOKIE_PASSWORD, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!cookiePassword) {
                throw new Error('Cookie password is required');
            }
            if (sessionData) {
                return this.ironSessionProvider.unsealData(sessionData, {
                    password: cookiePassword,
                });
            }
            return undefined;
        });
    }
    getEmailVerification(emailVerificationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/email_verification/${emailVerificationId}`);
            return (0, serializers_2.deserializeEmailVerification)(data);
        });
    }
    sendVerificationEmail({ userId, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/user_management/users/${userId}/email_verification/send`, {});
            return { user: (0, serializers_2.deserializeUser)(data.user) };
        });
    }
    getMagicAuth(magicAuthId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/magic_auth/${magicAuthId}`);
            return (0, serializers_2.deserializeMagicAuth)(data);
        });
    }
    createMagicAuth(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/user_management/magic_auth', (0, serializers_2.serializeCreateMagicAuthOptions)(Object.assign({}, options)));
            return (0, serializers_2.deserializeMagicAuth)(data);
        });
    }
    /**
     * @deprecated Please use `createMagicAuth` instead.
     * This method will be removed in a future major version.
     */
    sendMagicAuthCode(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.post('/user_management/magic_auth/send', (0, serializers_2.serializeSendMagicAuthCodeOptions)(options));
        });
    }
    verifyEmail({ code, userId, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/user_management/users/${userId}/email_verification/confirm`, {
                code,
            });
            return { user: (0, serializers_2.deserializeUser)(data.user) };
        });
    }
    getPasswordReset(passwordResetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/password_reset/${passwordResetId}`);
            return (0, serializers_2.deserializePasswordReset)(data);
        });
    }
    createPasswordReset(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/user_management/password_reset', (0, serializers_2.serializeCreatePasswordResetOptions)(Object.assign({}, options)));
            return (0, serializers_2.deserializePasswordReset)(data);
        });
    }
    /**
     * @deprecated Please use `createPasswordReset` instead. This method will be removed in a future major version.
     */
    sendPasswordResetEmail(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.post('/user_management/password_reset/send', (0, serializers_2.serializeSendPasswordResetEmailOptions)(payload));
        });
    }
    resetPassword(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/user_management/password_reset/confirm', (0, serializers_2.serializeResetPasswordOptions)(payload));
            return { user: (0, serializers_2.deserializeUser)(data.user) };
        });
    }
    updateUser(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.put(`/user_management/users/${payload.userId}`, (0, serializers_2.serializeUpdateUserOptions)(payload));
            return (0, serializers_2.deserializeUser)(data);
        });
    }
    enrollAuthFactor(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/user_management/users/${payload.userId}/auth_factors`, (0, serializers_2.serializeEnrollAuthFactorOptions)(payload));
            return {
                authenticationFactor: (0, serializers_2.deserializeFactorWithSecrets)(data.authentication_factor),
                authenticationChallenge: (0, serializers_1.deserializeChallenge)(data.authentication_challenge),
            };
        });
    }
    listAuthFactors(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId } = options, restOfOptions = __rest(options, ["userId"]);
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/user_management/users/${userId}/auth_factors`, factor_serializer_1.deserializeFactor, restOfOptions), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/user_management/users/${userId}/auth_factors`, factor_serializer_1.deserializeFactor, params), restOfOptions);
        });
    }
    listUserFeatureFlags(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId } = options, paginationOptions = __rest(options, ["userId"]);
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/user_management/users/${userId}/feature-flags`, feature_flag_serializer_1.deserializeFeatureFlag, paginationOptions), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/user_management/users/${userId}/feature-flags`, feature_flag_serializer_1.deserializeFeatureFlag, params), paginationOptions);
        });
    }
    listSessions(userId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/user_management/users/${userId}/sessions`, serializers_2.deserializeSession, options ? (0, serializers_2.serializeListSessionsOptions)(options) : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, `/user_management/users/${userId}/sessions`, serializers_2.deserializeSession, params), options ? (0, serializers_2.serializeListSessionsOptions)(options) : undefined);
        });
    }
    deleteUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/user_management/users/${userId}`);
        });
    }
    getUserIdentities(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                throw new TypeError(`Incomplete arguments. Need to specify 'userId'.`);
            }
            const { data } = yield this.workos.get(`/user_management/users/${userId}/identities`);
            return (0, identity_serializer_1.deserializeIdentities)(data);
        });
    }
    getOrganizationMembership(organizationMembershipId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/organization_memberships/${organizationMembershipId}`);
            return (0, organization_membership_serializer_1.deserializeOrganizationMembership)(data);
        });
    }
    listOrganizationMemberships(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/user_management/organization_memberships', organization_membership_serializer_1.deserializeOrganizationMembership, options
                ? (0, list_organization_memberships_options_serializer_1.serializeListOrganizationMembershipsOptions)(options)
                : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/user_management/organization_memberships', organization_membership_serializer_1.deserializeOrganizationMembership, params), options
                ? (0, list_organization_memberships_options_serializer_1.serializeListOrganizationMembershipsOptions)(options)
                : undefined);
        });
    }
    createOrganizationMembership(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/user_management/organization_memberships', (0, create_organization_membership_options_serializer_1.serializeCreateOrganizationMembershipOptions)(options));
            return (0, organization_membership_serializer_1.deserializeOrganizationMembership)(data);
        });
    }
    updateOrganizationMembership(organizationMembershipId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.put(`/user_management/organization_memberships/${organizationMembershipId}`, (0, update_organization_membership_options_serializer_1.serializeUpdateOrganizationMembershipOptions)(options));
            return (0, organization_membership_serializer_1.deserializeOrganizationMembership)(data);
        });
    }
    deleteOrganizationMembership(organizationMembershipId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/user_management/organization_memberships/${organizationMembershipId}`);
        });
    }
    deactivateOrganizationMembership(organizationMembershipId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.put(`/user_management/organization_memberships/${organizationMembershipId}/deactivate`, {});
            return (0, organization_membership_serializer_1.deserializeOrganizationMembership)(data);
        });
    }
    reactivateOrganizationMembership(organizationMembershipId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.put(`/user_management/organization_memberships/${organizationMembershipId}/reactivate`, {});
            return (0, organization_membership_serializer_1.deserializeOrganizationMembership)(data);
        });
    }
    getInvitation(invitationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/invitations/${invitationId}`);
            return (0, invitation_serializer_1.deserializeInvitation)(data);
        });
    }
    findInvitationByToken(invitationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/user_management/invitations/by_token/${invitationToken}`);
            return (0, invitation_serializer_1.deserializeInvitation)(data);
        });
    }
    listInvitations(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/user_management/invitations', invitation_serializer_1.deserializeInvitation, options ? (0, list_invitations_options_serializer_1.serializeListInvitationsOptions)(options) : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/user_management/invitations', invitation_serializer_1.deserializeInvitation, params), options ? (0, list_invitations_options_serializer_1.serializeListInvitationsOptions)(options) : undefined);
        });
    }
    sendInvitation(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post('/user_management/invitations', (0, send_invitation_options_serializer_1.serializeSendInvitationOptions)(Object.assign({}, payload)));
            return (0, invitation_serializer_1.deserializeInvitation)(data);
        });
    }
    acceptInvitation(invitationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/user_management/invitations/${invitationId}/accept`, null);
            return (0, invitation_serializer_1.deserializeInvitation)(data);
        });
    }
    revokeInvitation(invitationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/user_management/invitations/${invitationId}/revoke`, null);
            return (0, invitation_serializer_1.deserializeInvitation)(data);
        });
    }
    revokeSession(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.post('/user_management/sessions/revoke', (0, revoke_session_options_interface_1.serializeRevokeSessionOptions)(payload));
        });
    }
    getAuthorizationUrl({ connectionId, codeChallenge, codeChallengeMethod, context, clientId, domainHint, loginHint, organizationId, provider, providerQueryParams, providerScopes, prompt, redirectUri, state, screenHint, }) {
        if (!provider && !connectionId && !organizationId) {
            throw new TypeError(`Incomplete arguments. Need to specify either a 'connectionId', 'organizationId', or 'provider'.`);
        }
        if (provider !== 'authkit' && screenHint) {
            throw new TypeError(`'screenHint' is only supported for 'authkit' provider`);
        }
        if (context) {
            this.workos.emitWarning(`\`context\` is deprecated. We previously required initiate login endpoints to return the
\`context\` query parameter when getting the authorization URL. This is no longer necessary.`);
        }
        const query = toQueryString({
            connection_id: connectionId,
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
            context,
            organization_id: organizationId,
            domain_hint: domainHint,
            login_hint: loginHint,
            provider,
            provider_query_params: providerQueryParams,
            provider_scopes: providerScopes,
            prompt,
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            state,
            screen_hint: screenHint,
        });
        return `${this.workos.baseURL}/user_management/authorize?${query}`;
    }
    getLogoutUrl({ sessionId, returnTo, }) {
        if (!sessionId) {
            throw new TypeError(`Incomplete arguments. Need to specify 'sessionId'.`);
        }
        const url = new URL('/user_management/sessions/logout', this.workos.baseURL);
        url.searchParams.set('session_id', sessionId);
        if (returnTo) {
            url.searchParams.set('return_to', returnTo);
        }
        return url.toString();
    }
    /**
     * @deprecated This method is deprecated and will be removed in a future major version.
     * Please use the `loadSealedSession` helper and its `getLogoutUrl` method instead.
     *
     * getLogoutUrlFromSessionCookie takes in session cookie data, unseals the cookie, decodes the JWT claims,
     * and uses the session ID to generate the logout URL.
     *
     * Use this over `getLogoutUrl` if you'd like to the SDK to handle session cookies for you.
     */
    getLogoutUrlFromSessionCookie({ sessionData, cookiePassword = process.env.WORKOS_COOKIE_PASSWORD, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const authenticationResponse = yield this.authenticateWithSessionCookie({
                sessionData,
                cookiePassword,
            });
            if (!authenticationResponse.authenticated) {
                const { reason } = authenticationResponse;
                throw new Error(`Failed to extract session ID for logout URL: ${reason}`);
            }
            return this.getLogoutUrl({ sessionId: authenticationResponse.sessionId });
        });
    }
    getJwksUrl(clientId) {
        if (!clientId) {
            throw TypeError('clientId must be a valid clientId');
        }
        return `${this.workos.baseURL}/sso/jwks/${clientId}`;
    }
}
exports.UserManagement = UserManagement;
