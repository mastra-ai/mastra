/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
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
exports.AppCheckTokenGenerator = void 0;
exports.appCheckErrorFromCryptoSignerError = appCheckErrorFromCryptoSignerError;
const validator = require("../utils/validator");
const utils_1 = require("../utils");
const crypto_signer_1 = require("../utils/crypto-signer");
const app_check_api_client_internal_1 = require("./app-check-api-client-internal");
const ONE_MINUTE_IN_SECONDS = 60;
const ONE_MINUTE_IN_MILLIS = ONE_MINUTE_IN_SECONDS * 1000;
const ONE_DAY_IN_MILLIS = 24 * 60 * 60 * 1000;
// Audience to use for Firebase App Check Custom tokens
const FIREBASE_APP_CHECK_AUDIENCE = 'https://firebaseappcheck.googleapis.com/google.firebase.appcheck.v1.TokenExchangeService';
/**
 * Class for generating Firebase App Check tokens.
 *
 * @internal
 */
class AppCheckTokenGenerator {
    /**
     * The AppCheckTokenGenerator class constructor.
     *
     * @param signer - The CryptoSigner instance for this token generator.
     * @constructor
     */
    constructor(signer) {
        if (!validator.isNonNullObject(signer)) {
            throw new app_check_api_client_internal_1.FirebaseAppCheckError('invalid-argument', 'INTERNAL ASSERT: Must provide a CryptoSigner to use AppCheckTokenGenerator.');
        }
        this.signer = signer;
    }
    /**
     * Creates a new custom token that can be exchanged to an App Check token.
     *
     * @param appId - The Application ID to use for the generated token.
     *
     * @returns A Promise fulfilled with a custom token signed with a service account key
     * that can be exchanged to an App Check token.
     */
    createCustomToken(appId, options) {
        if (!validator.isNonEmptyString(appId)) {
            throw new app_check_api_client_internal_1.FirebaseAppCheckError('invalid-argument', '`appId` must be a non-empty string.');
        }
        let customOptions = {};
        if (typeof options !== 'undefined') {
            customOptions = this.validateTokenOptions(options);
        }
        return this.signer.getAccountId().then((account) => {
            const header = {
                alg: this.signer.algorithm,
                typ: 'JWT',
            };
            const iat = Math.floor(Date.now() / 1000);
            const body = {
                iss: account,
                sub: account,
                app_id: appId,
                aud: FIREBASE_APP_CHECK_AUDIENCE,
                exp: iat + (ONE_MINUTE_IN_SECONDS * 5),
                iat,
                ...customOptions,
            };
            const token = `${this.encodeSegment(header)}.${this.encodeSegment(body)}`;
            return this.signer.sign(Buffer.from(token))
                .then((signature) => {
                return `${token}.${this.encodeSegment(signature)}`;
            });
        }).catch((err) => {
            throw appCheckErrorFromCryptoSignerError(err);
        });
    }
    encodeSegment(segment) {
        const buffer = (segment instanceof Buffer) ? segment : Buffer.from(JSON.stringify(segment));
        return (0, utils_1.toWebSafeBase64)(buffer).replace(/=+$/, '');
    }
    /**
     * Checks if a given `AppCheckTokenOptions` object is valid. If successful, returns an object with
     * custom properties.
     *
     * @param options - An options object to be validated.
     * @returns A custom object with ttl converted to protobuf Duration string format.
     */
    validateTokenOptions(options) {
        if (!validator.isNonNullObject(options)) {
            throw new app_check_api_client_internal_1.FirebaseAppCheckError('invalid-argument', 'AppCheckTokenOptions must be a non-null object.');
        }
        if (typeof options.ttlMillis !== 'undefined') {
            if (!validator.isNumber(options.ttlMillis)) {
                throw new app_check_api_client_internal_1.FirebaseAppCheckError('invalid-argument', 'ttlMillis must be a duration in milliseconds.');
            }
            // ttlMillis must be between 30 minutes and 7 days (inclusive)
            if (options.ttlMillis < (ONE_MINUTE_IN_MILLIS * 30) || options.ttlMillis > (ONE_DAY_IN_MILLIS * 7)) {
                throw new app_check_api_client_internal_1.FirebaseAppCheckError('invalid-argument', 'ttlMillis must be a duration in milliseconds between 30 minutes and 7 days (inclusive).');
            }
            return { ttl: (0, utils_1.transformMillisecondsToSecondsString)(options.ttlMillis) };
        }
        return {};
    }
}
exports.AppCheckTokenGenerator = AppCheckTokenGenerator;
/**
 * Creates a new `FirebaseAppCheckError` by extracting the error code, message and other relevant
 * details from a `CryptoSignerError`.
 *
 * @param err - The Error to convert into a `FirebaseAppCheckError` error
 * @returns A Firebase App Check error that can be returned to the user.
 */
function appCheckErrorFromCryptoSignerError(err) {
    if (!(err instanceof crypto_signer_1.CryptoSignerError)) {
        return err;
    }
    if (err.code === crypto_signer_1.CryptoSignerErrorCode.SERVER_ERROR && validator.isNonNullObject(err.cause)) {
        const httpError = err.cause;
        const errorResponse = httpError.response.data;
        if (errorResponse?.error) {
            const status = errorResponse.error.status;
            const description = errorResponse.error.message || JSON.stringify(httpError.response);
            let code = 'unknown-error';
            if (status && status in app_check_api_client_internal_1.APP_CHECK_ERROR_CODE_MAPPING) {
                code = app_check_api_client_internal_1.APP_CHECK_ERROR_CODE_MAPPING[status];
            }
            return new app_check_api_client_internal_1.FirebaseAppCheckError(code, `Error returned from server while signing a custom token: ${description}`);
        }
        return new app_check_api_client_internal_1.FirebaseAppCheckError('internal-error', 'Error returned from server: ' + JSON.stringify(errorResponse) + '.');
    }
    return new app_check_api_client_internal_1.FirebaseAppCheckError(mapToAppCheckErrorCode(err.code), err.message);
}
function mapToAppCheckErrorCode(code) {
    switch (code) {
        case crypto_signer_1.CryptoSignerErrorCode.INVALID_CREDENTIAL:
            return 'invalid-credential';
        case crypto_signer_1.CryptoSignerErrorCode.INVALID_ARGUMENT:
            return 'invalid-argument';
        default:
            return 'internal-error';
    }
}
