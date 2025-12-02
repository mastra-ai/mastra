/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
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
import { google } from '../protos/firestore_v1_proto_api';
import { FieldTransform } from './field-value';
import { FieldPath } from './path';
import { DocumentReference } from './reference/document-reference';
import { Serializer } from './serializer';
import { Timestamp } from './timestamp';
import { ApiMapValue, UpdateMap } from './types';
import api = google.firestore.v1;
/**
 * Returns a builder for DocumentSnapshot and QueryDocumentSnapshot instances.
 * Invoke `.build()' to assemble the final snapshot.
 *
 * @private
 * @internal
 */
export declare class DocumentSnapshotBuilder<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> {
    readonly ref: DocumentReference<AppModelType, DbModelType>;
    /** The fields of the Firestore `Document` Protobuf backing this document. */
    fieldsProto?: ApiMapValue;
    /** The time when this document was read. */
    readTime?: Timestamp;
    /** The time when this document was created. */
    createTime?: Timestamp;
    /** The time when this document was last updated. */
    updateTime?: Timestamp;
    constructor(ref: DocumentReference<AppModelType, DbModelType>);
    /**
     * Builds the DocumentSnapshot.
     *
     * @private
     * @internal
     * @returns Returns either a QueryDocumentSnapshot (if `fieldsProto` was
     * provided) or a DocumentSnapshot.
     */
    build(): QueryDocumentSnapshot<AppModelType, DbModelType> | DocumentSnapshot<AppModelType, DbModelType>;
}
/**
 * A DocumentSnapshot is an immutable representation for a document in a
 * Firestore database. The data can be extracted with
 * [data()]{@link DocumentSnapshot#data} or
 * [get(fieldPath)]{@link DocumentSnapshot#get} to get a
 * specific field.
 *
 * <p>For a DocumentSnapshot that points to a non-existing document, any data
 * access will return 'undefined'. You can use the
 * [exists]{@link DocumentSnapshot#exists} property to explicitly verify a
 * document's existence.
 *
 * @class DocumentSnapshot
 */
export declare class DocumentSnapshot<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.DocumentSnapshot<AppModelType, DbModelType> {
    /**
     * @internal
     * @private
     **/
    readonly _fieldsProto?: ApiMapValue | undefined;
    private _ref;
    private _serializer;
    private _readTime;
    private _createTime;
    private _updateTime;
    /**
     * @private
     * @internal
     *
     * @param ref The reference to the document.
     * @param _fieldsProto The fields of the Firestore `Document` Protobuf backing
     * this document (or undefined if the document does not exist).
     * @param readTime The time when this snapshot was read  (or undefined if
     * the document exists only locally).
     * @param createTime The time when the document was created (or undefined if
     * the document does not exist).
     * @param updateTime The time when the document was last updated (or undefined
     * if the document does not exist).
     */
    constructor(ref: DocumentReference<AppModelType, DbModelType>, 
    /**
     * @internal
     * @private
     **/
    _fieldsProto?: ApiMapValue | undefined, readTime?: Timestamp, createTime?: Timestamp, updateTime?: Timestamp);
    /**
     * Creates a DocumentSnapshot from an object.
     *
     * @private
     * @internal
     * @param ref The reference to the document.
     * @param obj The object to store in the DocumentSnapshot.
     * @return The created DocumentSnapshot.
     */
    static fromObject<AppModelType, DbModelType extends firestore.DocumentData>(ref: DocumentReference<AppModelType, DbModelType>, obj: firestore.DocumentData): DocumentSnapshot<AppModelType, DbModelType>;
    /**
     * Creates a DocumentSnapshot from an UpdateMap.
     *
     * This methods expands the top-level field paths in a JavaScript map and
     * turns { foo.bar : foobar } into { foo { bar : foobar }}
     *
     * @private
     * @internal
     * @param ref The reference to the document.
     * @param data The field/value map to expand.
     * @return The created DocumentSnapshot.
     */
    static fromUpdateMap<AppModelType, DbModelType extends firestore.DocumentData>(ref: firestore.DocumentReference<AppModelType, DbModelType>, data: UpdateMap): DocumentSnapshot<AppModelType, DbModelType>;
    /**
     * True if the document exists.
     *
     * @type {boolean}
     * @name DocumentSnapshot#exists
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then((documentSnapshot) => {
     *   if (documentSnapshot.exists) {
     *     console.log(`Data: ${JSON.stringify(documentSnapshot.data())}`);
     *   }
     * });
     * ```
     */
    get exists(): boolean;
    /**
     * A [DocumentReference]{@link DocumentReference} for the document
     * stored in this snapshot.
     *
     * @type {DocumentReference}
     * @name DocumentSnapshot#ref
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then((documentSnapshot) => {
     *   if (documentSnapshot.exists) {
     *     console.log(`Found document at '${documentSnapshot.ref.path}'`);
     *   }
     * });
     * ```
     */
    get ref(): DocumentReference<AppModelType, DbModelType>;
    /**
     * The ID of the document for which this DocumentSnapshot contains data.
     *
     * @type {string}
     * @name DocumentSnapshot#id
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then((documentSnapshot) => {
     *   if (documentSnapshot.exists) {
     *     console.log(`Document found with name '${documentSnapshot.id}'`);
     *   }
     * });
     * ```
     */
    get id(): string;
    /**
     * The time the document was created. Undefined for documents that don't
     * exist.
     *
     * @type {Timestamp|undefined}
     * @name DocumentSnapshot#createTime
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then(documentSnapshot => {
     *   if (documentSnapshot.exists) {
     *     let createTime = documentSnapshot.createTime;
     *     console.log(`Document created at '${createTime.toDate()}'`);
     *   }
     * });
     * ```
     */
    get createTime(): Timestamp | undefined;
    /**
     * The time the document was last updated (at the time the snapshot was
     * generated). Undefined for documents that don't exist.
     *
     * @type {Timestamp|undefined}
     * @name DocumentSnapshot#updateTime
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then(documentSnapshot => {
     *   if (documentSnapshot.exists) {
     *     let updateTime = documentSnapshot.updateTime;
     *     console.log(`Document updated at '${updateTime.toDate()}'`);
     *   }
     * });
     * ```
     */
    get updateTime(): Timestamp | undefined;
    /**
     * The time this snapshot was read.
     *
     * @type {Timestamp}
     * @name DocumentSnapshot#readTime
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then(documentSnapshot => {
     *   let readTime = documentSnapshot.readTime;
     *   console.log(`Document read at '${readTime.toDate()}'`);
     * });
     * ```
     */
    get readTime(): Timestamp;
    /**
     * Retrieves all fields in the document as an object. Returns 'undefined' if
     * the document doesn't exist.
     *
     * @returns {T|undefined} An object containing all fields in the document or
     * 'undefined' if the document doesn't exist.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then(documentSnapshot => {
     *   let data = documentSnapshot.data();
     *   console.log(`Retrieved data: ${JSON.stringify(data)}`);
     * });
     * ```
     */
    data(): AppModelType | undefined;
    /**
     * Retrieves the field specified by `field`.
     *
     * @param {string|FieldPath} field The field path
     * (e.g. 'foo' or 'foo.bar') to a specific field.
     * @returns {*} The data at the specified field location or undefined if no
     * such field exists.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.set({ a: { b: 'c' }}).then(() => {
     *   return documentRef.get();
     * }).then(documentSnapshot => {
     *   let field = documentSnapshot.get('a.b');
     *   console.log(`Retrieved field value: ${field}`);
     * });
     * ```
     */
    get(field: string | FieldPath): any;
    /**
     * Retrieves the field specified by 'fieldPath' in its Protobuf JS
     * representation.
     *
     * @private
     * @internal
     * @param field The path (e.g. 'foo' or 'foo.bar') to a specific field.
     * @returns The Protobuf-encoded data at the specified field location or
     * undefined if no such field exists.
     */
    protoField(field: string | FieldPath): api.IValue | undefined;
    /**
     * Convert a document snapshot to the Firestore 'Write' proto.
     *
     * @private
     * @internal
     */
    toWriteProto(): api.IWrite;
    /**
     * Convert a document snapshot to the Firestore 'Document' proto.
     *
     * @private
     * @internal
     */
    toDocumentProto(): api.IDocument;
    /**
     * Returns true if the document's data and path in this `DocumentSnapshot` is
     * equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `DocumentSnapshot` is equal to the provided
     * value.
     */
    isEqual(other: firestore.DocumentSnapshot<AppModelType, DbModelType>): boolean;
}
/**
 * A QueryDocumentSnapshot contains data read from a document in your
 * Firestore database as part of a query. The document is guaranteed to exist
 * and its data can be extracted with [data()]{@link QueryDocumentSnapshot#data}
 * or [get()]{@link DocumentSnapshot#get} to get a specific field.
 *
 * A QueryDocumentSnapshot offers the same API surface as a
 * {@link DocumentSnapshot}. Since query results contain only existing
 * documents, the [exists]{@link DocumentSnapshot#exists} property will
 * always be true and [data()]{@link QueryDocumentSnapshot#data} will never
 * return 'undefined'.
 *
 * @class QueryDocumentSnapshot
 * @extends DocumentSnapshot
 */
export declare class QueryDocumentSnapshot<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> extends DocumentSnapshot<AppModelType, DbModelType> implements firestore.QueryDocumentSnapshot<AppModelType, DbModelType> {
    /**
     * The time the document was created.
     *
     * @type {Timestamp}
     * @name QueryDocumentSnapshot#createTime
     * @readonly
     * @override
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.get().forEach(snapshot => {
     *   console.log(`Document created at '${snapshot.createTime.toDate()}'`);
     * });
     * ```
     */
    get createTime(): Timestamp;
    /**
     * The time the document was last updated (at the time the snapshot was
     * generated).
     *
     * @type {Timestamp}
     * @name QueryDocumentSnapshot#updateTime
     * @readonly
     * @override
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.get().forEach(snapshot => {
     *   console.log(`Document updated at '${snapshot.updateTime.toDate()}'`);
     * });
     * ```
     */
    get updateTime(): Timestamp;
    /**
     * Retrieves all fields in the document as an object.
     *
     * @override
     *
     * @returns {T} An object containing all fields in the document.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.get().forEach(documentSnapshot => {
     *   let data = documentSnapshot.data();
     *   console.log(`Retrieved data: ${JSON.stringify(data)}`);
     * });
     * ```
     */
    data(): AppModelType;
}
/**
 * A Firestore Document Mask contains the field paths affected by an update.
 *
 * @class
 * @private
 * @internal
 */
export declare class DocumentMask {
    private _sortedPaths;
    /**
     * @private
     * @internal
     * @private
     *
     * @param fieldPaths The field paths in this mask.
     */
    constructor(fieldPaths: FieldPath[]);
    /**
     * Creates a document mask with the field paths of a document.
     *
     * @private
     * @internal
     * @param data A map with fields to modify. Only the keys are used to extract
     * the document mask.
     */
    static fromUpdateMap(data: UpdateMap): DocumentMask;
    /**
     * Creates a document mask from an array of field paths.
     *
     * @private
     * @internal
     * @param fieldMask A list of field paths.
     */
    static fromFieldMask(fieldMask: Array<string | firestore.FieldPath>): DocumentMask;
    /**
     * Creates a document mask with the field names of a document.
     *
     * @private
     * @internal
     * @param data An object with fields to modify. Only the keys are used to
     * extract the document mask.
     */
    static fromObject(data: firestore.DocumentData): DocumentMask;
    /**
     * Returns true if this document mask contains no fields.
     *
     * @private
     * @internal
     * @return {boolean} Whether this document mask is empty.
     */
    get isEmpty(): boolean;
    /**
     * Removes the specified values from a sorted field path array.
     *
     * @private
     * @internal
     * @param input A sorted array of FieldPaths.
     * @param values An array of FieldPaths to remove.
     */
    private static removeFromSortedArray;
    /**
     * Removes the field path specified in 'fieldPaths' from this document mask.
     *
     * @private
     * @internal
     * @param fieldPaths An array of FieldPaths.
     */
    removeFields(fieldPaths: FieldPath[]): void;
    /**
     * Returns whether this document mask contains 'fieldPath'.
     *
     * @private
     * @internal
     * @param fieldPath The field path to test.
     * @return Whether this document mask contains 'fieldPath'.
     */
    contains(fieldPath: FieldPath): boolean;
    /**
     * Removes all properties from 'data' that are not contained in this document
     * mask.
     *
     * @private
     * @internal
     * @param data An object to filter.
     * @return A shallow copy of the object filtered by this document mask.
     */
    applyTo(data: firestore.DocumentData): firestore.DocumentData;
    /**
     * Converts a document mask to the Firestore 'DocumentMask' Proto.
     *
     * @private
     * @internal
     * @returns A Firestore 'DocumentMask' Proto.
     */
    toProto(): api.IDocumentMask;
}
/**
 * A Firestore Document Transform.
 *
 * A DocumentTransform contains pending server-side transforms and their
 * corresponding field paths.
 *
 * @private
 * @internal
 * @class
 */
export declare class DocumentTransform<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> {
    private readonly ref;
    private readonly transforms;
    /**
     * @private
     * @internal
     * @private
     *
     * @param ref The DocumentReference for this transform.
     * @param transforms A Map of FieldPaths to FieldTransforms.
     */
    constructor(ref: DocumentReference<AppModelType, DbModelType>, transforms: Map<FieldPath, FieldTransform>);
    /**
     * Generates a DocumentTransform from a JavaScript object.
     *
     * @private
     * @internal
     * @param ref The `DocumentReference` to use for the DocumentTransform.
     * @param obj The object to extract the transformations from.
     * @returns The Document Transform.
     */
    static fromObject<AppModelType, DbModelType extends firestore.DocumentData>(ref: firestore.DocumentReference<AppModelType, DbModelType>, obj: firestore.DocumentData): DocumentTransform<AppModelType, DbModelType>;
    /**
     * Generates a DocumentTransform from an Update Map.
     *
     * @private
     * @internal
     * @param ref The `DocumentReference` to use for the DocumentTransform.
     * @param data The update data to extract the transformations from.
     * @returns The Document Transform.
     */
    static fromUpdateMap<AppModelType, DbModelType extends firestore.DocumentData>(ref: firestore.DocumentReference<AppModelType, DbModelType>, data: UpdateMap): DocumentTransform<AppModelType, DbModelType>;
    /**
     * Whether this DocumentTransform contains any actionable transformations.
     *
     * @private
     * @internal
     */
    get isEmpty(): boolean;
    /**
     * Returns the array of fields in this DocumentTransform.
     *
     * @private
     * @internal
     */
    get fields(): FieldPath[];
    /**
     * Validates the user provided field values in this document transform.
     * @private
     * @internal
     */
    validate(): void;
    /**
     * Converts a document transform to the Firestore 'FieldTransform' Proto.
     *
     * @private
     * @internal
     * @param serializer The Firestore serializer
     * @returns A list of Firestore 'FieldTransform' Protos
     */
    toProto(serializer: Serializer): api.DocumentTransform.IFieldTransform[];
}
/**
 * A Firestore Precondition encapsulates options for database writes.
 *
 * @private
 * @internal
 * @class
 */
export declare class Precondition {
    private _exists?;
    private _lastUpdateTime?;
    /**
     * @private
     * @internal
     * @private
     *
     * @param options.exists - Whether the referenced document should exist in
     * Firestore,
     * @param options.lastUpdateTime - The last update time of the referenced
     * document in Firestore.
     * @param options
     */
    constructor(options?: {
        exists?: boolean;
        lastUpdateTime?: firestore.Timestamp;
    });
    /**
     * Generates the Protobuf `Preconditon` object for this precondition.
     *
     * @private
     * @internal
     * @returns The `Preconditon` Protobuf object or 'null' if there are no
     * preconditions.
     */
    toProto(): api.IPrecondition | null;
    /**
     * Whether this DocumentTransform contains any enforcement.
     *
     * @private
     * @internal
     */
    get isEmpty(): boolean;
}
