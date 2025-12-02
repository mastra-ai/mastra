"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeAuthenticateWithTotpOptions = void 0;
const serializeAuthenticateWithTotpOptions = (options) => ({
    grant_type: 'urn:workos:oauth:grant-type:mfa-totp',
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code: options.code,
    authentication_challenge_id: options.authenticationChallengeId,
    pending_authentication_token: options.pendingAuthenticationToken,
    ip_address: options.ipAddress,
    user_agent: options.userAgent,
});
exports.serializeAuthenticateWithTotpOptions = serializeAuthenticateWithTotpOptions;
