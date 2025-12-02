"use strict";
/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Firestore = exports.DEFAULT_MAX_IDLE_CHANNELS = exports.DEFAULT_MAX_TRANSACTION_ATTEMPTS = exports.MAX_REQUEST_RETRIES = exports.AggregateField = exports.Aggregate = exports.setLogFunction = exports.QueryPartition = exports.CollectionGroup = exports.GeoPoint = exports.FieldPath = exports.DocumentChange = exports.Timestamp = exports.Transaction = exports.WriteResult = exports.WriteBatch = exports.Filter = exports.VectorValue = exports.FieldValue = exports.QueryDocumentSnapshot = exports.DocumentSnapshot = exports.BulkWriter = exports.Query = exports.QuerySnapshot = exports.DocumentReference = exports.CollectionReference = void 0;
const stream_1 = require("stream");
const url_1 = require("url");
const backoff_1 = require("./backoff");
const bulk_writer_1 = require("./bulk-writer");
const bundle_1 = require("./bundle");
const convert_1 = require("./convert");
const document_reader_1 = require("./document-reader");
const document_1 = require("./document");
const logger_1 = require("./logger");
const path_1 = require("./path");
const pool_1 = require("./pool");
const collection_reference_1 = require("./reference/collection-reference");
const document_reference_1 = require("./reference/document-reference");
const serializer_1 = require("./serializer");
const timestamp_1 = require("./timestamp");
const transaction_1 = require("./transaction");
const util_1 = require("./util");
const validate_1 = require("./validate");
const write_batch_1 = require("./write-batch");
const firestore_client_config_json_1 = require("./v1/firestore_client_config.json");
const serviceConfig = firestore_client_config_json_1.interfaces['google.firestore.v1.Firestore'];
const collection_group_1 = require("./collection-group");
Object.defineProperty(exports, "CollectionGroup", { enumerable: true, get: function () { return collection_group_1.CollectionGroup; } });
const recursive_delete_1 = require("./recursive-delete");
const trace_util_1 = require("./telemetry/trace-util");
const disabled_trace_util_1 = require("./telemetry/disabled-trace-util");
const enabled_trace_util_1 = require("./telemetry/enabled-trace-util");
var collection_reference_2 = require("./reference/collection-reference");
Object.defineProperty(exports, "CollectionReference", { enumerable: true, get: function () { return collection_reference_2.CollectionReference; } });
var document_reference_2 = require("./reference/document-reference");
Object.defineProperty(exports, "DocumentReference", { enumerable: true, get: function () { return document_reference_2.DocumentReference; } });
var query_snapshot_1 = require("./reference/query-snapshot");
Object.defineProperty(exports, "QuerySnapshot", { enumerable: true, get: function () { return query_snapshot_1.QuerySnapshot; } });
var query_1 = require("./reference/query");
Object.defineProperty(exports, "Query", { enumerable: true, get: function () { return query_1.Query; } });
var bulk_writer_2 = require("./bulk-writer");
Object.defineProperty(exports, "BulkWriter", { enumerable: true, get: function () { return bulk_writer_2.BulkWriter; } });
var document_2 = require("./document");
Object.defineProperty(exports, "DocumentSnapshot", { enumerable: true, get: function () { return document_2.DocumentSnapshot; } });
Object.defineProperty(exports, "QueryDocumentSnapshot", { enumerable: true, get: function () { return document_2.QueryDocumentSnapshot; } });
var field_value_1 = require("./field-value");
Object.defineProperty(exports, "FieldValue", { enumerable: true, get: function () { return field_value_1.FieldValue; } });
Object.defineProperty(exports, "VectorValue", { enumerable: true, get: function () { return field_value_1.VectorValue; } });
var filter_1 = require("./filter");
Object.defineProperty(exports, "Filter", { enumerable: true, get: function () { return filter_1.Filter; } });
var write_batch_2 = require("./write-batch");
Object.defineProperty(exports, "WriteBatch", { enumerable: true, get: function () { return write_batch_2.WriteBatch; } });
Object.defineProperty(exports, "WriteResult", { enumerable: true, get: function () { return write_batch_2.WriteResult; } });
var transaction_2 = require("./transaction");
Object.defineProperty(exports, "Transaction", { enumerable: true, get: function () { return transaction_2.Transaction; } });
var timestamp_2 = require("./timestamp");
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return timestamp_2.Timestamp; } });
var document_change_1 = require("./document-change");
Object.defineProperty(exports, "DocumentChange", { enumerable: true, get: function () { return document_change_1.DocumentChange; } });
var path_2 = require("./path");
Object.defineProperty(exports, "FieldPath", { enumerable: true, get: function () { return path_2.FieldPath; } });
var geo_point_1 = require("./geo-point");
Object.defineProperty(exports, "GeoPoint", { enumerable: true, get: function () { return geo_point_1.GeoPoint; } });
var query_partition_1 = require("./query-partition");
Object.defineProperty(exports, "QueryPartition", { enumerable: true, get: function () { return query_partition_1.QueryPartition; } });
var logger_2 = require("./logger");
Object.defineProperty(exports, "setLogFunction", { enumerable: true, get: function () { return logger_2.setLogFunction; } });
var aggregate_1 = require("./aggregate");
Object.defineProperty(exports, "Aggregate", { enumerable: true, get: function () { return aggregate_1.Aggregate; } });
Object.defineProperty(exports, "AggregateField", { enumerable: true, get: function () { return aggregate_1.AggregateField; } });
const libVersion = require('../../package.json').version;
(0, logger_1.setLibVersion)(libVersion);
/*!
 * DO NOT REMOVE THE FOLLOWING NAMESPACE DEFINITIONS
 */
/**
 * @namespace google.protobuf
 */
/**
 * @namespace google.rpc
 */
/**
 * @namespace google.longrunning
 */
/**
 * @namespace google.firestore.v1
 */
/**
 * @namespace google.firestore.v1beta1
 */
/**
 * @namespace google.firestore.admin.v1
 */
/*!
 * HTTP header for the resource prefix to improve routing and project isolation
 * by the backend.
 */
const CLOUD_RESOURCE_HEADER = 'google-cloud-resource-prefix';
/**
 * The maximum number of times to retry idempotent requests.
 * @private
 */
exports.MAX_REQUEST_RETRIES = 5;
/**
 * The maximum number of times to attempt a transaction before failing.
 * @private
 */
exports.DEFAULT_MAX_TRANSACTION_ATTEMPTS = 5;
/*!
 * The default number of idle GRPC channel to keep.
 */
exports.DEFAULT_MAX_IDLE_CHANNELS = 1;
/*!
 * The maximum number of concurrent requests supported by a single GRPC channel,
 * as enforced by Google's Frontend. If the SDK issues more than 100 concurrent
 * operations, we need to use more than one GAPIC client since these clients
 * multiplex all requests over a single channel.
 */
const MAX_CONCURRENT_REQUESTS_PER_CLIENT = 100;
/**
 * Document data (e.g. for use with
 * [set()]{@link DocumentReference#set}) consisting of fields mapped
 * to values.
 *
 * @typedef {Object.<string, *>} DocumentData
 */
/**
 * Converter used by [withConverter()]{@link Query#withConverter} to transform
 * user objects of type `AppModelType` into Firestore data of type
 * `DbModelType`.
 *
 * Using the converter allows you to specify generic type arguments when storing
 * and retrieving objects from Firestore.
 *
 * @example
 * ```
 * class Post {
 *   constructor(readonly title: string, readonly author: string) {}
 *
 *   toString(): string {
 *     return this.title + ', by ' + this.author;
 *   }
 * }
 *
 * const postConverter = {
 *   toFirestore(post: Post): FirebaseFirestore.DocumentData {
 *     return {title: post.title, author: post.author};
 *   },
 *   fromFirestore(
 *     snapshot: FirebaseFirestore.QueryDocumentSnapshot
 *   ): Post {
 *     const data = snapshot.data();
 *     return new Post(data.title, data.author);
 *   }
 * };
 *
 * const postSnap = await Firestore()
 *   .collection('posts')
 *   .withConverter(postConverter)
 *   .doc().get();
 * const post = postSnap.data();
 * if (post !== undefined) {
 *   post.title; // string
 *   post.toString(); // Should be defined
 *   post.someNonExistentProperty; // TS error
 * }
 *
 * ```
 * @property {Function} toFirestore Called by the Firestore SDK to convert a
 * custom model object of type `AppModelType` into a plain Javascript object
 * (suitable for writing directly to the Firestore database).
 * @property {Function} fromFirestore Called by the Firestore SDK to convert
 * Firestore data into an object of type `AppModelType`.
 * @typedef {Object} FirestoreDataConverter
 */
/**
 * Update data (for use with [update]{@link DocumentReference#update})
 * that contains paths mapped to values. Fields that contain dots
 * reference nested fields within the document.
 *
 * You can update a top-level field in your document by using the field name
 * as a key (e.g. `foo`). The provided value completely replaces the contents
 * for this field.
 *
 * You can also update a nested field directly by using its field path as a key
 * (e.g. `foo.bar`). This nested field update replaces the contents at `bar`
 * but does not modify other data under `foo`.
 *
 * @example
 * ```
 * const documentRef = firestore.doc('coll/doc');
 * documentRef.set({a1: {a2: 'val'}, b1: {b2: 'val'}, c1: {c2: 'val'}});
 * documentRef.update({
 *  b1: {b3: 'val'},
 *  'c1.c3': 'val',
 * });
 * // Value is {a1: {a2: 'val'}, b1: {b3: 'val'}, c1: {c2: 'val', c3: 'val'}}
 *
 * ```
 * @typedef {Object.<string, *>} UpdateData
 */
/**
 * An options object that configures conditional behavior of
 * [update()]{@link DocumentReference#update} and
 * [delete()]{@link DocumentReference#delete} calls in
 * [DocumentReference]{@link DocumentReference},
 * [WriteBatch]{@link WriteBatch}, [BulkWriter]{@link BulkWriter}, and
 * [Transaction]{@link Transaction}. Using Preconditions, these calls
 * can be restricted to only apply to documents that match the specified
 * conditions.
 *
 * @example
 * ```
 * const documentRef = firestore.doc('coll/doc');
 *
 * documentRef.get().then(snapshot => {
 *   const updateTime = snapshot.updateTime;
 *
 *   console.log(`Deleting document at update time: ${updateTime.toDate()}`);
 *   return documentRef.delete({ lastUpdateTime: updateTime });
 * });
 *
 * ```
 * @property {Timestamp} lastUpdateTime The update time to enforce. If set,
 *  enforces that the document was last updated at lastUpdateTime. Fails the
 *  operation if the document was last updated at a different time.
 * @property {boolean} exists If set, enforces that the target document must
 * or must not exist.
 * @typedef {Object} Precondition
 */
/**
 * An options object that configures the behavior of
 * [set()]{@link DocumentReference#set} calls in
 * [DocumentReference]{@link DocumentReference},
 * [WriteBatch]{@link WriteBatch}, and
 * [Transaction]{@link Transaction}. These calls can be
 * configured to perform granular merges instead of overwriting the target
 * documents in their entirety by providing a SetOptions object with
 * { merge : true }.
 *
 * @property {boolean} merge Changes the behavior of a set() call to only
 * replace the values specified in its data argument. Fields omitted from the
 * set() call remain untouched.
 * @property {Array<(string|FieldPath)>} mergeFields Changes the behavior of
 * set() calls to only replace the specified field paths. Any field path that is
 * not specified is ignored and remains untouched.
 * It is an error to pass a SetOptions object to a set() call that is missing a
 * value for any of the fields specified here.
 * @typedef {Object} SetOptions
 */
/**
 * An options object that can be used to configure the behavior of
 * [getAll()]{@link Firestore#getAll} calls. By providing a `fieldMask`, these
 * calls can be configured to only return a subset of fields.
 *
 * @property {Array<(string|FieldPath)>} fieldMask Specifies the set of fields
 * to return and reduces the amount of data transmitted by the backend.
 * Adding a field mask does not filter results. Documents do not need to
 * contain values for all the fields in the mask to be part of the result set.
 * @typedef {Object} ReadOptions
 */
/**
 * An options object to configure throttling on BulkWriter.
 *
 * Whether to disable or configure throttling. By default, throttling is
 * enabled. `throttling` can be set to either a boolean or a config object.
 * Setting it to `true` will use default values. You can override the defaults
 * by setting it to `false` to disable throttling, or by setting the config
 * values to enable throttling with the provided values.
 *
 * @property {boolean|Object} throttling Whether to disable or enable
 * throttling. Throttling is enabled by default, if the field is set to `true`
 * or if any custom throttling options are provided. `{ initialOpsPerSecond:
 * number }` sets the initial maximum number of operations per second allowed by
 * the throttler. If `initialOpsPerSecond` is not set, the default is 500
 * operations per second. `{ maxOpsPerSecond: number }` sets the maximum number
 * of operations per second allowed by the throttler. If `maxOpsPerSecond` is
 * not set, no maximum is enforced.
 * @typedef {Object} BulkWriterOptions
 */
/**
 * An error thrown when a BulkWriter operation fails.
 *
 * The error used by {@link BulkWriter~shouldRetryCallback} set in
 * {@link BulkWriter#onWriteError}.
 *
 * @property {GrpcStatus} code The status code of the error.
 * @property {string} message The error message of the error.
 * @property {DocumentReference} documentRef The document reference the
 * operation was performed on.
 * @property {'create' | 'set' | 'update' | 'delete'} operationType The type
 * of operation performed.
 * @property {number} failedAttempts How many times this operation has been
 * attempted unsuccessfully.
 * @typedef {Error} BulkWriterError
 */
/**
 * Status codes returned by GRPC operations.
 *
 * @see https://github.com/grpc/grpc/blob/master/doc/statuscodes.md
 *
 * @enum {number}
 * @typedef {Object} GrpcStatus
 */
/**
 * The Firestore client represents a Firestore Database and is the entry point
 * for all Firestore operations.
 *
 * @see [Firestore Documentation]{@link https://firebase.google.com/docs/firestore/}
 *
 * @class
 *
 * @example Install the client library with <a href="https://www.npmjs.com/">npm</a>:
 * ```
 * npm install --save @google-cloud/firestore
 *
 * ```
 * @example Import the client library
 * ```
 * var Firestore = require('@google-cloud/firestore');
 *
 * ```
 * @example Create a client that uses <a href="https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application">Application Default Credentials (ADC)</a>:
 * ```
 * var firestore = new Firestore();
 *
 * ```
 * @example Create a client with <a href="https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually">explicit credentials</a>:
 * ```
 * var firestore = new Firestore({ projectId:
 * 'your-project-id', keyFilename: '/path/to/keyfile.json'
 * });
 *
 * ```
 * @example <caption>include:samples/quickstart.js</caption>
 * region_tag:firestore_quickstart
 * Full quickstart example:
 */
class Firestore {
    /**
     * Lazy-load the Firestore's default BulkWriter.
     *
     * @private
     * @internal
     */
    getBulkWriter() {
        if (!this._bulkWriter) {
            this._bulkWriter = this.bulkWriter();
        }
        return this._bulkWriter;
    }
    /**
     * @param {Object=} settings [Configuration object](#/docs).
     * @param {string=} settings.projectId The project ID from the Google
     * Developer's Console, e.g. 'grape-spaceship-123'. We will also check the
     * environment variable GCLOUD_PROJECT for your project ID.  Can be omitted in
     * environments that support
     * {@link https://cloud.google.com/docs/authentication Application Default
     * Credentials}
     * @param {string=} settings.keyFilename Local file containing the Service
     * Account credentials as downloaded from the Google Developers Console. Can
     * be omitted in environments that support
     * {@link https://cloud.google.com/docs/authentication Application Default
     * Credentials}. To configure Firestore with custom credentials, use
     * `settings.credentials` and provide the `client_email` and `private_key` of
     * your service account.
     * @param {{client_email:string=, private_key:string=}=} settings.credentials
     * The `client_email` and `private_key` properties of the service account
     * to use with your Firestore project. Can be omitted in environments that
     * support {@link https://cloud.google.com/docs/authentication Application
     * Default Credentials}. If your credentials are stored in a JSON file, you
     * can specify a `keyFilename` instead.
     * @param {string=} settings.host The host to connect to.
     * @param {boolean=} settings.ssl Whether to use SSL when connecting.
     * @param {number=} settings.maxIdleChannels The maximum number of idle GRPC
     * channels to keep. A smaller number of idle channels reduces memory usage
     * but increases request latency for clients with fluctuating request rates.
     * If set to 0, shuts down all GRPC channels when the client becomes idle.
     * Defaults to 1.
     * @param {boolean=} settings.ignoreUndefinedProperties Whether to skip nested
     * properties that are set to `undefined` during object serialization. If set
     * to `true`, these properties are skipped and not written to Firestore. If
     * set `false` or omitted, the SDK throws an exception when it encounters
     * properties of type `undefined`.
     * @param {boolean=} settings.preferRest Whether to force the use of HTTP/1.1 REST
     * transport until a method that requires gRPC is called. When a method requires gRPC,
     * this Firestore client will load dependent gRPC libraries and then use gRPC transport
     * for communication from that point forward. Currently the only operation
     * that requires gRPC is creating a snapshot listener with the method
     * `DocumentReference<T>.onSnapshot()`, `CollectionReference<T>.onSnapshot()`, or
     * `Query<T>.onSnapshot()`. If specified, this setting value will take precedent over the
     * environment variable `FIRESTORE_PREFER_REST`. If not specified, the
     * SDK will use the value specified in the environment variable `FIRESTORE_PREFER_REST`.
     * Valid values of `FIRESTORE_PREFER_REST` are `true` ('1') or `false` (`0`). Values are
     * not case-sensitive. Any other value for the environment variable will be ignored and
     * a warning will be logged to the console.
     */
    constructor(settings) {
        /**
         * The configuration options for the GAPIC client.
         * @private
         * @internal
         */
        this._settings = {};
        /**
         * Whether the initialization settings can still be changed by invoking
         * `settings()`.
         * @private
         * @internal
         */
        this._settingsFrozen = false;
        /**
         * The serializer to use for the Protobuf transformation.
         * @private
         * @internal
         */
        this._serializer = null;
        /**
         * The project ID for this client.
         *
         * The project ID is auto-detected during the first request unless a project
         * ID is passed to the constructor (or provided via `.settings()`).
         * @private
         * @internal
         */
        this._projectId = undefined;
        /**
         * The database ID provided via `.settings()`.
         *
         * @private
         * @internal
         */
        this._databaseId = undefined;
        /**
         * Count of listeners that have been registered on the client.
         *
         * The client can only be terminated when there are no pending writes or
         * registered listeners.
         * @private
         * @internal
         */
        this.registeredListenersCount = 0;
        /**
         * Number of pending operations on the client.
         *
         * The client can only be terminated when there are no pending writes or
         * registered listeners.
         * @private
         * @internal
         */
        this.bulkWritersCount = 0;
        const libraryHeader = {
            libName: 'gccl',
            libVersion,
        };
        if (settings && settings.firebaseVersion) {
            libraryHeader.libVersion += ' fire/' + settings.firebaseVersion;
        }
        if (settings && settings.firebaseAdminVersion) {
            libraryHeader.libVersion +=
                ' fire-admin/' + settings.firebaseAdminVersion;
        }
        this.validateAndApplySettings({ ...settings, ...libraryHeader });
        this._traceUtil = this.newTraceUtilInstance(this._settings);
        const retryConfig = serviceConfig.retry_params.default;
        this._backoffSettings = {
            initialDelayMs: retryConfig.initial_retry_delay_millis,
            maxDelayMs: retryConfig.max_retry_delay_millis,
            backoffFactor: retryConfig.retry_delay_multiplier,
        };
        const maxIdleChannels = this._settings.maxIdleChannels === undefined
            ? exports.DEFAULT_MAX_IDLE_CHANNELS
            : this._settings.maxIdleChannels;
        this._clientPool = new pool_1.ClientPool(MAX_CONCURRENT_REQUESTS_PER_CLIENT, maxIdleChannels, 
        /* clientFactory= */ (requiresGrpc) => {
            var _a;
            let client;
            // Use the rest fallback if enabled and if the method does not require GRPC
            const useFallback = !this._settings.preferRest || requiresGrpc ? false : 'rest';
            let gax;
            if (useFallback) {
                if (!this._gaxFallback) {
                    gax = this._gaxFallback = require('google-gax/build/src/fallback');
                }
                else {
                    gax = this._gaxFallback;
                }
            }
            else {
                if (!this._gax) {
                    gax = this._gax = require('google-gax');
                }
                else {
                    gax = this._gax;
                }
            }
            if (this._settings.ssl === false) {
                const grpcModule = (_a = this._settings.grpc) !== null && _a !== void 0 ? _a : require('google-gax').grpc;
                const sslCreds = grpcModule.credentials.createInsecure();
                const settings = {
                    sslCreds,
                    ...this._settings,
                    fallback: useFallback,
                };
                // Since `ssl === false`, if we're using the GAX fallback then
                // also set the `protocol` option for GAX fallback to force http
                if (useFallback) {
                    settings.protocol = 'http';
                }
                client = new module.exports.v1(settings, gax);
            }
            else {
                client = new module.exports.v1({
                    ...this._settings,
                    fallback: useFallback,
                }, gax);
            }
            (0, logger_1.logger)('clientFactory', null, 'Initialized Firestore GAPIC Client (useFallback: %s)', useFallback);
            return client;
        }, 
        /* clientDestructor= */ client => client.close());
        (0, logger_1.logger)('Firestore', null, 'Initialized Firestore');
    }
    /**
     * Specifies custom settings to be used to configure the `Firestore`
     * instance. Can only be invoked once and before any other Firestore method.
     *
     * If settings are provided via both `settings()` and the `Firestore`
     * constructor, both settings objects are merged and any settings provided via
     * `settings()` take precedence.
     *
     * @param {object} settings The settings to use for all Firestore operations.
     */
    settings(settings) {
        (0, validate_1.validateObject)('settings', settings);
        (0, validate_1.validateString)('settings.projectId', settings.projectId, { optional: true });
        (0, validate_1.validateString)('settings.databaseId', settings.databaseId, {
            optional: true,
        });
        if (this._settingsFrozen) {
            throw new Error('Firestore has already been initialized. You can only call ' +
                'settings() once, and only before calling any other methods on a ' +
                'Firestore object.');
        }
        const mergedSettings = { ...this._settings, ...settings };
        this.validateAndApplySettings(mergedSettings);
        this._traceUtil = this.newTraceUtilInstance(this._settings);
        this._settingsFrozen = true;
    }
    validateAndApplySettings(settings) {
        var _a;
        if (settings.projectId !== undefined) {
            (0, validate_1.validateString)('settings.projectId', settings.projectId);
            this._projectId = settings.projectId;
        }
        if (settings.databaseId !== undefined) {
            (0, validate_1.validateString)('settings.databaseId', settings.databaseId);
            this._databaseId = settings.databaseId;
        }
        let url = null;
        // If preferRest is not specified in settings, but is set as environment variable,
        // then use the environment variable value.
        const preferRestEnvValue = (0, util_1.tryGetPreferRestEnvironmentVariable)();
        if (settings.preferRest === undefined && preferRestEnvValue !== undefined) {
            settings = {
                ...settings,
                preferRest: preferRestEnvValue,
            };
        }
        // If the environment variable is set, it should always take precedence
        // over any user passed in settings.
        if (process.env.FIRESTORE_EMULATOR_HOST) {
            (0, validate_1.validateHost)('FIRESTORE_EMULATOR_HOST', process.env.FIRESTORE_EMULATOR_HOST);
            settings = {
                ...settings,
                host: process.env.FIRESTORE_EMULATOR_HOST,
                ssl: false,
            };
            url = new url_1.URL(`http://${settings.host}`);
        }
        else if (settings.host !== undefined) {
            (0, validate_1.validateHost)('settings.host', settings.host);
            url = new url_1.URL(`http://${settings.host}`);
        }
        // Only store the host if a valid value was provided in `host`.
        if (url !== null) {
            if ((settings.servicePath !== undefined &&
                settings.servicePath !== url.hostname) ||
                (settings.apiEndpoint !== undefined &&
                    settings.apiEndpoint !== url.hostname)) {
                // eslint-disable-next-line no-console
                console.warn(`The provided host (${url.hostname}) in "settings" does not ` +
                    `match the existing host (${(_a = settings.servicePath) !== null && _a !== void 0 ? _a : settings.apiEndpoint}). Using the provided host.`);
            }
            settings.servicePath = url.hostname;
            if (url.port !== '' && settings.port === undefined) {
                settings.port = Number(url.port);
            }
            // We need to remove the `host` and `apiEndpoint` setting, in case a user
            // calls `settings()`, which will compare the the provided `host` to the
            // existing hostname stored on `servicePath`.
            delete settings.host;
            delete settings.apiEndpoint;
        }
        if (settings.ssl !== undefined) {
            (0, validate_1.validateBoolean)('settings.ssl', settings.ssl);
        }
        if (settings.maxIdleChannels !== undefined) {
            (0, validate_1.validateInteger)('settings.maxIdleChannels', settings.maxIdleChannels, {
                minValue: 0,
            });
        }
        this._settings = settings;
        this._settings.toJSON = function () {
            const temp = Object.assign({}, this);
            if (temp.credentials) {
                temp.credentials = { private_key: '***', client_email: '***' };
            }
            return temp;
        };
        this._serializer = new serializer_1.Serializer(this);
    }
    newTraceUtilInstance(settings) {
        let createEnabledInstance = true;
        // The environment variable can override options to enable/disable telemetry collection.
        if ('FIRESTORE_ENABLE_TRACING' in process.env) {
            const enableTracingEnvVar = process.env.FIRESTORE_ENABLE_TRACING.toLowerCase();
            if (enableTracingEnvVar === 'on' || enableTracingEnvVar === 'true') {
                createEnabledInstance = true;
            }
            if (enableTracingEnvVar === 'off' || enableTracingEnvVar === 'false') {
                createEnabledInstance = false;
            }
        }
        if (createEnabledInstance) {
            return new enabled_trace_util_1.EnabledTraceUtil(settings);
        }
        else {
            return new disabled_trace_util_1.DisabledTraceUtil();
        }
    }
    /**
     * Returns the Project ID for this Firestore instance. Validates that
     * `initializeIfNeeded()` was called before.
     *
     * @private
     * @internal
     */
    get projectId() {
        if (this._projectId === undefined) {
            throw new Error('INTERNAL ERROR: Client is not yet ready to issue requests.');
        }
        return this._projectId;
    }
    /**
     * Returns the Database ID for this Firestore instance.
     */
    get databaseId() {
        return this._databaseId || path_1.DEFAULT_DATABASE_ID;
    }
    /**
     * Returns the root path of the database. Validates that
     * `initializeIfNeeded()` was called before.
     *
     * @private
     * @internal
     */
    get formattedName() {
        return `projects/${this.projectId}/databases/${this.databaseId}`;
    }
    /**
     * Gets a [DocumentReference]{@link DocumentReference} instance that
     * refers to the document at the specified path.
     *
     * @param {string} documentPath A slash-separated path to a document.
     * @returns {DocumentReference} The
     * [DocumentReference]{@link DocumentReference} instance.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('collection/document');
     * console.log(`Path of document is ${documentRef.path}`);
     * ```
     */
    doc(documentPath) {
        (0, path_1.validateResourcePath)('documentPath', documentPath);
        const path = path_1.ResourcePath.EMPTY.append(documentPath);
        if (!path.isDocument) {
            throw new Error(`Value for argument "documentPath" must point to a document, but was "${documentPath}". Your path does not contain an even number of components.`);
        }
        return new document_reference_1.DocumentReference(this, path);
    }
    /**
     * Gets a [CollectionReference]{@link CollectionReference} instance
     * that refers to the collection at the specified path.
     *
     * @param {string} collectionPath A slash-separated path to a collection.
     * @returns {CollectionReference} The
     * [CollectionReference]{@link CollectionReference} instance.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('collection');
     *
     * // Add a document with an auto-generated ID.
     * collectionRef.add({foo: 'bar'}).then((documentRef) => {
     *   console.log(`Added document at ${documentRef.path})`);
     * });
     * ```
     */
    collection(collectionPath) {
        (0, path_1.validateResourcePath)('collectionPath', collectionPath);
        const path = path_1.ResourcePath.EMPTY.append(collectionPath);
        if (!path.isCollection) {
            throw new Error(`Value for argument "collectionPath" must point to a collection, but was "${collectionPath}". Your path does not contain an odd number of components.`);
        }
        return new collection_reference_1.CollectionReference(this, path);
    }
    /**
     * Creates and returns a new Query that includes all documents in the
     * database that are contained in a collection or subcollection with the
     * given collectionId.
     *
     * @param {string} collectionId Identifies the collections to query over.
     * Every collection or subcollection with this ID as the last segment of its
     * path will be included. Cannot contain a slash.
     * @returns {CollectionGroup} The created CollectionGroup.
     *
     * @example
     * ```
     * let docA = firestore.doc('mygroup/docA').set({foo: 'bar'});
     * let docB = firestore.doc('abc/def/mygroup/docB').set({foo: 'bar'});
     *
     * Promise.all([docA, docB]).then(() => {
     *    let query = firestore.collectionGroup('mygroup');
     *    query = query.where('foo', '==', 'bar');
     *    return query.get().then(snapshot => {
     *       console.log(`Found ${snapshot.size} documents.`);
     *    });
     * });
     * ```
     */
    collectionGroup(collectionId) {
        if (collectionId.indexOf('/') !== -1) {
            throw new Error(`Invalid collectionId '${collectionId}'. Collection IDs must not contain '/'.`);
        }
        return new collection_group_1.CollectionGroup(this, collectionId, /* converter= */ undefined);
    }
    /**
     * Creates a [WriteBatch]{@link WriteBatch}, used for performing
     * multiple writes as a single atomic operation.
     *
     * @returns {WriteBatch} A WriteBatch that operates on this Firestore
     * client.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     *
     * // Add two documents in an atomic batch.
     * let data = { foo: 'bar' };
     * writeBatch.set(firestore.doc('col/doc1'), data);
     * writeBatch.set(firestore.doc('col/doc2'), data);
     *
     * writeBatch.commit().then(res => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    batch() {
        return new write_batch_1.WriteBatch(this);
    }
    /**
     * Creates a [BulkWriter]{@link BulkWriter}, used for performing
     * multiple writes in parallel. Gradually ramps up writes as specified
     * by the 500/50/5 rule.
     *
     * If you pass [BulkWriterOptions]{@link BulkWriterOptions}, you can
     * configure the throttling rates for the created BulkWriter.
     *
     * @see [500/50/5 Documentation]{@link https://firebase.google.com/docs/firestore/best-practices#ramping_up_traffic}
     *
     * @param {BulkWriterOptions=} options BulkWriter options.
     * @returns {BulkWriter} A BulkWriter that operates on this Firestore
     * client.
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     *
     * bulkWriter.create(firestore.doc('col/doc1'), {foo: 'bar'})
     *   .then(res => {
     *     console.log(`Added document at ${res.writeTime}`);
     *   });
     * bulkWriter.update(firestore.doc('col/doc2'), {foo: 'bar'})
     *   .then(res => {
     *     console.log(`Updated document at ${res.writeTime}`);
     *   });
     * bulkWriter.delete(firestore.doc('col/doc3'))
     *   .then(res => {
     *     console.log(`Deleted document at ${res.writeTime}`);
     *   });
     * await bulkWriter.close().then(() => {
     *   console.log('Executed all writes');
     * });
     * ```
     */
    bulkWriter(options) {
        return new bulk_writer_1.BulkWriter(this, options);
    }
    /** @private */
    snapshot_(documentOrName, readTime, encoding) {
        // TODO: Assert that Firestore Project ID is valid.
        let convertTimestamp;
        let convertFields;
        if (encoding === undefined || encoding === 'protobufJS') {
            convertTimestamp = data => data;
            convertFields = data => data;
        }
        else if (encoding === 'json') {
            // Google Cloud Functions calls us with Proto3 JSON format data, which we
            // must convert to Protobuf JS.
            convertTimestamp = convert_1.timestampFromJson;
            convertFields = convert_1.fieldsFromJson;
        }
        else {
            throw new Error('Unsupported encoding format. Expected "json" or "protobufJS", ' +
                `but was "${encoding}".`);
        }
        let ref;
        let document;
        if (typeof documentOrName === 'string') {
            ref = new document_reference_1.DocumentReference(this, path_1.QualifiedResourcePath.fromSlashSeparatedString(documentOrName));
            document = new document_1.DocumentSnapshotBuilder(ref);
        }
        else {
            ref = new document_reference_1.DocumentReference(this, path_1.QualifiedResourcePath.fromSlashSeparatedString(documentOrName.name));
            document = new document_1.DocumentSnapshotBuilder(ref);
            document.fieldsProto = documentOrName.fields
                ? convertFields(documentOrName.fields)
                : {};
            document.createTime = timestamp_1.Timestamp.fromProto(convertTimestamp(documentOrName.createTime, 'documentOrName.createTime'));
            document.updateTime = timestamp_1.Timestamp.fromProto(convertTimestamp(documentOrName.updateTime, 'documentOrName.updateTime'));
        }
        if (readTime) {
            document.readTime = timestamp_1.Timestamp.fromProto(convertTimestamp(readTime, 'readTime'));
        }
        return document.build();
    }
    /**
     * Creates a new `BundleBuilder` instance to package selected Firestore data into
     * a bundle.
     *
     * @param bundleId. The id of the bundle. When loaded on clients, client SDKs use this id
     * and the timestamp associated with the built bundle to tell if it has been loaded already.
     * If not specified, a random identifier will be used.
     */
    bundle(name) {
        return new bundle_1.BundleBuilder(name || (0, util_1.autoId)());
    }
    /**
     * Function executed by {@link Firestore#runTransaction} within the transaction
     * context.
     *
     * @callback Firestore~updateFunction
     * @template T
     * @param {Transaction} transaction The transaction object for this
     * transaction.
     * @returns {Promise<T>} The promise returned at the end of the transaction.
     * This promise will be returned by {@link Firestore#runTransaction} if the
     * transaction completed successfully.
     */
    /**
     * Options object for {@link Firestore#runTransaction} to configure a
     * read-only transaction.
     *
     * @param {true} readOnly Set to true to indicate a read-only transaction.
     * @param {Timestamp=} readTime If specified, documents are read at the given
     * time. This may not be more than 60 seconds in the past from when the
     * request is processed by the server.
     * @typedef {Object} Firestore~ReadOnlyTransactionOptions
     */
    /**
     * Options object for {@link Firestore#runTransaction} to configure a
     * read-write transaction.
     *
     * @param {false=} readOnly Set to false or omit to indicate a read-write
     * transaction.
     * @param {number=} maxAttempts The maximum number of attempts for this
     * transaction. Defaults to 5.
     * @typedef {Object} Firestore~ReadWriteTransactionOptions
     */
    /**
     * Executes the given updateFunction and commits the changes applied within
     * the transaction.
     *
     * You can use the transaction object passed to 'updateFunction' to read and
     * modify Firestore documents under lock. You have to perform all reads before
     * before you perform any write.
     *
     * Transactions can be performed as read-only or read-write transactions. By
     * default, transactions are executed in read-write mode.
     *
     * A read-write transaction obtains a pessimistic lock on all documents that
     * are read during the transaction. These locks block other transactions,
     * batched writes, and other non-transactional writes from changing that
     * document. Any writes in a read-write transactions are committed once
     * 'updateFunction' resolves, which also releases all locks.
     *
     * If a read-write transaction fails with contention, the transaction is
     * retried up to five times. The `updateFunction` is invoked once for each
     * attempt.
     *
     * Read-only transactions do not lock documents. They can be used to read
     * documents at a consistent snapshot in time, which may be up to 60 seconds
     * in the past. Read-only transactions are not retried.
     *
     * Transactions time out after 60 seconds if no documents are read.
     * Transactions that are not committed within than 270 seconds are also
     * aborted. Any remaining locks are released when a transaction times out.
     *
     * @template T
     * @param {Firestore~updateFunction} updateFunction The user function to
     * execute within the transaction context.
     * @param {
     * Firestore~ReadWriteTransactionOptions|Firestore~ReadOnlyTransactionOptions=
     * } transactionOptions Transaction options.
     * @returns {Promise<T>} If the transaction completed successfully or was
     * explicitly aborted (by the updateFunction returning a failed Promise), the
     * Promise returned by the updateFunction will be returned here. Else if the
     * transaction failed, a rejected Promise with the corresponding failure
     * error will be returned.
     *
     * @example
     * ```
     * let counterTransaction = firestore.runTransaction(transaction => {
     *   let documentRef = firestore.doc('col/doc');
     *   return transaction.get(documentRef).then(doc => {
     *     if (doc.exists) {
     *       let count =  doc.get('count') || 0;
     *       if (count > 10) {
     *         return Promise.reject('Reached maximum count');
     *       }
     *       transaction.update(documentRef, { count: ++count });
     *       return Promise.resolve(count);
     *     }
     *
     *     transaction.create(documentRef, { count: 1 });
     *     return Promise.resolve(1);
     *   });
     * });
     *
     * counterTransaction.then(res => {
     *   console.log(`Count updated to ${res}`);
     * });
     * ```
     */
    runTransaction(updateFunction, transactionOptions) {
        (0, validate_1.validateFunction)('updateFunction', updateFunction);
        const tag = (0, util_1.requestTag)();
        if (transactionOptions) {
            (0, validate_1.validateObject)('transactionOptions', transactionOptions);
            (0, validate_1.validateBoolean)('transactionOptions.readOnly', transactionOptions.readOnly, { optional: true });
            if (transactionOptions.readOnly) {
                (0, validate_1.validateTimestamp)('transactionOptions.readTime', transactionOptions.readTime, { optional: true });
            }
            else {
                (0, validate_1.validateInteger)('transactionOptions.maxAttempts', transactionOptions.maxAttempts, { optional: true, minValue: 1 });
            }
        }
        const transaction = new transaction_1.Transaction(this, tag, transactionOptions);
        return this.initializeIfNeeded(tag).then(() => transaction.runTransaction(updateFunction));
    }
    /**
     * Fetches the root collections that are associated with this Firestore
     * database.
     *
     * @returns {Promise.<Array.<CollectionReference>>} A Promise that resolves
     * with an array of CollectionReferences.
     *
     * @example
     * ```
     * firestore.listCollections().then(collections => {
     *   for (let collection of collections) {
     *     console.log(`Found collection with id: ${collection.id}`);
     *   }
     * });
     * ```
     */
    listCollections() {
        const rootDocument = new document_reference_1.DocumentReference(this, path_1.ResourcePath.EMPTY);
        return rootDocument.listCollections();
    }
    /**
     * Retrieves multiple documents from Firestore.
     *
     * The first argument is required and must be of type `DocumentReference`
     * followed by any additional `DocumentReference` documents. If used, the
     * optional `ReadOptions` must be the last argument.
     *
     * @param {...DocumentReference|ReadOptions} documentRefsOrReadOptions The
     * `DocumentReferences` to receive, followed by an optional field mask.
     * @returns {Promise<Array.<DocumentSnapshot>>} A Promise that
     * contains an array with the resulting document snapshots.
     *
     * @example
     * ```
     * let docRef1 = firestore.doc('col/doc1');
     * let docRef2 = firestore.doc('col/doc2');
     *
     * firestore.getAll(docRef1, docRef2, { fieldMask: ['user'] }).then(docs => {
     *   console.log(`First document: ${JSON.stringify(docs[0])}`);
     *   console.log(`Second document: ${JSON.stringify(docs[1])}`);
     * });
     * ```
     */
    getAll(...documentRefsOrReadOptions) {
        return this._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_BATCH_GET_DOCUMENTS, () => {
            (0, validate_1.validateMinNumberOfArguments)('Firestore.getAll', documentRefsOrReadOptions, 1);
            const { documents, fieldMask } = (0, transaction_1.parseGetAllArguments)(documentRefsOrReadOptions);
            this._traceUtil.currentSpan().setAttributes({
                [trace_util_1.ATTRIBUTE_KEY_IS_TRANSACTIONAL]: false,
                [trace_util_1.ATTRIBUTE_KEY_DOC_COUNT]: documents.length,
            });
            const tag = (0, util_1.requestTag)();
            // Capture the error stack to preserve stack tracing across async calls.
            const stack = Error().stack;
            return this.initializeIfNeeded(tag)
                .then(() => {
                const reader = new document_reader_1.DocumentReader(this, documents, fieldMask);
                return reader.get(tag);
            })
                .catch(err => {
                throw (0, util_1.wrapError)(err, stack);
            });
        });
    }
    /**
     * Registers a listener on this client, incrementing the listener count. This
     * is used to verify that all listeners are unsubscribed when terminate() is
     * called.
     *
     * @private
     * @internal
     */
    registerListener() {
        this.registeredListenersCount += 1;
    }
    /**
     * Unregisters a listener on this client, decrementing the listener count.
     * This is used to verify that all listeners are unsubscribed when terminate()
     * is called.
     *
     * @private
     * @internal
     */
    unregisterListener() {
        this.registeredListenersCount -= 1;
    }
    /**
     * Increments the number of open BulkWriter instances. This is used to verify
     * that all pending operations are complete when terminate() is called.
     *
     * @private
     * @internal
     */
    _incrementBulkWritersCount() {
        this.bulkWritersCount += 1;
    }
    /**
     * Decrements the number of open BulkWriter instances. This is used to verify
     * that all pending operations are complete when terminate() is called.
     *
     * @private
     * @internal
     */
    _decrementBulkWritersCount() {
        this.bulkWritersCount -= 1;
    }
    /**
     * Recursively deletes all documents and subcollections at and under the
     * specified level.
     *
     * If any delete fails, the promise is rejected with an error message
     * containing the number of failed deletes and the stack trace of the last
     * failed delete. The provided reference is deleted regardless of whether
     * all deletes succeeded.
     *
     * `recursiveDelete()` uses a BulkWriter instance with default settings to
     * perform the deletes. To customize throttling rates or add success/error
     * callbacks, pass in a custom BulkWriter instance.
     *
     * @param ref The reference of a document or collection to delete.
     * @param bulkWriter A custom BulkWriter instance used to perform the
     * deletes.
     * @return A promise that resolves when all deletes have been performed.
     * The promise is rejected if any of the deletes fail.
     *
     * @example
     * ```
     * // Recursively delete a reference and log the references of failures.
     * const bulkWriter = firestore.bulkWriter();
     * bulkWriter
     *   .onWriteError((error) => {
     *     if (
     *       error.failedAttempts < MAX_RETRY_ATTEMPTS
     *     ) {
     *       return true;
     *     } else {
     *       console.log('Failed write at document: ', error.documentRef.path);
     *       return false;
     *     }
     *   });
     * await firestore.recursiveDelete(docRef, bulkWriter);
     * ```
     */
    recursiveDelete(ref, bulkWriter) {
        return this._recursiveDelete(ref, recursive_delete_1.RECURSIVE_DELETE_MAX_PENDING_OPS, recursive_delete_1.RECURSIVE_DELETE_MIN_PENDING_OPS, bulkWriter);
    }
    /**
     * This overload is not private in order to test the query resumption with
     * startAfter() once the RecursiveDelete instance has MAX_PENDING_OPS pending.
     *
     * @private
     * @internal
     */
    // Visible for testing
    _recursiveDelete(ref, maxPendingOps, minPendingOps, bulkWriter) {
        const writer = bulkWriter !== null && bulkWriter !== void 0 ? bulkWriter : this.getBulkWriter();
        const deleter = new recursive_delete_1.RecursiveDelete(this, writer, ref, maxPendingOps, minPendingOps);
        return deleter.run();
    }
    /**
     * Terminates the Firestore client and closes all open streams.
     *
     * @return A Promise that resolves when the client is terminated.
     */
    async terminate() {
        if (this._bulkWriter) {
            await this._bulkWriter.close();
            this._bulkWriter = undefined;
        }
        if (this.registeredListenersCount > 0 || this.bulkWritersCount > 0) {
            return Promise.reject('All onSnapshot() listeners must be unsubscribed, and all BulkWriter ' +
                'instances must be closed before terminating the client. ' +
                `There are ${this.registeredListenersCount} active listeners and ` +
                `${this.bulkWritersCount} open BulkWriter instances.`);
        }
        return this._clientPool.terminate();
    }
    /**
     * Returns the Project ID to serve as the JSON representation of this
     * Firestore instance.
     *
     * @return An object that contains the project ID (or `undefined` if not yet
     * available).
     */
    toJSON() {
        return { projectId: this._projectId };
    }
    /**
     * Initializes the client if it is not already initialized. All methods in the
     * SDK can be used after this method completes.
     *
     * @private
     * @internal
     * @param requestTag A unique client-assigned identifier that caused this
     * initialization.
     * @return A Promise that resolves when the client is initialized.
     */
    async initializeIfNeeded(requestTag) {
        this._settingsFrozen = true;
        if (this._settings.ssl === false) {
            // If SSL is false, we assume that we are talking to the emulator. We
            // provide an Authorization header by default so that the connection is
            // recognized as admin in Firestore Emulator. (If for some reason we're
            // not connecting to the emulator, then this will result in denials with
            // invalid token, rather than behave like clients not logged in. The user
            // can then provide their own Authorization header, which will take
            // precedence).
            this._settings.customHeaders = {
                Authorization: 'Bearer owner',
                ...this._settings.customHeaders,
            };
        }
        if (this._projectId === undefined) {
            try {
                this._projectId = await this._clientPool.run(requestTag, 
                /* requiresGrpc= */ false, gapicClient => gapicClient.getProjectId());
                (0, logger_1.logger)('Firestore.initializeIfNeeded', null, 'Detected project ID: %s', this._projectId);
                // If the project ID was undefined when the TraceUtil was set up, we
                // need to record it.
                this._traceUtil.recordProjectId(this.projectId);
            }
            catch (err) {
                (0, logger_1.logger)('Firestore.initializeIfNeeded', null, 'Failed to detect project ID: %s', err);
                return Promise.reject(err);
            }
        }
    }
    /**
     * Returns GAX call options that set the cloud resource header.
     * @private
     * @internal
     */
    createCallOptions(methodName, retryCodes) {
        var _a;
        const callOptions = {
            otherArgs: {
                headers: {
                    [CLOUD_RESOURCE_HEADER]: this.formattedName,
                    ...this._settings.customHeaders,
                    ...(_a = this._settings[methodName]) === null || _a === void 0 ? void 0 : _a.customHeaders,
                },
            },
        };
        if (retryCodes) {
            const retryParams = (0, util_1.getRetryParams)(methodName);
            callOptions.retry =
                new (require('google-gax/build/src/fallback').RetryOptions)(retryCodes, retryParams);
        }
        return callOptions;
    }
    /**
     * A function returning a Promise that can be retried.
     *
     * @private
     * @internal
     * @callback retryFunction
     * @returns {Promise} A Promise indicating the function's success.
     */
    /**
     * Helper method that retries failed Promises.
     *
     * If 'delayMs' is specified, waits 'delayMs' between invocations. Otherwise,
     * schedules the first attempt immediately, and then waits 100 milliseconds
     * for further attempts.
     *
     * @private
     * @internal
     * @param methodName Name of the Veneer API endpoint that takes a request
     * and GAX options.
     * @param requestTag A unique client-assigned identifier for this request.
     * @param func Method returning a Promise than can be retried.
     * @returns A Promise with the function's result if successful within
     * `attemptsRemaining`. Otherwise, returns the last rejected Promise.
     */
    async _retry(methodName, requestTag, func) {
        const backoff = new backoff_1.ExponentialBackoff();
        let lastError = undefined;
        for (let attempt = 0; attempt < exports.MAX_REQUEST_RETRIES; ++attempt) {
            if (lastError) {
                (0, logger_1.logger)('Firestore._retry', requestTag, 'Retrying request that failed with error:', lastError);
            }
            try {
                await backoff.backoffAndWait();
                return await func();
            }
            catch (err) {
                lastError = err;
                if ((0, util_1.isPermanentRpcError)(err, methodName)) {
                    break;
                }
            }
        }
        (0, logger_1.logger)('Firestore._retry', requestTag, 'Request failed with error:', lastError);
        return Promise.reject(lastError);
    }
    /**
     * Waits for the provided stream to become active and returns a paused but
     * healthy stream. If an error occurs before the first byte is read, the
     * method rejects the returned Promise.
     *
     * @private
     * @internal
     * @param backendStream The Node stream to monitor.
     * @param lifetime A Promise that resolves when the stream receives an 'end',
     * 'close' or 'finish' message.
     * @param requestTag A unique client-assigned identifier for this request.
     * @param request If specified, the request that should be written to the
     * stream after opening.
     * @returns A guaranteed healthy stream that should be used instead of
     * `backendStream`.
     */
    _initializeStream(backendStream, lifetime, requestTag, request) {
        const resultStream = new stream_1.PassThrough({ objectMode: true });
        resultStream.pause();
        /**
         * Whether we have resolved the Promise and returned the stream to the
         * caller.
         */
        let streamInitialized = false;
        return new Promise((resolve, reject) => {
            function streamReady() {
                if (!streamInitialized) {
                    streamInitialized = true;
                    (0, logger_1.logger)('Firestore._initializeStream', requestTag, 'Stream ready');
                    resolve(resultStream);
                }
            }
            function streamEnded() {
                (0, logger_1.logger)('Firestore._initializeStream', requestTag, 'Received stream end');
                resultStream.unpipe(backendStream);
                resolve(resultStream);
                lifetime.resolve();
            }
            function streamFailed(err) {
                if (!streamInitialized) {
                    // If we receive an error before we were able to receive any data,
                    // reject this stream.
                    (0, logger_1.logger)('Firestore._initializeStream', requestTag, 'Received initial error:', err);
                    reject(err);
                }
                else {
                    (0, logger_1.logger)('Firestore._initializeStream', requestTag, 'Received stream error:', err);
                    // We execute the forwarding of the 'error' event via setImmediate() as
                    // V8 guarantees that the Promise chain returned from this method
                    // is resolved before any code executed via setImmediate(). This
                    // allows the caller to attach an error handler.
                    setImmediate(() => {
                        resultStream.emit('error', err);
                    });
                }
            }
            backendStream.on('data', () => streamReady());
            backendStream.on('error', err => streamFailed(err));
            backendStream.on('end', () => streamEnded());
            backendStream.on('close', () => streamEnded());
            backendStream.on('finish', () => streamEnded());
            backendStream.pipe(resultStream);
            if (request) {
                (0, logger_1.logger)('Firestore._initializeStream', requestTag, 'Sending request: %j', request);
                backendStream.write(request, 'utf-8', err => {
                    if (err) {
                        streamFailed(err);
                    }
                    else {
                        (0, logger_1.logger)('Firestore._initializeStream', requestTag, 'Marking stream as healthy');
                        streamReady();
                    }
                });
            }
        });
    }
    /**
     * A funnel for all non-streaming API requests, assigning a project ID where
     * necessary within the request options.
     *
     * @private
     * @internal
     * @param methodName Name of the Veneer API endpoint that takes a request
     * and GAX options.
     * @param request The Protobuf request to send.
     * @param requestTag A unique client-assigned identifier for this request.
     * @param retryCodes If provided, a custom list of retry codes. If not
     * provided, retry is based on the behavior as defined in the ServiceConfig.
     * @returns A Promise with the request result.
     */
    request(methodName, request, requestTag, retryCodes) {
        const callOptions = this.createCallOptions(methodName, retryCodes);
        return this._clientPool.run(requestTag, 
        /* requiresGrpc= */ false, async (gapicClient) => {
            try {
                (0, logger_1.logger)('Firestore.request', requestTag, 'Sending request: %j', request);
                const [result] = await gapicClient[methodName](request, callOptions);
                (0, logger_1.logger)('Firestore.request', requestTag, 'Received response: %j', result);
                return result;
            }
            catch (err) {
                (0, logger_1.logger)('Firestore.request', requestTag, 'Received error:', err);
                return Promise.reject(err);
            }
        });
    }
    /**
     * A funnel for streaming API requests, assigning a project ID where necessary
     * within the request options.
     *
     * The stream is returned in paused state and needs to be resumed once all
     * listeners are attached.
     *
     * @private
     * @internal
     * @param methodName Name of the streaming Veneer API endpoint that
     * takes a request and GAX options.
     * @param bidrectional Whether the request is bidirectional (true) or
     * unidirectional (false_
     * @param request The Protobuf request to send.
     * @param requestTag A unique client-assigned identifier for this request.
     * @returns A Promise with the resulting read-only stream.
     */
    requestStream(methodName, bidrectional, request, requestTag) {
        const callOptions = this.createCallOptions(methodName);
        const bidirectional = methodName === 'listen';
        let numResponses = 0;
        const NUM_RESPONSES_PER_TRACE_EVENT = 100;
        return this._retry(methodName, requestTag, () => {
            const result = new util_1.Deferred();
            this._clientPool.run(requestTag, bidrectional, async (gapicClient) => {
                (0, logger_1.logger)('Firestore.requestStream', requestTag, 'Sending request: %j', request);
                this._traceUtil
                    .currentSpan()
                    .addEvent(`Firestore.${methodName}: Start`);
                try {
                    const stream = bidirectional
                        ? gapicClient[methodName](callOptions)
                        : gapicClient[methodName](request, callOptions);
                    const logStream = new stream_1.Transform({
                        objectMode: true,
                        transform: (chunk, encoding, callback) => {
                            (0, logger_1.logger)('Firestore.requestStream', requestTag, 'Received response: %j', chunk);
                            numResponses++;
                            if (numResponses === 1) {
                                this._traceUtil
                                    .currentSpan()
                                    .addEvent(`Firestore.${methodName}: First response received`);
                            }
                            else if (numResponses % NUM_RESPONSES_PER_TRACE_EVENT === 0) {
                                this._traceUtil
                                    .currentSpan()
                                    .addEvent(`Firestore.${methodName}: Received ${numResponses} responses`);
                            }
                            callback();
                        },
                    });
                    stream.pipe(logStream);
                    const lifetime = new util_1.Deferred();
                    const resultStream = await this._initializeStream(stream, lifetime, requestTag, bidirectional ? request : undefined);
                    resultStream.on('end', () => {
                        stream.end();
                        this._traceUtil
                            .currentSpan()
                            .addEvent(`Firestore.${methodName}: Completed`, {
                            [trace_util_1.ATTRIBUTE_KEY_NUM_RESPONSES]: numResponses,
                        });
                    });
                    result.resolve(resultStream);
                    // While we return the stream to the callee early, we don't want to
                    // release the GAPIC client until the callee has finished processing the
                    // stream.
                    return lifetime.promise;
                }
                catch (e) {
                    result.reject(e);
                }
            });
            return result.promise;
        });
    }
}
exports.Firestore = Firestore;
/**
 * A logging function that takes a single string.
 *
 * @callback Firestore~logFunction
 * @param {string} Log message
 */
// tslint:disable-next-line:no-default-export
/**
 * The default export of the `@google-cloud/firestore` package is the
 * {@link Firestore} class.
 *
 * See {@link Firestore} and {@link ClientConfig} for client methods and
 * configuration options.
 *
 * @module {Firestore} @google-cloud/firestore
 * @alias nodejs-firestore
 *
 * @example Install the client library with <a href="https://www.npmjs.com/">npm</a>:
 * ```
 * npm install --save @google-cloud/firestore
 *
 * ```
 * @example Import the client library
 * ```
 * var Firestore = require('@google-cloud/firestore');
 *
 * ```
 * @example Create a client that uses <a href="https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application">Application Default Credentials (ADC)</a>:
 * ```
 * var firestore = new Firestore();
 *
 * ```
 * @example Create a client with <a href="https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually">explicit credentials</a>:
 * ```
 * var firestore = new Firestore({ projectId:
 *   'your-project-id', keyFilename: '/path/to/keyfile.json'
 * });
 *
 * ```
 * @example <caption>include:samples/quickstart.js</caption>
 * region_tag:firestore_quickstart
 * Full quickstart example:
 */
// tslint:disable-next-line:no-default-export
exports.default = Firestore;
// Horrible hack to ensure backwards compatibility with <= 17.0, which allows
// users to call the default constructor via
// `const Fs = require(`@google-cloud/firestore`); new Fs()`;
const existingExports = module.exports;
module.exports = Firestore;
module.exports = Object.assign(module.exports, existingExports);
/**
 * {@link v1beta1} factory function.
 *
 * @private
 * @internal
 * @name Firestore.v1beta1
 * @type {function}
 */
Object.defineProperty(module.exports, 'v1beta1', {
    // The v1beta1 module is very large. To avoid pulling it in from static
    // scope, we lazy-load the module.
    get: () => require('./v1beta1'),
});
/**
 * {@link v1} factory function.
 *
 * @private
 * @internal
 * @name Firestore.v1
 * @type {function}
 */
Object.defineProperty(module.exports, 'v1', {
    // The v1 module is very large. To avoid pulling it in from static
    // scope, we lazy-load  the module.
    get: () => require('./v1'),
});
/**
 * {@link Status} factory function.
 *
 * @private
 * @internal
 * @name Firestore.GrpcStatus
 * @type {function}
 */
Object.defineProperty(module.exports, 'GrpcStatus', {
    // The gax module is very large. To avoid pulling it in from static
    // scope, we lazy-load the module.
    get: () => require('google-gax').Status,
});
//# sourceMappingURL=index.js.map