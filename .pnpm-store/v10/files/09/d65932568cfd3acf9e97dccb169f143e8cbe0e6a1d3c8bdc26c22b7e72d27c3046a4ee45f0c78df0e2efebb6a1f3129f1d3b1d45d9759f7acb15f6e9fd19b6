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
import * as firestore from '@google-cloud/firestore';
import { Duplex } from 'stream';
import { google } from '../protos/firestore_v1_proto_api';
import { BulkWriter } from './bulk-writer';
import { BundleBuilder } from './bundle';
import { DocumentSnapshot, QueryDocumentSnapshot } from './document';
import { CollectionReference } from './reference/collection-reference';
import { DocumentReference } from './reference/document-reference';
import { Serializer } from './serializer';
import { Transaction } from './transaction';
import { FirestoreStreamingMethod, FirestoreUnaryMethod } from './types';
import { WriteBatch } from './write-batch';
import api = google.firestore.v1;
import { CollectionGroup } from './collection-group';
import { TraceUtil } from './telemetry/trace-util';
export { CollectionReference } from './reference/collection-reference';
export { DocumentReference } from './reference/document-reference';
export { QuerySnapshot } from './reference/query-snapshot';
export { Query } from './reference/query';
export type { AggregateQuery } from './reference/aggregate-query';
export type { AggregateQuerySnapshot } from './reference/aggregate-query-snapshot';
export type { VectorQuery } from './reference/vector-query';
export type { VectorQuerySnapshot } from './reference/vector-query-snapshot';
export type { VectorQueryOptions } from './reference/vector-query-options';
export { BulkWriter } from './bulk-writer';
export type { BulkWriterError } from './bulk-writer';
export type { BundleBuilder } from './bundle';
export { DocumentSnapshot, QueryDocumentSnapshot } from './document';
export { FieldValue, VectorValue } from './field-value';
export { Filter } from './filter';
export { WriteBatch, WriteResult } from './write-batch';
export { Transaction } from './transaction';
export { Timestamp } from './timestamp';
export { DocumentChange } from './document-change';
export type { DocumentChangeType } from './document-change';
export { FieldPath } from './path';
export { GeoPoint } from './geo-point';
export { CollectionGroup };
export { QueryPartition } from './query-partition';
export { setLogFunction } from './logger';
export { Aggregate, AggregateField } from './aggregate';
export type { AggregateFieldType, AggregateSpec, AggregateType, } from './aggregate';
export type { PlanSummary, ExecutionStats, ExplainMetrics, ExplainResults, } from './query-profile';
/**
 * The maximum number of times to retry idempotent requests.
 * @private
 */
export declare const MAX_REQUEST_RETRIES = 5;
/**
 * The maximum number of times to attempt a transaction before failing.
 * @private
 */
export declare const DEFAULT_MAX_TRANSACTION_ATTEMPTS = 5;
/*!
 * The default number of idle GRPC channel to keep.
 */
export declare const DEFAULT_MAX_IDLE_CHANNELS = 1;
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
export declare class Firestore implements firestore.Firestore {
    /**
     * A client pool to distribute requests over multiple GAPIC clients in order
     * to work around a connection limit of 100 concurrent requests per client.
     * @private
     * @internal
     */
    private _clientPool;
    /**
     * Preloaded instance of google-gax (full module, with gRPC support).
     */
    private _gax?;
    /**
     * Preloaded instance of google-gax HTTP fallback implementation (no gRPC).
     */
    private _gaxFallback?;
    /**
     * The configuration options for the GAPIC client.
     * @private
     * @internal
     */
    _settings: firestore.Settings;
    /**
     * Settings for the exponential backoff used by the streaming endpoints.
     * @private
     * @internal
     */
    private _backoffSettings;
    /**
     * Whether the initialization settings can still be changed by invoking
     * `settings()`.
     * @private
     * @internal
     */
    private _settingsFrozen;
    /**
     * The serializer to use for the Protobuf transformation.
     * @private
     * @internal
     */
    _serializer: Serializer | null;
    /**
     * The OpenTelemetry tracing utility object.
     * @private
     * @internal
     */
    _traceUtil: TraceUtil;
    /**
     * The project ID for this client.
     *
     * The project ID is auto-detected during the first request unless a project
     * ID is passed to the constructor (or provided via `.settings()`).
     * @private
     * @internal
     */
    private _projectId;
    /**
     * The database ID provided via `.settings()`.
     *
     * @private
     * @internal
     */
    private _databaseId;
    /**
     * Count of listeners that have been registered on the client.
     *
     * The client can only be terminated when there are no pending writes or
     * registered listeners.
     * @private
     * @internal
     */
    private registeredListenersCount;
    /**
     * A lazy-loaded BulkWriter instance to be used with recursiveDelete() if no
     * BulkWriter instance is provided.
     *
     * @private
     * @internal
     */
    private _bulkWriter;
    /**
     * Lazy-load the Firestore's default BulkWriter.
     *
     * @private
     * @internal
     */
    private getBulkWriter;
    /**
     * Number of pending operations on the client.
     *
     * The client can only be terminated when there are no pending writes or
     * registered listeners.
     * @private
     * @internal
     */
    private bulkWritersCount;
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
    constructor(settings?: firestore.Settings);
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
    settings(settings: firestore.Settings): void;
    private validateAndApplySettings;
    private newTraceUtilInstance;
    /**
     * Returns the Project ID for this Firestore instance. Validates that
     * `initializeIfNeeded()` was called before.
     *
     * @private
     * @internal
     */
    get projectId(): string;
    /**
     * Returns the Database ID for this Firestore instance.
     */
    get databaseId(): string;
    /**
     * Returns the root path of the database. Validates that
     * `initializeIfNeeded()` was called before.
     *
     * @private
     * @internal
     */
    get formattedName(): string;
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
    doc(documentPath: string): DocumentReference;
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
    collection(collectionPath: string): CollectionReference;
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
    collectionGroup(collectionId: string): CollectionGroup;
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
    batch(): WriteBatch;
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
    bulkWriter(options?: firestore.BulkWriterOptions): BulkWriter;
    /**
     * Creates a [DocumentSnapshot]{@link DocumentSnapshot} or a
     * [QueryDocumentSnapshot]{@link QueryDocumentSnapshot} from a
     * `firestore.v1.Document` proto (or from a resource name for missing
     * documents).
     *
     * This API is used by Google Cloud Functions and can be called with both
     * 'Proto3 JSON' and 'Protobuf JS' encoded data.
     *
     * @private
     * @param documentOrName The Firestore 'Document' proto or the resource name
     * of a missing document.
     * @param readTime A 'Timestamp' proto indicating the time this document was
     * read.
     * @param encoding One of 'json' or 'protobufJS'. Applies to both the
     * 'document' Proto and 'readTime'. Defaults to 'protobufJS'.
     * @returns A QueryDocumentSnapshot for existing documents, otherwise a
     * DocumentSnapshot.
     */
    snapshot_(documentName: string, readTime?: google.protobuf.ITimestamp, encoding?: 'protobufJS'): DocumentSnapshot;
    /** @private */
    snapshot_(documentName: string, readTime: string, encoding: 'json'): DocumentSnapshot;
    /** @private */
    snapshot_(document: api.IDocument, readTime: google.protobuf.ITimestamp, encoding?: 'protobufJS'): QueryDocumentSnapshot;
    /** @private */
    snapshot_(document: {
        [k: string]: unknown;
    }, readTime: string, encoding: 'json'): QueryDocumentSnapshot;
    /**
     * Creates a new `BundleBuilder` instance to package selected Firestore data into
     * a bundle.
     *
     * @param bundleId. The id of the bundle. When loaded on clients, client SDKs use this id
     * and the timestamp associated with the built bundle to tell if it has been loaded already.
     * If not specified, a random identifier will be used.
     */
    bundle(name?: string): BundleBuilder;
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
    runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>, transactionOptions?: firestore.ReadWriteTransactionOptions | firestore.ReadOnlyTransactionOptions): Promise<T>;
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
    listCollections(): Promise<CollectionReference[]>;
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
    getAll<AppModelType, DbModelType extends firestore.DocumentData>(...documentRefsOrReadOptions: Array<firestore.DocumentReference<AppModelType, DbModelType> | firestore.ReadOptions>): Promise<Array<DocumentSnapshot<AppModelType, DbModelType>>>;
    /**
     * Registers a listener on this client, incrementing the listener count. This
     * is used to verify that all listeners are unsubscribed when terminate() is
     * called.
     *
     * @private
     * @internal
     */
    registerListener(): void;
    /**
     * Unregisters a listener on this client, decrementing the listener count.
     * This is used to verify that all listeners are unsubscribed when terminate()
     * is called.
     *
     * @private
     * @internal
     */
    unregisterListener(): void;
    /**
     * Increments the number of open BulkWriter instances. This is used to verify
     * that all pending operations are complete when terminate() is called.
     *
     * @private
     * @internal
     */
    _incrementBulkWritersCount(): void;
    /**
     * Decrements the number of open BulkWriter instances. This is used to verify
     * that all pending operations are complete when terminate() is called.
     *
     * @private
     * @internal
     */
    _decrementBulkWritersCount(): void;
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
    recursiveDelete(ref: firestore.CollectionReference<any, any> | firestore.DocumentReference<any, any>, bulkWriter?: BulkWriter): Promise<void>;
    /**
     * This overload is not private in order to test the query resumption with
     * startAfter() once the RecursiveDelete instance has MAX_PENDING_OPS pending.
     *
     * @private
     * @internal
     */
    _recursiveDelete(ref: firestore.CollectionReference<unknown> | firestore.DocumentReference<unknown>, maxPendingOps: number, minPendingOps: number, bulkWriter?: BulkWriter): Promise<void>;
    /**
     * Terminates the Firestore client and closes all open streams.
     *
     * @return A Promise that resolves when the client is terminated.
     */
    terminate(): Promise<void>;
    /**
     * Returns the Project ID to serve as the JSON representation of this
     * Firestore instance.
     *
     * @return An object that contains the project ID (or `undefined` if not yet
     * available).
     */
    toJSON(): object;
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
    initializeIfNeeded(requestTag: string): Promise<void>;
    /**
     * Returns GAX call options that set the cloud resource header.
     * @private
     * @internal
     */
    private createCallOptions;
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
    private _retry;
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
    private _initializeStream;
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
    request<Req, Resp>(methodName: FirestoreUnaryMethod, request: Req, requestTag: string, retryCodes?: number[]): Promise<Resp>;
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
    requestStream(methodName: FirestoreStreamingMethod, bidrectional: boolean, request: {}, requestTag: string): Promise<Duplex>;
}
/**
 * A logging function that takes a single string.
 *
 * @callback Firestore~logFunction
 * @param {string} Log message
 */
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
export default Firestore;
