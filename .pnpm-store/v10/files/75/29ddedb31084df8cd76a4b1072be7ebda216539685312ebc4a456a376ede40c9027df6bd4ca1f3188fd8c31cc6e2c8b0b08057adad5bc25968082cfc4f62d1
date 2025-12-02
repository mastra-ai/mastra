/*! firebase-admin v13.5.0 */
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
/**
 * Cloud Firestore.
 *
 * @packageDocumentation
 */
import { Firestore } from '@google-cloud/firestore';
import { App } from '../app';
import { FirestoreSettings } from './firestore-internal';
export { AddPrefixToKeys, AggregateField, AggregateFieldType, AggregateQuery, AggregateQuerySnapshot, AggregateSpecData, AggregateSpec, AggregateType, BulkWriter, BulkWriterOptions, BundleBuilder, ChildUpdateFields, CollectionGroup, CollectionReference, DocumentChange, DocumentChangeType, DocumentData, DocumentReference, DocumentSnapshot, FieldPath, FieldValue, Filter, Firestore, FirestoreDataConverter, GeoPoint, GrpcStatus, NestedUpdateFields, OrderByDirection, PartialWithFieldValue, Precondition, Primitive, Query, QueryDocumentSnapshot, QueryPartition, QuerySnapshot, ReadOptions, ReadOnlyTransactionOptions, ReadWriteTransactionOptions, Settings, SetOptions, Timestamp, Transaction, UpdateData, UnionToIntersection, WhereFilterOp, WithFieldValue, WriteBatch, WriteResult, v1, setLogFunction, } from '@google-cloud/firestore';
export { FirestoreSettings };
/**
 * Gets the default {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the default app.
 *
 * @example
 * ```javascript
 * // Get the default Firestore service for the default app
 * const defaultFirestore = getFirestore();
 * ```

 * @returns The default {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the default app.
 */
export declare function getFirestore(): Firestore;
/**
 * Gets the default {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the given app.
 *
 * @example
 * ```javascript
 * // Get the default Firestore service for a specific app
 * const otherFirestore = getFirestore(app);
 * ```
 *
 * @param app - which `Firestore` service to return.
 *
 * @returns The default {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service associated with the provided app.
 */
export declare function getFirestore(app: App): Firestore;
/**
 * Gets the named {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the default app.
 *
 * @example
 * ```javascript
 * // Get the Firestore service for a named database and default app
 * const otherFirestore = getFirestore('otherDb');
 * ```
 *
 * @param databaseId - name of database to return.
 *
 * @returns The named {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the default app.
 * @beta
 */
export declare function getFirestore(databaseId: string): Firestore;
/**
 * Gets the named {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the given app.
 *
 * @example
 * ```javascript
 * // Get the Firestore service for a named database and specific app.
 * const otherFirestore = getFirestore('otherDb');
 * ```
 *
 * @param app - which `Firestore` service to return.
 *
 * @param databaseId - name of database to return.
 *
 * @returns The named {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service associated with the provided app.
 * @beta
 */
export declare function getFirestore(app: App, databaseId: string): Firestore;
/**
 * Gets the default {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the given app, passing extra parameters to its constructor.
 *
 * @example
 * ```javascript
 * // Get the Firestore service for a specific app, require HTTP/1.1 REST transport
 * const otherFirestore = initializeFirestore(app, {preferRest: true});
 * ```
 *
 * @param app - which `Firestore` service to return.
 *
 * @param settings - Settings object to be passed to the constructor.
 *
 * @returns The default `Firestore` service associated with the provided app and settings.
 */
export declare function initializeFirestore(app: App, settings?: FirestoreSettings): Firestore;
/**
 * Gets the named {@link https://googleapis.dev/nodejs/firestore/latest/Firestore.html | Firestore}
 * service for the given app, passing extra parameters to its constructor.
 *
 * @example
 * ```javascript
 * // Get the Firestore service for a specific app, require HTTP/1.1 REST transport
 * const otherFirestore = initializeFirestore(app, {preferRest: true}, 'otherDb');
 * ```
 *
 * @param app - which `Firestore` service to return.
 *
 * @param settings - Settings object to be passed to the constructor.
 *
 * @param databaseId - name of database to return.
 *
 * @returns The named `Firestore` service associated with the provided app and settings.
 * @beta
 */
export declare function initializeFirestore(app: App, settings: FirestoreSettings, databaseId: string): Firestore;
export { FirebaseFirestoreError } from '../utils/error';
