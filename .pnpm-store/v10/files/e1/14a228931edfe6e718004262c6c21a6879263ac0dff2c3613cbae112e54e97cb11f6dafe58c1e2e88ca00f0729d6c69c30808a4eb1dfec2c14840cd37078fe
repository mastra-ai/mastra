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
exports.CookieSession = void 0;
const jose_1 = require("jose");
const oauth_exception_1 = require("../common/exceptions/oauth.exception");
const interfaces_1 = require("./interfaces");
class CookieSession {
    constructor(userManagement, sessionData, cookiePassword) {
        if (!cookiePassword) {
            throw new Error('cookiePassword is required');
        }
        this.userManagement = userManagement;
        this.ironSessionProvider = userManagement.ironSessionProvider;
        this.cookiePassword = cookiePassword;
        this.sessionData = sessionData;
        this.jwks = this.userManagement.jwks;
    }
    /**
     * Authenticates a user with a session cookie.
     *
     * @returns An object indicating whether the authentication was successful or not. If successful, it will include the user's session data.
     */
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.sessionData) {
                return {
                    authenticated: false,
                    reason: interfaces_1.AuthenticateWithSessionCookieFailureReason.NO_SESSION_COOKIE_PROVIDED,
                };
            }
            let session;
            try {
                session = yield this.ironSessionProvider.unsealData(this.sessionData, {
                    password: this.cookiePassword,
                });
            }
            catch (e) {
                return {
                    authenticated: false,
                    reason: interfaces_1.AuthenticateWithSessionCookieFailureReason.INVALID_SESSION_COOKIE,
                };
            }
            if (!session.accessToken) {
                return {
                    authenticated: false,
                    reason: interfaces_1.AuthenticateWithSessionCookieFailureReason.INVALID_SESSION_COOKIE,
                };
            }
            if (!(yield this.isValidJwt(session.accessToken))) {
                return {
                    authenticated: false,
                    reason: interfaces_1.AuthenticateWithSessionCookieFailureReason.INVALID_JWT,
                };
            }
            const { sid: sessionId, org_id: organizationId, role, roles, permissions, entitlements, feature_flags: featureFlags, } = (0, jose_1.decodeJwt)(session.accessToken);
            return {
                authenticated: true,
                sessionId,
                organizationId,
                role,
                roles,
                permissions,
                entitlements,
                featureFlags,
                user: session.user,
                impersonator: session.impersonator,
                accessToken: session.accessToken,
            };
        });
    }
    /**
     * Refreshes the user's session.
     *
     * @param options - Optional options for refreshing the session.
     * @param options.cookiePassword - The password to use for the new session cookie.
     * @param options.organizationId - The organization ID to use for the new session cookie.
     * @returns An object indicating whether the refresh was successful or not. If successful, it will include the new sealed session data.
     */
    refresh(options = {}) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield this.ironSessionProvider.unsealData(this.sessionData, {
                password: this.cookiePassword,
            });
            if (!session.refreshToken || !session.user) {
                return {
                    authenticated: false,
                    reason: interfaces_1.RefreshAndSealSessionDataFailureReason.INVALID_SESSION_COOKIE,
                };
            }
            const { org_id: organizationIdFromAccessToken } = (0, jose_1.decodeJwt)(session.accessToken);
            try {
                const cookiePassword = (_a = options.cookiePassword) !== null && _a !== void 0 ? _a : this.cookiePassword;
                const authenticationResponse = yield this.userManagement.authenticateWithRefreshToken({
                    clientId: this.userManagement.clientId,
                    refreshToken: session.refreshToken,
                    organizationId: (_b = options.organizationId) !== null && _b !== void 0 ? _b : organizationIdFromAccessToken,
                    session: {
                        // We want to store the new sealed session in this class instance, so this always needs to be true
                        sealSession: true,
                        cookiePassword,
                    },
                });
                // Update the password if a new one was provided
                if (options.cookiePassword) {
                    this.cookiePassword = options.cookiePassword;
                }
                this.sessionData = authenticationResponse.sealedSession;
                const { sid: sessionId, org_id: organizationId, role, roles, permissions, entitlements, feature_flags: featureFlags, } = (0, jose_1.decodeJwt)(authenticationResponse.accessToken);
                // TODO: Returning `session` here means there's some duplicated data.
                // Slim down the return type in a future major version.
                return {
                    authenticated: true,
                    sealedSession: authenticationResponse.sealedSession,
                    session: authenticationResponse,
                    sessionId,
                    organizationId,
                    role,
                    roles,
                    permissions,
                    entitlements,
                    featureFlags,
                    user: session.user,
                    impersonator: session.impersonator,
                };
            }
            catch (error) {
                if (error instanceof oauth_exception_1.OauthException &&
                    // TODO: Add additional known errors and remove re-throw
                    (error.error === interfaces_1.RefreshAndSealSessionDataFailureReason.INVALID_GRANT ||
                        error.error ===
                            interfaces_1.RefreshAndSealSessionDataFailureReason.MFA_ENROLLMENT ||
                        error.error === interfaces_1.RefreshAndSealSessionDataFailureReason.SSO_REQUIRED)) {
                    return {
                        authenticated: false,
                        reason: error.error,
                    };
                }
                throw error;
            }
        });
    }
    /**
     * Gets the URL to redirect the user to for logging out.
     *
     * @returns The URL to redirect the user to for logging out.
     */
    getLogoutUrl({ returnTo, } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const authenticationResponse = yield this.authenticate();
            if (!authenticationResponse.authenticated) {
                const { reason } = authenticationResponse;
                throw new Error(`Failed to extract session ID for logout URL: ${reason}`);
            }
            return this.userManagement.getLogoutUrl({
                sessionId: authenticationResponse.sessionId,
                returnTo,
            });
        });
    }
    isValidJwt(accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.jwks) {
                throw new Error('Missing client ID. Did you provide it when initializing WorkOS?');
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
}
exports.CookieSession = CookieSession;
