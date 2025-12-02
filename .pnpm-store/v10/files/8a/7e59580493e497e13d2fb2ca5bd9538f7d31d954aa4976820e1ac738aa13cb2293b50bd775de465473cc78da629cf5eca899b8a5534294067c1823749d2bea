/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2019 Google Inc.
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
exports.SecurityRulesApiClient = void 0;
const api_request_1 = require("../utils/api-request");
const error_1 = require("../utils/error");
const security_rules_internal_1 = require("./security-rules-internal");
const utils = require("../utils/index");
const validator = require("../utils/validator");
const RULES_V1_API = 'https://firebaserules.googleapis.com/v1';
const FIREBASE_VERSION_HEADER = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`,
};
/**
 * Class that facilitates sending requests to the Firebase security rules backend API.
 *
 * @private
 */
class SecurityRulesApiClient {
    constructor(app) {
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'First argument passed to admin.securityRules() must be a valid Firebase app '
                + 'instance.');
        }
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
    }
    getRuleset(name) {
        return Promise.resolve()
            .then(() => {
            return this.getRulesetName(name);
        })
            .then((rulesetName) => {
            return this.getResource(rulesetName);
        });
    }
    createRuleset(ruleset) {
        if (!validator.isNonNullObject(ruleset) ||
            !validator.isNonNullObject(ruleset.source) ||
            !validator.isNonEmptyArray(ruleset.source.files)) {
            const err = new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Invalid rules content.');
            return Promise.reject(err);
        }
        for (const rf of ruleset.source.files) {
            if (!validator.isNonNullObject(rf) ||
                !validator.isNonEmptyString(rf.name) ||
                !validator.isNonEmptyString(rf.content)) {
                const err = new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', `Invalid rules file argument: ${JSON.stringify(rf)}`);
                return Promise.reject(err);
            }
        }
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'POST',
                url: `${url}/rulesets`,
                data: ruleset,
            };
            return this.sendRequest(request);
        });
    }
    deleteRuleset(name) {
        return this.getUrl()
            .then((url) => {
            const rulesetName = this.getRulesetName(name);
            const request = {
                method: 'DELETE',
                url: `${url}/${rulesetName}`,
            };
            return this.sendRequest(request);
        });
    }
    listRulesets(pageSize = 100, pageToken) {
        if (!validator.isNumber(pageSize)) {
            const err = new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Invalid page size.');
            return Promise.reject(err);
        }
        if (pageSize < 1 || pageSize > 100) {
            const err = new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Page size must be between 1 and 100.');
            return Promise.reject(err);
        }
        if (typeof pageToken !== 'undefined' && !validator.isNonEmptyString(pageToken)) {
            const err = new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Next page token must be a non-empty string.');
            return Promise.reject(err);
        }
        const data = {
            pageSize,
            pageToken,
        };
        if (!pageToken) {
            delete data.pageToken;
        }
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/rulesets`,
                data,
            };
            return this.sendRequest(request);
        });
    }
    getRelease(name) {
        return this.getResource(`releases/${name}`);
    }
    updateOrCreateRelease(name, rulesetName) {
        return this.updateRelease(name, rulesetName).catch((error) => {
            // if ruleset update failed with a NOT_FOUND error, attempt to create instead.
            if (error.code === `security-rules/${ERROR_CODE_MAPPING.NOT_FOUND}`) {
                return this.createRelease(name, rulesetName);
            }
            throw error;
        });
    }
    updateRelease(name, rulesetName) {
        return this.getUrl()
            .then((url) => {
            return this.getReleaseDescription(name, rulesetName)
                .then((release) => {
                const request = {
                    method: 'PATCH',
                    url: `${url}/releases/${name}`,
                    data: { release },
                };
                return this.sendRequest(request);
            });
        });
    }
    createRelease(name, rulesetName) {
        return this.getUrl()
            .then((url) => {
            return this.getReleaseDescription(name, rulesetName)
                .then((release) => {
                const request = {
                    method: 'POST',
                    url: `${url}/releases`,
                    data: release,
                };
                return this.sendRequest(request);
            });
        });
    }
    getUrl() {
        return this.getProjectIdPrefix()
            .then((projectIdPrefix) => {
            return `${RULES_V1_API}/${projectIdPrefix}`;
        });
    }
    getProjectIdPrefix() {
        if (this.projectIdPrefix) {
            return Promise.resolve(this.projectIdPrefix);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Failed to determine project ID. Initialize the SDK with service account credentials, or '
                    + 'set project ID as an app option. Alternatively, set the GOOGLE_CLOUD_PROJECT '
                    + 'environment variable.');
            }
            this.projectIdPrefix = `projects/${projectId}`;
            return this.projectIdPrefix;
        });
    }
    /**
     * Gets the specified resource from the rules API. Resource names must be the short names without project
     * ID prefix (e.g. `rulesets/ruleset-name`).
     *
     * @param {string} name Full qualified name of the resource to get.
     * @returns {Promise<T>} A promise that fulfills with the resource.
     */
    getResource(name) {
        return this.getUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/${name}`,
            };
            return this.sendRequest(request);
        });
    }
    getReleaseDescription(name, rulesetName) {
        return this.getProjectIdPrefix()
            .then((projectIdPrefix) => {
            return {
                name: `${projectIdPrefix}/releases/${name}`,
                rulesetName: `${projectIdPrefix}/${this.getRulesetName(rulesetName)}`,
            };
        });
    }
    getRulesetName(name) {
        if (!validator.isNonEmptyString(name)) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Ruleset name must be a non-empty string.');
        }
        if (name.indexOf('/') !== -1) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Ruleset name must not contain any "/" characters.');
        }
        return `rulesets/${name}`;
    }
    sendRequest(request) {
        request.headers = FIREBASE_VERSION_HEADER;
        return this.httpClient.send(request)
            .then((resp) => {
            return resp.data;
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    toFirebaseError(err) {
        if (err instanceof error_1.PrefixedFirebaseError) {
            return err;
        }
        const response = err.response;
        if (!response.isJson()) {
            return new security_rules_internal_1.FirebaseSecurityRulesError('unknown-error', `Unexpected response with status: ${response.status} and body: ${response.text}`);
        }
        const error = response.data.error || {};
        let code = 'unknown-error';
        if (error.status && error.status in ERROR_CODE_MAPPING) {
            code = ERROR_CODE_MAPPING[error.status];
        }
        const message = error.message || `Unknown server error: ${response.text}`;
        return new security_rules_internal_1.FirebaseSecurityRulesError(code, message);
    }
}
exports.SecurityRulesApiClient = SecurityRulesApiClient;
const ERROR_CODE_MAPPING = {
    INVALID_ARGUMENT: 'invalid-argument',
    NOT_FOUND: 'not-found',
    RESOURCE_EXHAUSTED: 'resource-exhausted',
    UNAUTHENTICATED: 'authentication-error',
    UNKNOWN: 'unknown-error',
};
