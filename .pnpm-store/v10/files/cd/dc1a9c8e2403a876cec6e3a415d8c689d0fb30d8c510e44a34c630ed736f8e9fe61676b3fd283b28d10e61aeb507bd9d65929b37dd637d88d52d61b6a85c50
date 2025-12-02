/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2021 Google Inc.
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
exports.JwtErrorCode = exports.JwtError = exports.EmulatorSignatureVerifier = exports.PublicKeySignatureVerifier = exports.UrlKeyFetcher = exports.JwksFetcher = exports.ALGORITHM_RS256 = void 0;
exports.verifyJwtSignature = verifyJwtSignature;
exports.decodeJwt = decodeJwt;
const validator = require("./validator");
const jwt = require("jsonwebtoken");
const jwks = require("jwks-rsa");
const api_request_1 = require("../utils/api-request");
exports.ALGORITHM_RS256 = 'RS256';
// `jsonwebtoken` converts errors from the `getKey` callback to its own `JsonWebTokenError` type
// and prefixes the error message with the following. Use the prefix to identify errors thrown
// from the key provider callback.
// https://github.com/auth0/node-jsonwebtoken/blob/d71e383862fc735991fd2e759181480f066bf138/verify.js#L96
const JWT_CALLBACK_ERROR_PREFIX = 'error in secret or public key callback: ';
const NO_MATCHING_KID_ERROR_MESSAGE = 'no-matching-kid-error';
const NO_KID_IN_HEADER_ERROR_MESSAGE = 'no-kid-in-header-error';
const HOUR_IN_SECONDS = 3600;
class JwksFetcher {
    constructor(jwksUrl, httpAgent) {
        this.publicKeysExpireAt = 0;
        if (!validator.isURL(jwksUrl)) {
            throw new Error('The provided JWKS URL is not a valid URL.');
        }
        this.client = jwks({
            jwksUri: jwksUrl,
            cache: false, // disable jwks-rsa LRU cache as the keys are always cached for 6 hours.
            requestAgent: httpAgent,
        });
    }
    fetchPublicKeys() {
        if (this.shouldRefresh()) {
            return this.refresh();
        }
        return Promise.resolve(this.publicKeys);
    }
    shouldRefresh() {
        return !this.publicKeys || this.publicKeysExpireAt <= Date.now();
    }
    refresh() {
        return this.client.getSigningKeys()
            .then((signingKeys) => {
            // reset expire at from previous set of keys.
            this.publicKeysExpireAt = 0;
            const newKeys = signingKeys.reduce((map, signingKey) => {
                map[signingKey.kid] = signingKey.getPublicKey();
                return map;
            }, {});
            this.publicKeysExpireAt = Date.now() + (HOUR_IN_SECONDS * 6 * 1000);
            this.publicKeys = newKeys;
            return newKeys;
        }).catch((err) => {
            throw new Error(`Error fetching Json Web Keys: ${err.message}`);
        });
    }
}
exports.JwksFetcher = JwksFetcher;
/**
 * Class to fetch public keys from a client certificates URL.
 */
class UrlKeyFetcher {
    constructor(clientCertUrl, httpAgent) {
        this.clientCertUrl = clientCertUrl;
        this.httpAgent = httpAgent;
        this.publicKeysExpireAt = 0;
        if (!validator.isURL(clientCertUrl)) {
            throw new Error('The provided public client certificate URL is not a valid URL.');
        }
    }
    /**
     * Fetches the public keys for the Google certs.
     *
     * @returns A promise fulfilled with public keys for the Google certs.
     */
    fetchPublicKeys() {
        if (this.shouldRefresh()) {
            return this.refresh();
        }
        return Promise.resolve(this.publicKeys);
    }
    /**
     * Checks if the cached public keys need to be refreshed.
     *
     * @returns Whether the keys should be fetched from the client certs url or not.
     */
    shouldRefresh() {
        return !this.publicKeys || this.publicKeysExpireAt <= Date.now();
    }
    refresh() {
        const client = new api_request_1.HttpClient();
        const request = {
            method: 'GET',
            url: this.clientCertUrl,
            httpAgent: this.httpAgent,
        };
        return client.send(request).then((resp) => {
            if (!resp.isJson() || resp.data.error) {
                // Treat all non-json messages and messages with an 'error' field as
                // error responses.
                throw new api_request_1.RequestResponseError(resp);
            }
            // reset expire at from previous set of keys.
            this.publicKeysExpireAt = 0;
            if (Object.prototype.hasOwnProperty.call(resp.headers, 'cache-control')) {
                const cacheControlHeader = resp.headers['cache-control'];
                const parts = cacheControlHeader.split(',');
                parts.forEach((part) => {
                    const subParts = part.trim().split('=');
                    if (subParts[0] === 'max-age') {
                        const maxAge = +subParts[1];
                        this.publicKeysExpireAt = Date.now() + (maxAge * 1000);
                    }
                });
            }
            this.publicKeys = resp.data;
            return resp.data;
        }).catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                let errorMessage = 'Error fetching public keys for Google certs: ';
                const resp = err.response;
                if (resp.isJson() && resp.data.error) {
                    errorMessage += `${resp.data.error}`;
                    if (resp.data.error_description) {
                        errorMessage += ' (' + resp.data.error_description + ')';
                    }
                }
                else {
                    errorMessage += `${resp.text}`;
                }
                throw new Error(errorMessage);
            }
            throw err;
        });
    }
}
exports.UrlKeyFetcher = UrlKeyFetcher;
/**
 * Class for verifying JWT signature with a public key.
 */
class PublicKeySignatureVerifier {
    constructor(keyFetcher) {
        this.keyFetcher = keyFetcher;
        if (!validator.isNonNullObject(keyFetcher)) {
            throw new Error('The provided key fetcher is not an object or null.');
        }
    }
    static withCertificateUrl(clientCertUrl, httpAgent) {
        return new PublicKeySignatureVerifier(new UrlKeyFetcher(clientCertUrl, httpAgent));
    }
    static withJwksUrl(jwksUrl, httpAgent) {
        return new PublicKeySignatureVerifier(new JwksFetcher(jwksUrl, httpAgent));
    }
    verify(token) {
        if (!validator.isString(token)) {
            return Promise.reject(new JwtError(JwtErrorCode.INVALID_ARGUMENT, 'The provided token must be a string.'));
        }
        return verifyJwtSignature(token, getKeyCallback(this.keyFetcher), { algorithms: [exports.ALGORITHM_RS256] })
            .catch((error) => {
            if (error.code === JwtErrorCode.NO_KID_IN_HEADER) {
                // No kid in JWT header. Try with all the public keys.
                return this.verifyWithoutKid(token);
            }
            throw error;
        });
    }
    verifyWithoutKid(token) {
        return this.keyFetcher.fetchPublicKeys()
            .then(publicKeys => this.verifyWithAllKeys(token, publicKeys));
    }
    verifyWithAllKeys(token, keys) {
        const promises = [];
        Object.values(keys).forEach((key) => {
            const result = verifyJwtSignature(token, key)
                .then(() => true)
                .catch((error) => {
                if (error.code === JwtErrorCode.TOKEN_EXPIRED) {
                    throw error;
                }
                return false;
            });
            promises.push(result);
        });
        return Promise.all(promises)
            .then((result) => {
            if (result.every((r) => r === false)) {
                throw new JwtError(JwtErrorCode.INVALID_SIGNATURE, 'Invalid token signature.');
            }
        });
    }
}
exports.PublicKeySignatureVerifier = PublicKeySignatureVerifier;
/**
 * Class for verifying unsigned (emulator) JWTs.
 */
class EmulatorSignatureVerifier {
    verify(token) {
        // Signature checks skipped for emulator; no need to fetch public keys.
        return verifyJwtSignature(token, undefined, { algorithms: ['none'] });
    }
}
exports.EmulatorSignatureVerifier = EmulatorSignatureVerifier;
/**
 * Provides a callback to fetch public keys.
 *
 * @param fetcher - KeyFetcher to fetch the keys from.
 * @returns A callback function that can be used to get keys in `jsonwebtoken`.
 */
function getKeyCallback(fetcher) {
    return (header, callback) => {
        if (!header.kid) {
            callback(new Error(NO_KID_IN_HEADER_ERROR_MESSAGE));
        }
        const kid = header.kid || '';
        fetcher.fetchPublicKeys().then((publicKeys) => {
            if (!Object.prototype.hasOwnProperty.call(publicKeys, kid)) {
                callback(new Error(NO_MATCHING_KID_ERROR_MESSAGE));
            }
            else {
                callback(null, publicKeys[kid]);
            }
        })
            .catch(error => {
            callback(error);
        });
    };
}
/**
 * Verifies the signature of a JWT using the provided secret or a function to fetch
 * the secret or public key.
 *
 * @param token - The JWT to be verified.
 * @param secretOrPublicKey - The secret or a function to fetch the secret or public key.
 * @param options - JWT verification options.
 * @returns A Promise resolving for a token with a valid signature.
 */
function verifyJwtSignature(token, secretOrPublicKey, options) {
    if (!validator.isString(token)) {
        return Promise.reject(new JwtError(JwtErrorCode.INVALID_ARGUMENT, 'The provided token must be a string.'));
    }
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretOrPublicKey, options, (error) => {
            if (!error) {
                return resolve();
            }
            if (error.name === 'TokenExpiredError') {
                return reject(new JwtError(JwtErrorCode.TOKEN_EXPIRED, 'The provided token has expired. Get a fresh token from your ' +
                    'client app and try again.'));
            }
            else if (error.name === 'JsonWebTokenError') {
                if (error.message && error.message.includes(JWT_CALLBACK_ERROR_PREFIX)) {
                    const message = error.message.split(JWT_CALLBACK_ERROR_PREFIX).pop() || 'Error fetching public keys.';
                    let code = JwtErrorCode.KEY_FETCH_ERROR;
                    if (message === NO_MATCHING_KID_ERROR_MESSAGE) {
                        code = JwtErrorCode.NO_MATCHING_KID;
                    }
                    else if (message === NO_KID_IN_HEADER_ERROR_MESSAGE) {
                        code = JwtErrorCode.NO_KID_IN_HEADER;
                    }
                    return reject(new JwtError(code, message));
                }
            }
            return reject(new JwtError(JwtErrorCode.INVALID_SIGNATURE, error.message));
        });
    });
}
/**
 * Decodes general purpose Firebase JWTs.
 *
 * @param jwtToken - JWT token to be decoded.
 * @returns Decoded token containing the header and payload.
 */
function decodeJwt(jwtToken) {
    if (!validator.isString(jwtToken)) {
        return Promise.reject(new JwtError(JwtErrorCode.INVALID_ARGUMENT, 'The provided token must be a string.'));
    }
    const fullDecodedToken = jwt.decode(jwtToken, {
        complete: true,
    });
    if (!fullDecodedToken) {
        return Promise.reject(new JwtError(JwtErrorCode.INVALID_ARGUMENT, 'Decoding token failed.'));
    }
    const header = fullDecodedToken?.header;
    const payload = fullDecodedToken?.payload;
    return Promise.resolve({ header, payload });
}
/**
 * Jwt error code structure.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
class JwtError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.message = message;
        this.__proto__ = JwtError.prototype;
    }
}
exports.JwtError = JwtError;
/**
 * JWT error codes.
 */
var JwtErrorCode;
(function (JwtErrorCode) {
    JwtErrorCode["INVALID_ARGUMENT"] = "invalid-argument";
    JwtErrorCode["INVALID_CREDENTIAL"] = "invalid-credential";
    JwtErrorCode["TOKEN_EXPIRED"] = "token-expired";
    JwtErrorCode["INVALID_SIGNATURE"] = "invalid-token";
    JwtErrorCode["NO_MATCHING_KID"] = "no-matching-kid-error";
    JwtErrorCode["NO_KID_IN_HEADER"] = "no-kid-error";
    JwtErrorCode["KEY_FETCH_ERROR"] = "key-fetch-error";
})(JwtErrorCode || (exports.JwtErrorCode = JwtErrorCode = {}));
