/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2020 Google Inc.
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
exports.FirebaseRemoteConfigError = exports.RemoteConfigApiClient = void 0;
const api_request_1 = require("../utils/api-request");
const error_1 = require("../utils/error");
const utils = require("../utils/index");
const validator = require("../utils/validator");
const deep_copy_1 = require("../utils/deep-copy");
// Remote Config backend constants
/**
  * Allows the `FIREBASE_REMOTE_CONFIG_URL_BASE` environment
  * variable to override the default API endpoint URL.
  */
const FIREBASE_REMOTE_CONFIG_URL_BASE = process.env.FIREBASE_REMOTE_CONFIG_URL_BASE || 'https://firebaseremoteconfig.googleapis.com';
const FIREBASE_REMOTE_CONFIG_HEADERS = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`,
    // There is a known issue in which the ETag is not properly returned in cases where the request
    // does not specify a compression type. Currently, it is required to include the header
    // `Accept-Encoding: gzip` or equivalent in all requests.
    // https://firebase.google.com/docs/remote-config/use-config-rest#etag_usage_and_forced_updates
    'Accept-Encoding': 'gzip',
};
/**
 * Class that facilitates sending requests to the Firebase Remote Config backend API.
 *
 * @internal
 */
class RemoteConfigApiClient {
    constructor(app) {
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'First argument passed to admin.remoteConfig() must be a valid Firebase app instance.');
        }
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
    }
    getTemplate() {
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/remoteConfig`,
                headers: FIREBASE_REMOTE_CONFIG_HEADERS
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            return this.toRemoteConfigTemplate(resp);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    getTemplateAtVersion(versionNumber) {
        const data = { versionNumber: this.validateVersionNumber(versionNumber) };
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/remoteConfig`,
                headers: FIREBASE_REMOTE_CONFIG_HEADERS,
                data
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            return this.toRemoteConfigTemplate(resp);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    validateTemplate(template) {
        template = this.validateInputRemoteConfigTemplate(template);
        return this.sendPutRequest(template, template.etag, true)
            .then((resp) => {
            // validating a template returns an etag with the suffix -0 means that your update
            // was successfully validated. We set the etag back to the original etag of the template
            // to allow future operations.
            this.validateEtag(resp.headers['etag']);
            return this.toRemoteConfigTemplate(resp, template.etag);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    publishTemplate(template, options) {
        template = this.validateInputRemoteConfigTemplate(template);
        let ifMatch = template.etag;
        if (options && options.force === true) {
            // setting `If-Match: *` forces the Remote Config template to be updated
            // and circumvent the ETag, and the protection from that it provides.
            ifMatch = '*';
        }
        return this.sendPutRequest(template, ifMatch)
            .then((resp) => {
            return this.toRemoteConfigTemplate(resp);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    rollback(versionNumber) {
        const data = { versionNumber: this.validateVersionNumber(versionNumber) };
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'POST',
                url: `${url}/remoteConfig:rollback`,
                headers: FIREBASE_REMOTE_CONFIG_HEADERS,
                data
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            return this.toRemoteConfigTemplate(resp);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    listVersions(options) {
        if (typeof options !== 'undefined') {
            options = this.validateListVersionsOptions(options);
        }
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/remoteConfig:listVersions`,
                headers: FIREBASE_REMOTE_CONFIG_HEADERS,
                data: options
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            return resp.data;
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    getServerTemplate() {
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/namespaces/firebase-server/serverRemoteConfig`,
                headers: FIREBASE_REMOTE_CONFIG_HEADERS
            };
            return this.httpClient.send(request);
        })
            .then((resp) => {
            return this.toRemoteConfigServerTemplate(resp);
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    sendPutRequest(template, etag, validateOnly) {
        let path = 'remoteConfig';
        if (validateOnly) {
            path += '?validate_only=true';
        }
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'PUT',
                url: `${url}/${path}`,
                headers: { ...FIREBASE_REMOTE_CONFIG_HEADERS, 'If-Match': etag },
                data: {
                    conditions: template.conditions,
                    parameters: template.parameters,
                    parameterGroups: template.parameterGroups,
                    version: template.version,
                }
            };
            return this.httpClient.send(request);
        });
    }
    getUrl() {
        return this.getProjectIdPrefix()
            .then((projectIdPrefix) => {
            return `${FIREBASE_REMOTE_CONFIG_URL_BASE}/v1/${projectIdPrefix}`;
        });
    }
    getProjectIdPrefix() {
        if (this.projectIdPrefix) {
            return Promise.resolve(this.projectIdPrefix);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new FirebaseRemoteConfigError('unknown-error', 'Failed to determine project ID. Initialize the SDK with service account credentials, or '
                    + 'set project ID as an app option. Alternatively, set the GOOGLE_CLOUD_PROJECT '
                    + 'environment variable.');
            }
            this.projectIdPrefix = `projects/${projectId}`;
            return this.projectIdPrefix;
        });
    }
    toFirebaseError(err) {
        if (err instanceof error_1.PrefixedFirebaseError) {
            return err;
        }
        const response = err.response;
        if (!response.isJson()) {
            return new FirebaseRemoteConfigError('unknown-error', `Unexpected response with status: ${response.status} and body: ${response.text}`);
        }
        const error = response.data.error || {};
        let code = 'unknown-error';
        if (error.status && error.status in ERROR_CODE_MAPPING) {
            code = ERROR_CODE_MAPPING[error.status];
        }
        const message = error.message || `Unknown server error: ${response.text}`;
        return new FirebaseRemoteConfigError(code, message);
    }
    /**
     * Creates a RemoteConfigTemplate from the API response.
     * If provided, customEtag is used instead of the etag returned in the API response.
     *
     * @param {HttpResponse} resp API response object.
     * @param {string} customEtag A custom etag to replace the etag fom the API response (Optional).
     */
    toRemoteConfigTemplate(resp, customEtag) {
        const etag = (typeof customEtag === 'undefined') ? resp.headers['etag'] : customEtag;
        this.validateEtag(etag);
        return {
            conditions: resp.data.conditions,
            parameters: resp.data.parameters,
            parameterGroups: resp.data.parameterGroups,
            etag,
            version: resp.data.version,
        };
    }
    /**
     * Creates a RemoteConfigServerTemplate from the API response.
     * If provided, customEtag is used instead of the etag returned in the API response.
     *
     * @param {HttpResponse} resp API response object.
     * @param {string} customEtag A custom etag to replace the etag fom the API response (Optional).
     */
    toRemoteConfigServerTemplate(resp, customEtag) {
        const etag = (typeof customEtag === 'undefined') ? resp.headers['etag'] : customEtag;
        this.validateEtag(etag);
        return {
            conditions: resp.data.conditions,
            parameters: resp.data.parameters,
            etag,
            version: resp.data.version,
        };
    }
    /**
     * Checks if the given RemoteConfigTemplate object is valid.
     * The object must have valid parameters, parameter groups, conditions, and an etag.
     * Removes output only properties from version metadata.
     *
     * @param {RemoteConfigTemplate} template A RemoteConfigTemplate object to be validated.
     *
     * @returns {RemoteConfigTemplate} The validated RemoteConfigTemplate object.
     */
    validateInputRemoteConfigTemplate(template) {
        const templateCopy = (0, deep_copy_1.deepCopy)(template);
        if (!validator.isNonNullObject(templateCopy)) {
            throw new FirebaseRemoteConfigError('invalid-argument', `Invalid Remote Config template: ${JSON.stringify(templateCopy)}`);
        }
        if (!validator.isNonEmptyString(templateCopy.etag)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'ETag must be a non-empty string.');
        }
        if (!validator.isNonNullObject(templateCopy.parameters)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'Remote Config parameters must be a non-null object');
        }
        if (!validator.isNonNullObject(templateCopy.parameterGroups)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'Remote Config parameter groups must be a non-null object');
        }
        if (!validator.isArray(templateCopy.conditions)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'Remote Config conditions must be an array');
        }
        if (typeof templateCopy.version !== 'undefined') {
            // exclude output only properties and keep the only input property: description
            templateCopy.version = { description: templateCopy.version.description };
        }
        return templateCopy;
    }
    /**
     * Checks if a given version number is valid.
     * A version number must be an integer or a string in int64 format.
     * If valid, returns the string representation of the provided version number.
     *
     * @param {string|number} versionNumber A version number to be validated.
     *
     * @returns {string} The validated version number as a string.
     */
    validateVersionNumber(versionNumber, propertyName = 'versionNumber') {
        if (!validator.isNonEmptyString(versionNumber) &&
            !validator.isNumber(versionNumber)) {
            throw new FirebaseRemoteConfigError('invalid-argument', `${propertyName} must be a non-empty string in int64 format or a number`);
        }
        if (!Number.isInteger(Number(versionNumber))) {
            throw new FirebaseRemoteConfigError('invalid-argument', `${propertyName} must be an integer or a string in int64 format`);
        }
        return versionNumber.toString();
    }
    validateEtag(etag) {
        if (!validator.isNonEmptyString(etag)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'ETag header is not present in the server response.');
        }
    }
    /**
     * Checks if a given `ListVersionsOptions` object is valid. If successful, creates a copy of the
     * options object and convert `startTime` and `endTime` to RFC3339 UTC "Zulu" format, if present.
     *
     * @param {ListVersionsOptions} options An options object to be validated.
     *
     * @returns {ListVersionsOptions} A copy of the provided options object with timestamps converted
     * to UTC Zulu format.
     */
    validateListVersionsOptions(options) {
        const optionsCopy = (0, deep_copy_1.deepCopy)(options);
        if (!validator.isNonNullObject(optionsCopy)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'ListVersionsOptions must be a non-null object.');
        }
        if (typeof optionsCopy.pageSize !== 'undefined') {
            if (!validator.isNumber(optionsCopy.pageSize)) {
                throw new FirebaseRemoteConfigError('invalid-argument', 'pageSize must be a number.');
            }
            if (optionsCopy.pageSize < 1 || optionsCopy.pageSize > 300) {
                throw new FirebaseRemoteConfigError('invalid-argument', 'pageSize must be a number between 1 and 300 (inclusive).');
            }
        }
        if (typeof optionsCopy.pageToken !== 'undefined' && !validator.isNonEmptyString(optionsCopy.pageToken)) {
            throw new FirebaseRemoteConfigError('invalid-argument', 'pageToken must be a string value.');
        }
        if (typeof optionsCopy.endVersionNumber !== 'undefined') {
            optionsCopy.endVersionNumber = this.validateVersionNumber(optionsCopy.endVersionNumber, 'endVersionNumber');
        }
        if (typeof optionsCopy.startTime !== 'undefined') {
            if (!(optionsCopy.startTime instanceof Date) && !validator.isUTCDateString(optionsCopy.startTime)) {
                throw new FirebaseRemoteConfigError('invalid-argument', 'startTime must be a valid Date object or a UTC date string.');
            }
            // Convert startTime to RFC3339 UTC "Zulu" format.
            if (optionsCopy.startTime instanceof Date) {
                optionsCopy.startTime = optionsCopy.startTime.toISOString();
            }
            else {
                optionsCopy.startTime = new Date(optionsCopy.startTime).toISOString();
            }
        }
        if (typeof optionsCopy.endTime !== 'undefined') {
            if (!(optionsCopy.endTime instanceof Date) && !validator.isUTCDateString(optionsCopy.endTime)) {
                throw new FirebaseRemoteConfigError('invalid-argument', 'endTime must be a valid Date object or a UTC date string.');
            }
            // Convert endTime to RFC3339 UTC "Zulu" format.
            if (optionsCopy.endTime instanceof Date) {
                optionsCopy.endTime = optionsCopy.endTime.toISOString();
            }
            else {
                optionsCopy.endTime = new Date(optionsCopy.endTime).toISOString();
            }
        }
        // Remove undefined fields from optionsCopy
        Object.keys(optionsCopy).forEach(key => (typeof optionsCopy[key] === 'undefined') && delete optionsCopy[key]);
        return optionsCopy;
    }
}
exports.RemoteConfigApiClient = RemoteConfigApiClient;
const ERROR_CODE_MAPPING = {
    ABORTED: 'aborted',
    ALREADY_EXISTS: 'already-exists',
    INVALID_ARGUMENT: 'invalid-argument',
    INTERNAL: 'internal-error',
    FAILED_PRECONDITION: 'failed-precondition',
    NOT_FOUND: 'not-found',
    OUT_OF_RANGE: 'out-of-range',
    PERMISSION_DENIED: 'permission-denied',
    RESOURCE_EXHAUSTED: 'resource-exhausted',
    UNAUTHENTICATED: 'unauthenticated',
    UNKNOWN: 'unknown-error',
};
/**
 * Firebase Remote Config error code structure. This extends PrefixedFirebaseError.
 *
 * @param {RemoteConfigErrorCode} code The error code.
 * @param {string} message The error message.
 * @constructor
 */
class FirebaseRemoteConfigError extends error_1.PrefixedFirebaseError {
    constructor(code, message) {
        super('remote-config', code, message);
    }
}
exports.FirebaseRemoteConfigError = FirebaseRemoteConfigError;
