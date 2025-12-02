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
exports.FirebaseInstallationsRequestHandler = void 0;
const error_1 = require("../utils/error");
const api_request_1 = require("../utils/api-request");
const utils = require("../utils/index");
const validator = require("../utils/validator");
/** Firebase IID backend host. */
const FIREBASE_IID_HOST = 'console.firebase.google.com';
/** Firebase IID backend path. */
const FIREBASE_IID_PATH = '/v1/';
/** Firebase IID request timeout duration in milliseconds. */
const FIREBASE_IID_TIMEOUT = 10000;
/** HTTP error codes raised by the backend server. */
const ERROR_CODES = {
    400: 'Malformed installation ID argument.',
    401: 'Request not authorized.',
    403: 'Project does not match installation ID or the client does not have sufficient privileges.',
    404: 'Failed to find the installation ID.',
    409: 'Already deleted.',
    429: 'Request throttled out by the backend server.',
    500: 'Internal server error.',
    503: 'Backend servers are over capacity. Try again later.',
};
/**
 * Class that provides mechanism to send requests to the FIS backend endpoints.
 */
class FirebaseInstallationsRequestHandler {
    /**
     * @param app - The app used to fetch access tokens to sign API requests.
     *
     * @constructor
     */
    constructor(app) {
        this.app = app;
        this.host = FIREBASE_IID_HOST;
        this.timeout = FIREBASE_IID_TIMEOUT;
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
    }
    deleteInstallation(fid) {
        if (!validator.isNonEmptyString(fid)) {
            return Promise.reject(new error_1.FirebaseInstallationsError(error_1.InstallationsClientErrorCode.INVALID_INSTALLATION_ID, 'Installation ID must be a non-empty string.'));
        }
        return this.invokeRequestHandler(new api_request_1.ApiSettings(fid, 'DELETE'));
    }
    /**
     * Invokes the request handler based on the API settings object passed.
     *
     * @param apiSettings - The API endpoint settings to apply to request and response.
     * @returns A promise that resolves when the request is complete.
     */
    invokeRequestHandler(apiSettings) {
        return this.getPathPrefix()
            .then((path) => {
            const req = {
                url: `https://${this.host}${path}${apiSettings.getEndpoint()}`,
                method: apiSettings.getHttpMethod(),
                timeout: this.timeout,
            };
            return this.httpClient.send(req);
        })
            .then(() => {
            // return nothing on success
        })
            .catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                const response = err.response;
                const errorMessage = (response.isJson() && 'error' in response.data) ?
                    response.data.error : response.text;
                const template = ERROR_CODES[response.status];
                const message = template ?
                    `Installation ID "${apiSettings.getEndpoint()}": ${template}` : errorMessage;
                throw new error_1.FirebaseInstallationsError(error_1.InstallationsClientErrorCode.API_ERROR, message);
            }
            // In case of timeouts and other network errors, the HttpClient returns a
            // FirebaseError wrapped in the response. Simply throw it here.
            throw err;
        });
    }
    getPathPrefix() {
        if (this.path) {
            return Promise.resolve(this.path);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                // Assert for an explicit projct ID (either via AppOptions or the cert itself).
                throw new error_1.FirebaseInstallationsError(error_1.InstallationsClientErrorCode.INVALID_PROJECT_ID, 'Failed to determine project ID for Installations. Initialize the '
                    + 'SDK with service account credentials or set project ID as an app option. '
                    + 'Alternatively set the GOOGLE_CLOUD_PROJECT environment variable.');
            }
            this.path = FIREBASE_IID_PATH + `project/${projectId}/instanceId/`;
            return this.path;
        });
    }
}
exports.FirebaseInstallationsRequestHandler = FirebaseInstallationsRequestHandler;
