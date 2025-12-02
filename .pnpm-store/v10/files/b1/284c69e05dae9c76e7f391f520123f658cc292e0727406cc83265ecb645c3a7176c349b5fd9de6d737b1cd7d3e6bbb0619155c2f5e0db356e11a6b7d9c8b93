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
exports.MachineLearningApiClient = void 0;
exports.isGcsTfliteModelOptions = isGcsTfliteModelOptions;
const api_request_1 = require("../utils/api-request");
const error_1 = require("../utils/error");
const utils = require("../utils/index");
const validator = require("../utils/validator");
const machine_learning_utils_1 = require("./machine-learning-utils");
const ML_V1BETA2_API = 'https://firebaseml.googleapis.com/v1beta2';
const FIREBASE_VERSION_HEADER = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`,
};
// Operation polling defaults
const POLL_DEFAULT_MAX_TIME_MILLISECONDS = 120000; // Maximum overall 2 minutes
const POLL_BASE_WAIT_TIME_MILLISECONDS = 3000; // Start with 3 second delay
const POLL_MAX_WAIT_TIME_MILLISECONDS = 30000; // Maximum 30 second delay
function isGcsTfliteModelOptions(options) {
    const gcsUri = options?.tfliteModel?.gcsTfliteUri;
    return typeof gcsUri !== 'undefined';
}
/**
 * Class that facilitates sending requests to the Firebase ML backend API.
 *
 * @internal
 */
class MachineLearningApiClient {
    constructor(app) {
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'First argument passed to admin.machineLearning() must be a valid '
                + 'Firebase app instance.');
        }
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
    }
    createModel(model) {
        if (!validator.isNonNullObject(model) ||
            !validator.isNonEmptyString(model.displayName)) {
            const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Invalid model content.');
            return Promise.reject(err);
        }
        return this.getProjectUrl()
            .then((url) => {
            const request = {
                method: 'POST',
                url: `${url}/models`,
                data: model,
            };
            return this.sendRequest(request);
        });
    }
    updateModel(modelId, model, updateMask) {
        if (!validator.isNonEmptyString(modelId) ||
            !validator.isNonNullObject(model) ||
            !validator.isNonEmptyArray(updateMask)) {
            const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Invalid model or mask content.');
            return Promise.reject(err);
        }
        return this.getProjectUrl()
            .then((url) => {
            const request = {
                method: 'PATCH',
                url: `${url}/models/${modelId}?updateMask=${updateMask.join()}`,
                data: model,
            };
            return this.sendRequest(request);
        });
    }
    getModel(modelId) {
        return Promise.resolve()
            .then(() => {
            return this.getModelName(modelId);
        })
            .then((modelName) => {
            return this.getResourceWithShortName(modelName);
        });
    }
    getOperation(operationName) {
        return Promise.resolve()
            .then(() => {
            return this.getResourceWithFullName(operationName);
        });
    }
    listModels(options = {}) {
        if (!validator.isNonNullObject(options)) {
            const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Invalid ListModelsOptions');
            return Promise.reject(err);
        }
        if (typeof options.filter !== 'undefined' && !validator.isNonEmptyString(options.filter)) {
            const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Invalid list filter.');
            return Promise.reject(err);
        }
        if (typeof options.pageSize !== 'undefined') {
            if (!validator.isNumber(options.pageSize)) {
                const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Invalid page size.');
                return Promise.reject(err);
            }
            if (options.pageSize < 1 || options.pageSize > 100) {
                const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Page size must be between 1 and 100.');
                return Promise.reject(err);
            }
        }
        if (typeof options.pageToken !== 'undefined' && !validator.isNonEmptyString(options.pageToken)) {
            const err = new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Next page token must be a non-empty string.');
            return Promise.reject(err);
        }
        return this.getProjectUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/models`,
                data: options,
            };
            return this.sendRequest(request);
        });
    }
    deleteModel(modelId) {
        return this.getProjectUrl()
            .then((url) => {
            const modelName = this.getModelName(modelId);
            const request = {
                method: 'DELETE',
                url: `${url}/${modelName}`,
            };
            return this.sendRequest(request);
        });
    }
    /**
     * Handles a Long Running Operation coming back from the server.
     *
     * @param op - The operation to handle
     * @param options - The options for polling
     */
    handleOperation(op, options) {
        if (op.done) {
            if (op.response) {
                return Promise.resolve(op.response);
            }
            else if (op.error) {
                const err = machine_learning_utils_1.FirebaseMachineLearningError.fromOperationError(op.error.code, op.error.message);
                return Promise.reject(err);
            }
            // Done operations must have either a response or an error.
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-server-response', 'Invalid operation response.');
        }
        // Operation is not done
        if (options?.wait) {
            return this.pollOperationWithExponentialBackoff(op.name, options);
        }
        const metadata = op.metadata || {};
        const metadataType = metadata['@type'] || '';
        if (!metadataType.includes('ModelOperationMetadata')) {
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-server-response', `Unknown Metadata type: ${JSON.stringify(metadata)}`);
        }
        return this.getModel(extractModelId(metadata.name));
    }
    // baseWaitMillis and maxWaitMillis should only ever be modified by unit tests to run faster.
    pollOperationWithExponentialBackoff(opName, options) {
        const maxTimeMilliseconds = options?.maxTimeMillis ?? POLL_DEFAULT_MAX_TIME_MILLISECONDS;
        const baseWaitMillis = options?.baseWaitMillis ?? POLL_BASE_WAIT_TIME_MILLISECONDS;
        const maxWaitMillis = options?.maxWaitMillis ?? POLL_MAX_WAIT_TIME_MILLISECONDS;
        const poller = new api_request_1.ExponentialBackoffPoller(baseWaitMillis, maxWaitMillis, maxTimeMilliseconds);
        return poller.poll(() => {
            return this.getOperation(opName)
                .then((responseData) => {
                if (!responseData.done) {
                    return null;
                }
                if (responseData.error) {
                    const err = machine_learning_utils_1.FirebaseMachineLearningError.fromOperationError(responseData.error.code, responseData.error.message);
                    throw err;
                }
                return responseData.response;
            });
        });
    }
    /**
     * Gets the specified resource from the ML API. Resource names must be the short names without project
     * ID prefix (e.g. `models/123456789`).
     *
     * @param {string} name Short name of the resource to get. e.g. 'models/12345'
     * @returns {Promise<T>} A promise that fulfills with the resource.
     */
    getResourceWithShortName(name) {
        return this.getProjectUrl()
            .then((url) => {
            const request = {
                method: 'GET',
                url: `${url}/${name}`,
            };
            return this.sendRequest(request);
        });
    }
    /**
     * Gets the specified resource from the ML API. Resource names must be the full names including project
     * number prefix.
     * @param fullName - Full resource name of the resource to get. e.g. projects/123465/operations/987654
     * @returns {Promise<T>} A promise that fulfulls with the resource.
     */
    getResourceWithFullName(fullName) {
        const request = {
            method: 'GET',
            url: `${ML_V1BETA2_API}/${fullName}`
        };
        return this.sendRequest(request);
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
            return new machine_learning_utils_1.FirebaseMachineLearningError('unknown-error', `Unexpected response with status: ${response.status} and body: ${response.text}`);
        }
        const error = response.data.error || {};
        let code = 'unknown-error';
        if (error.status && error.status in ERROR_CODE_MAPPING) {
            code = ERROR_CODE_MAPPING[error.status];
        }
        const message = error.message || `Unknown server error: ${response.text}`;
        return new machine_learning_utils_1.FirebaseMachineLearningError(code, message);
    }
    getProjectUrl() {
        return this.getProjectIdPrefix()
            .then((projectIdPrefix) => {
            return `${ML_V1BETA2_API}/${projectIdPrefix}`;
        });
    }
    getProjectIdPrefix() {
        if (this.projectIdPrefix) {
            return Promise.resolve(this.projectIdPrefix);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Failed to determine project ID. Initialize the SDK with service account credentials, or '
                    + 'set project ID as an app option. Alternatively, set the GOOGLE_CLOUD_PROJECT '
                    + 'environment variable.');
            }
            this.projectIdPrefix = `projects/${projectId}`;
            return this.projectIdPrefix;
        });
    }
    getModelName(modelId) {
        if (!validator.isNonEmptyString(modelId)) {
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Model ID must be a non-empty string.');
        }
        if (modelId.indexOf('/') !== -1) {
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', 'Model ID must not contain any "/" characters.');
        }
        return `models/${modelId}`;
    }
}
exports.MachineLearningApiClient = MachineLearningApiClient;
const ERROR_CODE_MAPPING = {
    INVALID_ARGUMENT: 'invalid-argument',
    NOT_FOUND: 'not-found',
    RESOURCE_EXHAUSTED: 'resource-exhausted',
    UNAUTHENTICATED: 'authentication-error',
    UNKNOWN: 'unknown-error',
};
function extractModelId(resourceName) {
    return resourceName.split('/').pop();
}
