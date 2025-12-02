/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2022 Google Inc.
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
exports.FirebaseExtensionsError = exports.ExtensionsApiClient = void 0;
const api_request_1 = require("../utils/api-request");
const error_1 = require("../utils/error");
const validator = require("../utils/validator");
const utils = require("../utils");
const FIREBASE_FUNCTIONS_CONFIG_HEADERS = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`
};
const EXTENSIONS_API_VERSION = 'v1beta';
// Note - use getExtensionsApiUri() instead so that changing environments is consistent.
const EXTENSIONS_URL = 'https://firebaseextensions.googleapis.com';
/**
 * Class that facilitates sending requests to the Firebase Extensions backend API.
 *
 * @internal
 */
class ExtensionsApiClient {
    constructor(app) {
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new error_1.FirebaseAppError('invalid-argument', 'First argument passed to getExtensions() must be a valid Firebase app instance.');
        }
        this.httpClient = new api_request_1.AuthorizedHttpClient(this.app);
    }
    async updateRuntimeData(projectId, instanceId, runtimeData) {
        const url = this.getRuntimeDataUri(projectId, instanceId);
        const request = {
            method: 'PATCH',
            url,
            headers: FIREBASE_FUNCTIONS_CONFIG_HEADERS,
            data: runtimeData,
        };
        try {
            const res = await this.httpClient.send(request);
            return res.data;
        }
        catch (err) {
            throw this.toFirebaseError(err);
        }
    }
    getExtensionsApiUri() {
        return process.env['FIREBASE_EXT_URL'] ?? EXTENSIONS_URL;
    }
    getRuntimeDataUri(projectId, instanceId) {
        return `${this.getExtensionsApiUri()}/${EXTENSIONS_API_VERSION}/projects/${projectId}/instances/${instanceId}/runtimeData`;
    }
    toFirebaseError(err) {
        if (err instanceof error_1.PrefixedFirebaseError) {
            return err;
        }
        const response = err.response;
        if (!response?.isJson()) {
            return new FirebaseExtensionsError('unknown-error', `Unexpected response with status: ${response.status} and body: ${response.text}`);
        }
        const error = response.data?.error;
        const message = error?.message || `Unknown server error: ${response.text}`;
        switch (error.code) {
            case 403:
                return new FirebaseExtensionsError('forbidden', message);
            case 404:
                return new FirebaseExtensionsError('not-found', message);
            case 500:
                return new FirebaseExtensionsError('internal-error', message);
        }
        return new FirebaseExtensionsError('unknown-error', message);
    }
}
exports.ExtensionsApiClient = ExtensionsApiClient;
/**
 * Firebase Extensions error code structure. This extends PrefixedFirebaseError.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
class FirebaseExtensionsError extends error_1.PrefixedFirebaseError {
    constructor(code, message) {
        super('Extensions', code, message);
        /* tslint:disable:max-line-length */
        // Set the prototype explicitly. See the following link for more details:
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        /* tslint:enable:max-line-length */
        this.__proto__ = FirebaseExtensionsError.prototype;
    }
}
exports.FirebaseExtensionsError = FirebaseExtensionsError;
