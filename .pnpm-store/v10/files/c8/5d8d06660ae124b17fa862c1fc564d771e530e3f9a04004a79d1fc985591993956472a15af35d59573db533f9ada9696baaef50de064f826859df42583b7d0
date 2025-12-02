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
exports.AppCheck = void 0;
const validator = require("../utils/validator");
const app_check_api_client_internal_1 = require("./app-check-api-client-internal");
const token_generator_1 = require("./token-generator");
const token_verifier_1 = require("./token-verifier");
const crypto_signer_1 = require("../utils/crypto-signer");
/**
 * The Firebase `AppCheck` service interface.
 */
class AppCheck {
    /**
     * @param app - The app for this AppCheck service.
     * @constructor
     * @internal
     */
    constructor(app) {
        this.app = app;
        this.client = new app_check_api_client_internal_1.AppCheckApiClient(app);
        try {
            this.tokenGenerator = new token_generator_1.AppCheckTokenGenerator((0, crypto_signer_1.cryptoSignerFromApp)(app));
        }
        catch (err) {
            throw (0, token_generator_1.appCheckErrorFromCryptoSignerError)(err);
        }
        this.appCheckTokenVerifier = new token_verifier_1.AppCheckTokenVerifier(app);
    }
    /**
     * Creates a new {@link AppCheckToken} that can be sent
     * back to a client.
     *
     * @param appId - The app ID to use as the JWT app_id.
     * @param options - Optional options object when creating a new App Check Token.
     *
     * @returns A promise that fulfills with a `AppCheckToken`.
     */
    createToken(appId, options) {
        return this.tokenGenerator.createCustomToken(appId, options)
            .then((customToken) => {
            return this.client.exchangeToken(customToken, appId);
        });
    }
    /**
     * Verifies a Firebase App Check token (JWT). If the token is valid, the promise is
     * fulfilled with the token's decoded claims; otherwise, the promise is
     * rejected.
     *
     * @param appCheckToken - The App Check token to verify.
     * @param options - Optional {@link VerifyAppCheckTokenOptions} object when verifying an App Check Token.
     *
     * @returns A promise fulfilled with the token's decoded claims
     *   if the App Check token is valid; otherwise, a rejected promise.
     */
    verifyToken(appCheckToken, options) {
        this.validateVerifyAppCheckTokenOptions(options);
        return this.appCheckTokenVerifier.verifyToken(appCheckToken)
            .then((decodedToken) => {
            if (options?.consume) {
                return this.client.verifyReplayProtection(appCheckToken)
                    .then((alreadyConsumed) => {
                    return {
                        alreadyConsumed,
                        appId: decodedToken.app_id,
                        token: decodedToken,
                    };
                });
            }
            return {
                appId: decodedToken.app_id,
                token: decodedToken,
            };
        });
    }
    validateVerifyAppCheckTokenOptions(options) {
        if (typeof options === 'undefined') {
            return;
        }
        if (!validator.isNonNullObject(options)) {
            throw new app_check_api_client_internal_1.FirebaseAppCheckError('invalid-argument', 'VerifyAppCheckTokenOptions must be a non-null object.');
        }
    }
}
exports.AppCheck = AppCheck;
