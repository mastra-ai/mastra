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
exports.FirebaseAppCheckError = exports.APP_CHECK_ERROR_CODE_MAPPING = exports.AppCheckApiClient = void 0;
const api_request_1 = require("../utils/api-request");
const error_1 = require("../utils/error");
const utils = require("../utils/index");
const validator = require("../utils/validator");
// App Check backend constants
const FIREBASE_APP_CHECK_V1_API_URL_FORMAT = 'https://firebaseappcheck.googleapis.com/v1/projects/{projectId}/apps/{appId}:exchangeCustomToken';
const ONE_TIME_USE_TOKEN_VERIFICATION_URL_FORMAT = 'https://firebaseappcheck.googleapis.com/v1beta/projects/{projectId}:verifyAppCheckToken';
const FIREBASE_APP_CHECK_CONFIG_HEADERS = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`
};
/**
 * Class that facilitates sending requests to the Firebase App Check backend API.
 *
 * @internal
 */
class AppCheckApiClient {
    constructor(app) {
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new FirebaseAppCheckError('invalid-argument', 'First argument passed to admin.appCheck() must be a valid Firebase app instance.');
        }
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
    }
    /**
     * Exchange a signed custom token to App Check token
     *
     * @param customToken - The custom token to be exchanged.
     * @param appId - The mobile App ID.
     * @returns A promise that fulfills with a `AppCheckToken`.
     */
    exchangeToken(customToken, appId) {
        if (!validator.isNonEmptyString(appId)) {
            throw new FirebaseAppCheckError('invalid-argument', '`appId` must be a non-empty string.');
        }
        if (!validator.isNonEmptyString(customToken)) {
            throw new FirebaseAppCheckError('invalid-argument', '`customToken` must be a non-empty string.');
        }
        return this.getUrl(appId)
            .then((url) => {
            const request = {
                method: 'POST',
                url,
                headers: FIREBASE_APP_CHECK_CONFIG_HEADERS,
                data: { customToken }
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            return this.toAppCheckToken(resp);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    verifyReplayProtection(token) {
        if (!validator.isNonEmptyString(token)) {
            throw new FirebaseAppCheckError('invalid-argument', '`token` must be a non-empty string.');
        }
        return this.getVerifyTokenUrl()
            .then((url) => {
            const request = {
                method: 'POST',
                url,
                headers: FIREBASE_APP_CHECK_CONFIG_HEADERS,
                data: { app_check_token: token }
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            if (typeof resp.data.alreadyConsumed !== 'undefined'
                && !validator.isBoolean(resp.data?.alreadyConsumed)) {
                throw new FirebaseAppCheckError('invalid-argument', '`alreadyConsumed` must be a boolean value.');
            }
            return resp.data.alreadyConsumed || false;
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    getUrl(appId) {
        return this.getProjectId()
            .then((projectId) => {
            const urlParams = {
                projectId,
                appId,
            };
            const baseUrl = utils.formatString(FIREBASE_APP_CHECK_V1_API_URL_FORMAT, urlParams);
            return utils.formatString(baseUrl);
        });
    }
    getVerifyTokenUrl() {
        return this.getProjectId()
            .then((projectId) => {
            const urlParams = {
                projectId
            };
            const baseUrl = utils.formatString(ONE_TIME_USE_TOKEN_VERIFICATION_URL_FORMAT, urlParams);
            return utils.formatString(baseUrl);
        });
    }
    getProjectId() {
        if (this.projectId) {
            return Promise.resolve(this.projectId);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new FirebaseAppCheckError('unknown-error', 'Failed to determine project ID. Initialize the '
                    + 'SDK with service account credentials or set project ID as an app option. '
                    + 'Alternatively, set the GOOGLE_CLOUD_PROJECT environment variable.');
            }
            this.projectId = projectId;
            return projectId;
        });
    }
    toFirebaseError(err) {
        if (err instanceof error_1.PrefixedFirebaseError) {
            return err;
        }
        const response = err.response;
        if (!response.isJson()) {
            return new FirebaseAppCheckError('unknown-error', `Unexpected response with status: ${response.status} and body: ${response.text}`);
        }
        const error = response.data.error || {};
        let code = 'unknown-error';
        if (error.status && error.status in exports.APP_CHECK_ERROR_CODE_MAPPING) {
            code = exports.APP_CHECK_ERROR_CODE_MAPPING[error.status];
        }
        const message = error.message || `Unknown server error: ${response.text}`;
        return new FirebaseAppCheckError(code, message);
    }
    /**
     * Creates an AppCheckToken from the API response.
     *
     * @param resp - API response object.
     * @returns An AppCheckToken instance.
     */
    toAppCheckToken(resp) {
        const token = resp.data.token;
        // `ttl` is a string with the suffix "s" preceded by the number of seconds,
        // with nanoseconds expressed as fractional seconds.
        const ttlMillis = this.stringToMilliseconds(resp.data.ttl);
        return {
            token,
            ttlMillis
        };
    }
    /**
     * Converts a duration string with the suffix `s` to milliseconds.
     *
     * @param duration - The duration as a string with the suffix "s" preceded by the
     * number of seconds, with fractional seconds. For example, 3 seconds with 0 nanoseconds
     * is expressed as "3s", while 3 seconds and 1 nanosecond is expressed as "3.000000001s",
     * and 3 seconds and 1 microsecond is expressed as "3.000001s".
     *
     * @returns The duration in milliseconds.
     */
    stringToMilliseconds(duration) {
        if (!validator.isNonEmptyString(duration) || !duration.endsWith('s')) {
            throw new FirebaseAppCheckError('invalid-argument', '`ttl` must be a valid duration string with the suffix `s`.');
        }
        const seconds = duration.slice(0, -1);
        return Math.floor(Number(seconds) * 1000);
    }
}
exports.AppCheckApiClient = AppCheckApiClient;
exports.APP_CHECK_ERROR_CODE_MAPPING = {
    ABORTED: 'aborted',
    INVALID_ARGUMENT: 'invalid-argument',
    INVALID_CREDENTIAL: 'invalid-credential',
    INTERNAL: 'internal-error',
    PERMISSION_DENIED: 'permission-denied',
    UNAUTHENTICATED: 'unauthenticated',
    NOT_FOUND: 'not-found',
    UNKNOWN: 'unknown-error',
};
/**
 * Firebase App Check error code structure. This extends PrefixedFirebaseError.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
class FirebaseAppCheckError extends error_1.PrefixedFirebaseError {
    constructor(code, message) {
        super('app-check', code, message);
        /* tslint:disable:max-line-length */
        // Set the prototype explicitly. See the following link for more details:
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        /* tslint:enable:max-line-length */
        this.__proto__ = FirebaseAppCheckError.prototype;
    }
}
exports.FirebaseAppCheckError = FirebaseAppCheckError;
