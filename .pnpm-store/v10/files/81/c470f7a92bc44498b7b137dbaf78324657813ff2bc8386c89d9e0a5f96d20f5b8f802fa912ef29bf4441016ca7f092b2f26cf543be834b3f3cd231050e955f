/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2024 Google Inc.
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
exports.FirebaseDataConnectError = exports.DATA_CONNECT_ERROR_CODE_MAPPING = exports.DataConnectApiClient = void 0;
exports.useEmulator = useEmulator;
const api_request_1 = require("../utils/api-request");
const error_1 = require("../utils/error");
const utils = require("../utils/index");
const validator = require("../utils/validator");
const API_VERSION = 'v1alpha';
/** The Firebase Data Connect backend base URL format. */
const FIREBASE_DATA_CONNECT_BASE_URL_FORMAT = 'https://firebasedataconnect.googleapis.com/{version}/projects/{projectId}/locations/{locationId}/services/{serviceId}:{endpointId}';
/** Firebase Data Connect base URl format when using the Data Connect emultor. */
const FIREBASE_DATA_CONNECT_EMULATOR_BASE_URL_FORMAT = 'http://{host}/{version}/projects/{projectId}/locations/{locationId}/services/{serviceId}:{endpointId}';
const EXECUTE_GRAPH_QL_ENDPOINT = 'executeGraphql';
const EXECUTE_GRAPH_QL_READ_ENDPOINT = 'executeGraphqlRead';
const DATA_CONNECT_CONFIG_HEADERS = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`
};
/**
 * Class that facilitates sending requests to the Firebase Data Connect backend API.
 *
 * @internal
 */
class DataConnectApiClient {
    constructor(connectorConfig, app) {
        this.connectorConfig = connectorConfig;
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, 'First argument passed to getDataConnect() must be a valid Firebase app instance.');
        }
        this.httpClient = new DataConnectHttpClient(app);
    }
    /**
     * Execute arbitrary GraphQL, including both read and write queries
     *
     * @param query - The GraphQL string to be executed.
     * @param options - GraphQL Options
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    async executeGraphql(query, options) {
        return this.executeGraphqlHelper(query, EXECUTE_GRAPH_QL_ENDPOINT, options);
    }
    /**
     * Execute arbitrary read-only GraphQL queries
     *
     * @param query - The GraphQL (read-only) string to be executed.
     * @param options - GraphQL Options
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     * @throws FirebaseDataConnectError
     */
    async executeGraphqlRead(query, options) {
        return this.executeGraphqlHelper(query, EXECUTE_GRAPH_QL_READ_ENDPOINT, options);
    }
    async executeGraphqlHelper(query, endpoint, options) {
        if (!validator.isNonEmptyString(query)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`query` must be a non-empty string.');
        }
        if (typeof options !== 'undefined') {
            if (!validator.isNonNullObject(options)) {
                throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, 'GraphqlOptions must be a non-null object');
            }
        }
        const data = {
            query,
            ...(options?.variables && { variables: options?.variables }),
            ...(options?.operationName && { operationName: options?.operationName }),
            ...(options?.impersonate && { extensions: { impersonate: options?.impersonate } }),
        };
        return this.getUrl(API_VERSION, this.connectorConfig.location, this.connectorConfig.serviceId, endpoint)
            .then(async (url) => {
            const request = {
                method: 'POST',
                url,
                headers: DATA_CONNECT_CONFIG_HEADERS,
                data,
            };
            const resp = await this.httpClient.send(request);
            if (resp.data.errors && validator.isNonEmptyArray(resp.data.errors)) {
                const allMessages = resp.data.errors.map((error) => error.message).join(' ');
                throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.QUERY_ERROR, allMessages);
            }
            return Promise.resolve({
                data: resp.data.data,
            });
        })
            .then((resp) => {
            return resp;
        })
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    async getUrl(version, locationId, serviceId, endpointId) {
        return this.getProjectId()
            .then((projectId) => {
            const urlParams = {
                version,
                projectId,
                locationId,
                serviceId,
                endpointId
            };
            let urlFormat;
            if (useEmulator()) {
                urlFormat = utils.formatString(FIREBASE_DATA_CONNECT_EMULATOR_BASE_URL_FORMAT, {
                    host: emulatorHost()
                });
            }
            else {
                urlFormat = FIREBASE_DATA_CONNECT_BASE_URL_FORMAT;
            }
            return utils.formatString(urlFormat, urlParams);
        });
    }
    getProjectId() {
        if (this.projectId) {
            return Promise.resolve(this.projectId);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.UNKNOWN, 'Failed to determine project ID. Initialize the '
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
            return new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.UNKNOWN, `Unexpected response with status: ${response.status} and body: ${response.text}`);
        }
        const error = response.data.error || {};
        let code = exports.DATA_CONNECT_ERROR_CODE_MAPPING.UNKNOWN;
        if (error.status && error.status in exports.DATA_CONNECT_ERROR_CODE_MAPPING) {
            code = exports.DATA_CONNECT_ERROR_CODE_MAPPING[error.status];
        }
        const message = error.message || `Unknown server error: ${response.text}`;
        return new FirebaseDataConnectError(code, message);
    }
    /**
     * Converts JSON data into a GraphQL literal string.
     * Handles nested objects, arrays, strings, numbers, and booleans.
     * Ensures strings are properly escaped.
     */
    objectToString(data) {
        if (typeof data === 'string') {
            const escapedString = data
                .replace(/\\/g, '\\\\') // Replace \ with \\
                .replace(/"/g, '\\"'); // Replace " with \"
            return `"${escapedString}"`;
        }
        if (typeof data === 'number' || typeof data === 'boolean' || data === null) {
            return String(data);
        }
        if (validator.isArray(data)) {
            const elements = data.map(item => this.objectToString(item)).join(', ');
            return `[${elements}]`;
        }
        if (typeof data === 'object' && data !== null) {
            // Filter out properties where the value is undefined BEFORE mapping
            const kvPairs = Object.entries(data)
                .filter(([, val]) => val !== undefined)
                .map(([key, val]) => {
                // GraphQL object keys are typically unquoted.
                return `${key}: ${this.objectToString(val)}`;
            });
            if (kvPairs.length === 0) {
                return '{}'; // Represent an object with no defined properties as {}
            }
            return `{ ${kvPairs.join(', ')} }`;
        }
        // If value is undefined (and not an object property, which is handled above,
        // e.g., if objectToString(undefined) is called directly or for an array element)
        // it should be represented as 'null'.
        if (typeof data === 'undefined') {
            return 'null';
        }
        // Fallback for any other types (e.g., Symbol, BigInt - though less common in GQL contexts)
        // Consider how these should be handled or if an error should be thrown.
        // For now, simple string conversion.
        return String(data);
    }
    formatTableName(tableName) {
        // Format tableName: first character to lowercase
        if (tableName && tableName.length > 0) {
            return tableName.charAt(0).toLowerCase() + tableName.slice(1);
        }
        return tableName;
    }
    handleBulkImportErrors(err) {
        if (err.code === `data-connect/${exports.DATA_CONNECT_ERROR_CODE_MAPPING.QUERY_ERROR}`) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.QUERY_ERROR, `${err.message}. Make sure that your table name passed in matches the type name in your GraphQL schema file.`);
        }
        throw err;
    }
    /**
     * Insert a single row into the specified table.
     */
    async insert(tableName, data) {
        if (!validator.isNonEmptyString(tableName)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`tableName` must be a non-empty string.');
        }
        if (validator.isArray(data)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`data` must be an object, not an array, for single insert. For arrays, please use `insertMany` function.');
        }
        if (!validator.isNonNullObject(data)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`data` must be a non-null object.');
        }
        try {
            tableName = this.formatTableName(tableName);
            const gqlDataString = this.objectToString(data);
            const mutation = `mutation { ${tableName}_insert(data: ${gqlDataString}) }`;
            // Use internal executeGraphql
            return this.executeGraphql(mutation).catch(this.handleBulkImportErrors);
        }
        catch (e) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INTERNAL, `Failed to construct insert mutation: ${e.message}`);
        }
    }
    /**
     * Insert multiple rows into the specified table.
     */
    async insertMany(tableName, data) {
        if (!validator.isNonEmptyString(tableName)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`tableName` must be a non-empty string.');
        }
        if (!validator.isNonEmptyArray(data)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`data` must be a non-empty array for insertMany.');
        }
        try {
            tableName = this.formatTableName(tableName);
            const gqlDataString = this.objectToString(data);
            const mutation = `mutation { ${tableName}_insertMany(data: ${gqlDataString}) }`;
            // Use internal executeGraphql
            return this.executeGraphql(mutation).catch(this.handleBulkImportErrors);
        }
        catch (e) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INTERNAL, `Failed to construct insertMany mutation: ${e.message}`);
        }
    }
    /**
     * Insert a single row into the specified table, or update it if it already exists.
     */
    async upsert(tableName, data) {
        if (!validator.isNonEmptyString(tableName)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`tableName` must be a non-empty string.');
        }
        if (validator.isArray(data)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`data` must be an object, not an array, for single upsert. For arrays, please use `upsertMany` function.');
        }
        if (!validator.isNonNullObject(data)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`data` must be a non-null object.');
        }
        try {
            tableName = this.formatTableName(tableName);
            const gqlDataString = this.objectToString(data);
            const mutation = `mutation { ${tableName}_upsert(data: ${gqlDataString}) }`;
            // Use internal executeGraphql
            return this.executeGraphql(mutation).catch(this.handleBulkImportErrors);
        }
        catch (e) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INTERNAL, `Failed to construct upsert mutation: ${e.message}`);
        }
    }
    /**
     * Insert multiple rows into the specified table, or update them if they already exist.
     */
    async upsertMany(tableName, data) {
        if (!validator.isNonEmptyString(tableName)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`tableName` must be a non-empty string.');
        }
        if (!validator.isNonEmptyArray(data)) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INVALID_ARGUMENT, '`data` must be a non-empty array for upsertMany.');
        }
        try {
            tableName = this.formatTableName(tableName);
            const gqlDataString = this.objectToString(data);
            const mutation = `mutation { ${tableName}_upsertMany(data: ${gqlDataString}) }`;
            // Use internal executeGraphql
            return this.executeGraphql(mutation).catch(this.handleBulkImportErrors);
        }
        catch (e) {
            throw new FirebaseDataConnectError(exports.DATA_CONNECT_ERROR_CODE_MAPPING.INTERNAL, `Failed to construct upsertMany mutation: ${e.message}`);
        }
    }
}
exports.DataConnectApiClient = DataConnectApiClient;
/**
 * Data Connect-specific HTTP client which uses the special "owner" token
 * when communicating with the Data Connect Emulator.
 */
class DataConnectHttpClient extends api_request_1.AuthorizedHttpClient {
    getToken() {
        if (useEmulator()) {
            return Promise.resolve('owner');
        }
        return super.getToken();
    }
}
function emulatorHost() {
    return process.env.DATA_CONNECT_EMULATOR_HOST;
}
/**
 * When true the SDK should communicate with the Data Connect Emulator for all API
 * calls and also produce unsigned tokens.
 */
function useEmulator() {
    return !!emulatorHost();
}
exports.DATA_CONNECT_ERROR_CODE_MAPPING = {
    ABORTED: 'aborted',
    INVALID_ARGUMENT: 'invalid-argument',
    INVALID_CREDENTIAL: 'invalid-credential',
    INTERNAL: 'internal-error',
    PERMISSION_DENIED: 'permission-denied',
    UNAUTHENTICATED: 'unauthenticated',
    NOT_FOUND: 'not-found',
    UNKNOWN: 'unknown-error',
    QUERY_ERROR: 'query-error',
};
/**
 * Firebase Data Connect error code structure. This extends PrefixedFirebaseError.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
class FirebaseDataConnectError extends error_1.PrefixedFirebaseError {
    constructor(code, message) {
        super('data-connect', code, message);
        /* tslint:disable:max-line-length */
        // Set the prototype explicitly. See the following link for more details:
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        /* tslint:enable:max-line-length */
        this.__proto__ = FirebaseDataConnectError.prototype;
    }
}
exports.FirebaseDataConnectError = FirebaseDataConnectError;
