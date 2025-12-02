/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2018 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseTokenVerifier = exports.SESSION_COOKIE_INFO = exports.AUTH_BLOCKING_TOKEN_INFO = exports.ID_TOKEN_INFO = void 0;
exports.createIdTokenVerifier = createIdTokenVerifier;
exports.createAuthBlockingTokenVerifier = createAuthBlockingTokenVerifier;
exports.createSessionCookieVerifier = createSessionCookieVerifier;
const error_1 = require("../utils/error");
const util = require("../utils/index");
const validator = require("../utils/validator");
const jwt_1 = require("../utils/jwt");
// Audience to use for Firebase Auth Custom tokens
const FIREBASE_AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
// URL containing the public keys for the Google certs (whose private keys are used to sign Firebase
// Auth ID tokens)
const CLIENT_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
// URL containing the public keys for Firebase session cookies. This will be updated to a different URL soon.
const SESSION_COOKIE_CERT_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';
const EMULATOR_VERIFIER = new jwt_1.EmulatorSignatureVerifier();
/**
 * User facing token information related to the Firebase ID token.
 *
 * @internal
 */
exports.ID_TOKEN_INFO = {
    url: 'https://firebase.google.com/docs/auth/admin/verify-id-tokens',
    verifyApiName: 'verifyIdToken()',
    jwtName: 'Firebase ID token',
    shortName: 'ID token',
    expiredErrorCode: error_1.AuthClientErrorCode.ID_TOKEN_EXPIRED,
};
/**
 * User facing token information related to the Firebase Auth Blocking token.
 *
 * @internal
 */
exports.AUTH_BLOCKING_TOKEN_INFO = {
    url: 'https://cloud.google.com/identity-platform/docs/blocking-functions',
    verifyApiName: '_verifyAuthBlockingToken()',
    jwtName: 'Firebase Auth Blocking token',
    shortName: 'Auth Blocking token',
    expiredErrorCode: error_1.AuthClientErrorCode.AUTH_BLOCKING_TOKEN_EXPIRED,
};
/**
 * User facing token information related to the Firebase session cookie.
 *
 * @internal
 */
exports.SESSION_COOKIE_INFO = {
    url: 'https://firebase.google.com/docs/auth/admin/manage-cookies',
    verifyApiName: 'verifySessionCookie()',
    jwtName: 'Firebase session cookie',
    shortName: 'session cookie',
    expiredErrorCode: error_1.AuthClientErrorCode.SESSION_COOKIE_EXPIRED,
};
/**
 * Class for verifying general purpose Firebase JWTs. This verifies ID tokens and session cookies.
 *
 * @internal
 */
class FirebaseTokenVerifier {
    constructor(clientCertUrl, issuer, tokenInfo, app) {
        this.issuer = issuer;
        this.tokenInfo = tokenInfo;
        this.app = app;
        if (!validator.isURL(clientCertUrl)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The provided public client certificate URL is an invalid URL.');
        }
        else if (!validator.isURL(issuer)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The provided JWT issuer is an invalid URL.');
        }
        else if (!validator.isNonNullObject(tokenInfo)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The provided JWT information is not an object or null.');
        }
        else if (!validator.isURL(tokenInfo.url)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The provided JWT verification documentation URL is invalid.');
        }
        else if (!validator.isNonEmptyString(tokenInfo.verifyApiName)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The JWT verify API name must be a non-empty string.');
        }
        else if (!validator.isNonEmptyString(tokenInfo.jwtName)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The JWT public full name must be a non-empty string.');
        }
        else if (!validator.isNonEmptyString(tokenInfo.shortName)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The JWT public short name must be a non-empty string.');
        }
        else if (!validator.isNonNullObject(tokenInfo.expiredErrorCode) || !('code' in tokenInfo.expiredErrorCode)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'The JWT expiration error code must be a non-null ErrorInfo object.');
        }
        this.shortNameArticle = tokenInfo.shortName.charAt(0).match(/[aeiou]/i) ? 'an' : 'a';
        this.signatureVerifier =
            jwt_1.PublicKeySignatureVerifier.withCertificateUrl(clientCertUrl, app.options.httpAgent);
        // For backward compatibility, the project ID is validated in the verification call.
    }
    /**
     * Verifies the format and signature of a Firebase Auth JWT token.
     *
     * @param jwtToken - The Firebase Auth JWT token to verify.
     * @param isEmulator - Whether to accept Auth Emulator tokens.
     * @returns A promise fulfilled with the decoded claims of the Firebase Auth ID token.
     */
    verifyJWT(jwtToken, isEmulator = false) {
        if (!validator.isString(jwtToken)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `First argument to ${this.tokenInfo.verifyApiName} must be a ${this.tokenInfo.jwtName} string.`);
        }
        return this.ensureProjectId()
            .then((projectId) => {
            return this.decodeAndVerify(jwtToken, projectId, isEmulator);
        })
            .then((decoded) => {
            const decodedIdToken = decoded.payload;
            decodedIdToken.uid = decodedIdToken.sub;
            return decodedIdToken;
        });
    }
    /** @alpha */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _verifyAuthBlockingToken(jwtToken, isEmulator, audience) {
        if (!validator.isString(jwtToken)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `First argument to ${this.tokenInfo.verifyApiName} must be a ${this.tokenInfo.jwtName} string.`);
        }
        return this.ensureProjectId()
            .then((projectId) => {
            if (typeof audience === 'undefined') {
                audience = `${projectId}.cloudfunctions.net/`;
            }
            return this.decodeAndVerify(jwtToken, projectId, isEmulator, audience);
        })
            .then((decoded) => {
            const decodedAuthBlockingToken = decoded.payload;
            decodedAuthBlockingToken.uid = decodedAuthBlockingToken.sub;
            return decodedAuthBlockingToken;
        });
    }
    ensureProjectId() {
        return util.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CREDENTIAL, 'Must initialize app with a cert credential or set your Firebase project ID as the ' +
                    `GOOGLE_CLOUD_PROJECT environment variable to call ${this.tokenInfo.verifyApiName}.`);
            }
            return Promise.resolve(projectId);
        });
    }
    decodeAndVerify(token, projectId, isEmulator, audience) {
        return this.safeDecode(token)
            .then((decodedToken) => {
            this.verifyContent(decodedToken, projectId, isEmulator, audience);
            return this.verifySignature(token, isEmulator)
                .then(() => decodedToken);
        });
    }
    safeDecode(jwtToken) {
        return (0, jwt_1.decodeJwt)(jwtToken)
            .catch((err) => {
            if (err.code === jwt_1.JwtErrorCode.INVALID_ARGUMENT) {
                const verifyJwtTokenDocsMessage = ` See ${this.tokenInfo.url} ` +
                    `for details on how to retrieve ${this.shortNameArticle} ${this.tokenInfo.shortName}.`;
                const errorMessage = `Decoding ${this.tokenInfo.jwtName} failed. Make sure you passed ` +
                    `the entire string JWT which represents ${this.shortNameArticle} ` +
                    `${this.tokenInfo.shortName}.` + verifyJwtTokenDocsMessage;
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, errorMessage);
            }
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, err.message);
        });
    }
    /**
     * Verifies the content of a Firebase Auth JWT.
     *
     * @param fullDecodedToken - The decoded JWT.
     * @param projectId - The Firebase Project Id.
     * @param isEmulator - Whether the token is an Emulator token.
     */
    verifyContent(fullDecodedToken, projectId, isEmulator, audience) {
        const header = fullDecodedToken && fullDecodedToken.header;
        const payload = fullDecodedToken && fullDecodedToken.payload;
        const projectIdMatchMessage = ` Make sure the ${this.tokenInfo.shortName} comes from the same ` +
            'Firebase project as the service account used to authenticate this SDK.';
        const verifyJwtTokenDocsMessage = ` See ${this.tokenInfo.url} ` +
            `for details on how to retrieve ${this.shortNameArticle} ${this.tokenInfo.shortName}.`;
        let errorMessage;
        if (!isEmulator && typeof header.kid === 'undefined') {
            const isCustomToken = (payload.aud === FIREBASE_AUDIENCE);
            const isLegacyCustomToken = (header.alg === 'HS256' && payload.v === 0 && 'd' in payload && 'uid' in payload.d);
            if (isCustomToken) {
                errorMessage = `${this.tokenInfo.verifyApiName} expects ${this.shortNameArticle} ` +
                    `${this.tokenInfo.shortName}, but was given a custom token.`;
            }
            else if (isLegacyCustomToken) {
                errorMessage = `${this.tokenInfo.verifyApiName} expects ${this.shortNameArticle} ` +
                    `${this.tokenInfo.shortName}, but was given a legacy custom token.`;
            }
            else {
                errorMessage = `${this.tokenInfo.jwtName} has no "kid" claim.`;
            }
            errorMessage += verifyJwtTokenDocsMessage;
        }
        else if (!isEmulator && header.alg !== jwt_1.ALGORITHM_RS256) {
            errorMessage = `${this.tokenInfo.jwtName} has incorrect algorithm. Expected "` + jwt_1.ALGORITHM_RS256 + '" but got ' +
                '"' + header.alg + '".' + verifyJwtTokenDocsMessage;
        }
        else if (typeof audience !== 'undefined' && !payload.aud.includes(audience)) {
            errorMessage = `${this.tokenInfo.jwtName} has incorrect "aud" (audience) claim. Expected "` +
                audience + '" but got "' + payload.aud + '".' + verifyJwtTokenDocsMessage;
        }
        else if (typeof audience === 'undefined' && payload.aud !== projectId) {
            errorMessage = `${this.tokenInfo.jwtName} has incorrect "aud" (audience) claim. Expected "` +
                projectId + '" but got "' + payload.aud + '".' + projectIdMatchMessage +
                verifyJwtTokenDocsMessage;
        }
        else if (payload.iss !== this.issuer + projectId) {
            errorMessage = `${this.tokenInfo.jwtName} has incorrect "iss" (issuer) claim. Expected ` +
                `"${this.issuer}` + projectId + '" but got "' +
                payload.iss + '".' + projectIdMatchMessage + verifyJwtTokenDocsMessage;
        }
        else if (!(payload.event_type !== undefined &&
            (payload.event_type === 'beforeSendSms' || payload.event_type === 'beforeSendEmail'))) {
            // excluding `beforeSendSms` and `beforeSendEmail` from processing `sub` as there is no user record available.
            // `sub` is the same as `uid` which is part of the user record.
            if (typeof payload.sub !== 'string') {
                errorMessage = `${this.tokenInfo.jwtName} has no "sub" (subject) claim.` + verifyJwtTokenDocsMessage;
            }
            else if (payload.sub === '') {
                errorMessage = `${this.tokenInfo.jwtName} has an empty "sub" (subject) claim.` +
                    verifyJwtTokenDocsMessage;
            }
            else if (payload.sub.length > 128) {
                errorMessage = `${this.tokenInfo.jwtName} has a "sub" (subject) claim longer than 128 characters.` +
                    verifyJwtTokenDocsMessage;
            }
        }
        if (errorMessage) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, errorMessage);
        }
    }
    verifySignature(jwtToken, isEmulator) {
        const verifier = isEmulator ? EMULATOR_VERIFIER : this.signatureVerifier;
        return verifier.verify(jwtToken)
            .catch((error) => {
            throw this.mapJwtErrorToAuthError(error);
        });
    }
    /**
     * Maps JwtError to FirebaseAuthError
     *
     * @param error - JwtError to be mapped.
     * @returns FirebaseAuthError or Error instance.
     */
    mapJwtErrorToAuthError(error) {
        const verifyJwtTokenDocsMessage = ` See ${this.tokenInfo.url} ` +
            `for details on how to retrieve ${this.shortNameArticle} ${this.tokenInfo.shortName}.`;
        if (error.code === jwt_1.JwtErrorCode.TOKEN_EXPIRED) {
            const errorMessage = `${this.tokenInfo.jwtName} has expired. Get a fresh ${this.tokenInfo.shortName}` +
                ` from your client app and try again (auth/${this.tokenInfo.expiredErrorCode.code}).` +
                verifyJwtTokenDocsMessage;
            return new error_1.FirebaseAuthError(this.tokenInfo.expiredErrorCode, errorMessage);
        }
        else if (error.code === jwt_1.JwtErrorCode.INVALID_SIGNATURE) {
            const errorMessage = `${this.tokenInfo.jwtName} has invalid signature.` + verifyJwtTokenDocsMessage;
            return new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, errorMessage);
        }
        else if (error.code === jwt_1.JwtErrorCode.NO_MATCHING_KID) {
            const errorMessage = `${this.tokenInfo.jwtName} has "kid" claim which does not ` +
                `correspond to a known public key. Most likely the ${this.tokenInfo.shortName} ` +
                'is expired, so get a fresh token from your client app and try again.';
            return new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, errorMessage);
        }
        return new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, error.message);
    }
}
exports.FirebaseTokenVerifier = FirebaseTokenVerifier;
/**
 * Creates a new FirebaseTokenVerifier to verify Firebase ID tokens.
 *
 * @internal
 * @param app - Firebase app instance.
 * @returns FirebaseTokenVerifier
 */
function createIdTokenVerifier(app) {
    return new FirebaseTokenVerifier(CLIENT_CERT_URL, 'https://securetoken.google.com/', exports.ID_TOKEN_INFO, app);
}
/**
 * Creates a new FirebaseTokenVerifier to verify Firebase Auth Blocking tokens.
 *
 * @internal
 * @param app - Firebase app instance.
 * @returns FirebaseTokenVerifier
 */
function createAuthBlockingTokenVerifier(app) {
    return new FirebaseTokenVerifier(CLIENT_CERT_URL, 'https://securetoken.google.com/', exports.AUTH_BLOCKING_TOKEN_INFO, app);
}
/**
 * Creates a new FirebaseTokenVerifier to verify Firebase session cookies.
 *
 * @internal
 * @param app - Firebase app instance.
 * @returns FirebaseTokenVerifier
 */
function createSessionCookieVerifier(app) {
    return new FirebaseTokenVerifier(SESSION_COOKIE_CERT_URL, 'https://session.firebase.google.com/', exports.SESSION_COOKIE_INFO, app);
}
