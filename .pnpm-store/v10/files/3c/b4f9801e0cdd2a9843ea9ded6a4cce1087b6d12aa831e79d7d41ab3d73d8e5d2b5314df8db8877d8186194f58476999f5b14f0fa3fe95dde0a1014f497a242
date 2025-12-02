"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeAuthenticateWithEmailVerificationOptions = void 0;
const serializeAuthenticateWithEmailVerificationOptions = (options) => ({
    grant_type: 'urn:workos:oauth:grant-type:email-verification:code',
    client_id: options.clientId,
    client_secret: options.clientSecret,
    pending_authentication_token: options.pendingAuthenticationToken,
    code: options.code,
    ip_address: options.ipAddress,
    user_agent: options.userAgent,
});
exports.serializeAuthenticateWithEmailVerificationOptions = serializeAuthenticateWithEmailVerificationOptions;
