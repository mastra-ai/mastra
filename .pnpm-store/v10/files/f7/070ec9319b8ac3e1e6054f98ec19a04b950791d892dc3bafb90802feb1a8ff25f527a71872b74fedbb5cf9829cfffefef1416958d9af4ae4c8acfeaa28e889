"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Precondition = exports.DocumentTransform = exports.DocumentMask = exports.QueryDocumentSnapshot = exports.DocumentSnapshot = exports.DocumentSnapshotBuilder = void 0;
const deepEqual = require("fast-deep-equal");
const assert = require("assert");
const field_value_1 = require("./field-value");
const path_1 = require("./path");
const document_reference_1 = require("./reference/document-reference");
const types_1 = require("./types");
const util_1 = require("./util");
/**
 * Returns a builder for DocumentSnapshot and QueryDocumentSnapshot instances.
 * Invoke `.build()' to assemble the final snapshot.
 *
 * @private
 * @internal
 */
class DocumentSnapshotBuilder {
    // We include the DocumentReference in the constructor in order to allow the
    // DocumentSnapshotBuilder to be typed with <AppModelType, DbModelType> when
    // it is constructed.
    constructor(ref) {
        this.ref = ref;
    }
    /**
     * Builds the DocumentSnapshot.
     *
     * @private
     * @internal
     * @returns Returns either a QueryDocumentSnapshot (if `fieldsProto` was
     * provided) or a DocumentSnapshot.
     */
    build() {
        assert((this.fieldsProto !== undefined) === (this.createTime !== undefined), 'Create time should be set iff document exists.');
        assert((this.fieldsProto !== undefined) === (this.updateTime !== undefined), 'Update time should be set iff document exists.');
        return this.fieldsProto
            ? new QueryDocumentSnapshot(this.ref, this.fieldsProto, this.readTime, this.createTime, this.updateTime)
            : new DocumentSnapshot(this.ref, undefined, this.readTime);
    }
}
exports.DocumentSnapshotBuilder = DocumentSnapshotBuilder;
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
class DocumentSnapshot {
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
    constructor(ref, 
    /**
     * @internal
     * @private
     **/
    _fieldsProto, readTime, createTime, updateTime) {
        this._fieldsProto = _fieldsProto;
        this._ref = ref;
        this._serializer = ref.firestore._serializer;
        this._readTime = readTime;
        this._createTime = createTime;
        this._updateTime = updateTime;
    }
    /**
     * Creates a DocumentSnapshot from an object.
     *
     * @private
     * @internal
     * @param ref The reference to the document.
     * @param obj The object to store in the DocumentSnapshot.
     * @return The created DocumentSnapshot.
     */
    static fromObject(ref, obj) {
        const serializer = ref.firestore._serializer;
        return new DocumentSnapshot(ref, serializer.encodeFields(obj));
    }
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
    static fromUpdateMap(ref, data) {
        const serializer = ref
            .firestore._serializer;
        /**
         * Merges 'value' at the field path specified by the path array into
         * 'target'.
         */
        function merge(target, value, path, pos) {
            const key = path[pos];
            const isLast = pos === path.length - 1;
            if (target[key] === undefined) {
                if (isLast) {
                    if (value instanceof field_value_1.FieldTransform) {
                        // If there is already data at this path, we need to retain it.
                        // Otherwise, we don't include it in the DocumentSnapshot.
                        return !(0, util_1.isEmpty)(target) ? target : null;
                    }
                    // The merge is done.
                    const leafNode = serializer.encodeValue(value);
                    if (leafNode) {
                        target[key] = leafNode;
                    }
                    return target;
                }
                else {
                    // We need to expand the target object.
                    const childNode = {
                        mapValue: {
                            fields: {},
                        },
                    };
                    const nestedValue = merge(childNode.mapValue.fields, value, path, pos + 1);
                    if (nestedValue) {
                        childNode.mapValue.fields = nestedValue;
                        target[key] = childNode;
                        return target;
                    }
                    else {
                        return !(0, util_1.isEmpty)(target) ? target : null;
                    }
                }
            }
            else {
                assert(!isLast, "Can't merge current value into a nested object");
                target[key].mapValue.fields = merge(target[key].mapValue.fields, value, path, pos + 1);
                return target;
            }
        }
        const res = {};
        for (const [key, value] of data) {
            const path = key.toArray();
            merge(res, value, path, 0);
        }
        return new DocumentSnapshot(ref, res);
    }
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
    get exists() {
        return this._fieldsProto !== undefined;
    }
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
    get ref() {
        return this._ref;
    }
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
    get id() {
        return this._ref.id;
    }
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
    get createTime() {
        return this._createTime;
    }
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
    get updateTime() {
        return this._updateTime;
    }
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
    get readTime() {
        if (this._readTime === undefined) {
            throw new Error("Called 'readTime' on a local document");
        }
        return this._readTime;
    }
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
    data() {
        const fields = this._fieldsProto;
        if (fields === undefined) {
            return undefined;
        }
        // We only want to use the converter and create a new QueryDocumentSnapshot
        // if a converter has been provided.
        if (this.ref._converter !== (0, types_1.defaultConverter)()) {
            const untypedReference = new document_reference_1.DocumentReference(this.ref.firestore, this.ref._path);
            return this.ref._converter.fromFirestore(new QueryDocumentSnapshot(untypedReference, this._fieldsProto, this.readTime, this.createTime, this.updateTime));
        }
        else {
            const obj = {};
            for (const prop of Object.keys(fields)) {
                obj[prop] = this._serializer.decodeValue(fields[prop]);
            }
            return obj;
        }
    }
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
    // We deliberately use `any` in the external API to not impose type-checking
    // on end users.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(field) {
        (0, path_1.validateFieldPath)('field', field);
        const protoField = this.protoField(field);
        if (protoField === undefined) {
            return undefined;
        }
        return this._serializer.decodeValue(protoField);
    }
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
    protoField(field) {
        let fields = this._fieldsProto;
        if (fields === undefined) {
            return undefined;
        }
        const components = path_1.FieldPath.fromArgument(field).toArray();
        while (components.length > 1) {
            fields = fields[components.shift()];
            if (!fields || !fields.mapValue) {
                return undefined;
            }
            fields = fields.mapValue.fields;
        }
        return fields[components[0]];
    }
    /**
     * Convert a document snapshot to the Firestore 'Write' proto.
     *
     * @private
     * @internal
     */
    toWriteProto() {
        return {
            update: {
                name: this._ref.formattedName,
                fields: this._fieldsProto,
            },
        };
    }
    /**
     * Convert a document snapshot to the Firestore 'Document' proto.
     *
     * @private
     * @internal
     */
    toDocumentProto() {
        var _a, _b;
        return {
            name: this._ref.formattedName,
            createTime: (_a = this.createTime) === null || _a === void 0 ? void 0 : _a.toProto().timestampValue,
            updateTime: (_b = this.updateTime) === null || _b === void 0 ? void 0 : _b.toProto().timestampValue,
            fields: this._fieldsProto,
        };
    }
    /**
     * Returns true if the document's data and path in this `DocumentSnapshot` is
     * equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `DocumentSnapshot` is equal to the provided
     * value.
     */
    isEqual(other) {
        // Since the read time is different on every document read, we explicitly
        // ignore all document metadata in this comparison.
        return (this === other ||
            (other instanceof DocumentSnapshot &&
                this._ref.isEqual(other._ref) &&
                deepEqual(this._fieldsProto, other._fieldsProto)));
    }
}
exports.DocumentSnapshot = DocumentSnapshot;
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
class QueryDocumentSnapshot extends DocumentSnapshot {
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
    get createTime() {
        return super.createTime;
    }
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
    get updateTime() {
        return super.updateTime;
    }
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
    data() {
        const data = super.data();
        if (!data) {
            throw new Error('The data in a QueryDocumentSnapshot should always exist.');
        }
        return data;
    }
}
exports.QueryDocumentSnapshot = QueryDocumentSnapshot;
/**
 * A Firestore Document Mask contains the field paths affected by an update.
 *
 * @class
 * @private
 * @internal
 */
class DocumentMask {
    /**
     * @private
     * @internal
     * @private
     *
     * @param fieldPaths The field paths in this mask.
     */
    constructor(fieldPaths) {
        this._sortedPaths = fieldPaths;
        this._sortedPaths.sort((a, b) => a.compareTo(b));
    }
    /**
     * Creates a document mask with the field paths of a document.
     *
     * @private
     * @internal
     * @param data A map with fields to modify. Only the keys are used to extract
     * the document mask.
     */
    static fromUpdateMap(data) {
        const fieldPaths = [];
        data.forEach((value, key) => {
            if (!(value instanceof field_value_1.FieldTransform) || value.includeInDocumentMask) {
                fieldPaths.push(path_1.FieldPath.fromArgument(key));
            }
        });
        return new DocumentMask(fieldPaths);
    }
    /**
     * Creates a document mask from an array of field paths.
     *
     * @private
     * @internal
     * @param fieldMask A list of field paths.
     */
    static fromFieldMask(fieldMask) {
        const fieldPaths = [];
        for (const fieldPath of fieldMask) {
            fieldPaths.push(path_1.FieldPath.fromArgument(fieldPath));
        }
        return new DocumentMask(fieldPaths);
    }
    /**
     * Creates a document mask with the field names of a document.
     *
     * @private
     * @internal
     * @param data An object with fields to modify. Only the keys are used to
     * extract the document mask.
     */
    static fromObject(data) {
        const fieldPaths = [];
        function extractFieldPaths(currentData, currentPath) {
            let isEmpty = true;
            for (const key of Object.keys(currentData)) {
                isEmpty = false;
                // We don't split on dots since fromObject is called with
                // DocumentData.
                const childSegment = new path_1.FieldPath(key);
                const childPath = currentPath
                    ? currentPath.append(childSegment)
                    : childSegment;
                const value = currentData[key];
                if (value instanceof field_value_1.FieldTransform) {
                    if (value.includeInDocumentMask) {
                        fieldPaths.push(childPath);
                    }
                }
                else if ((0, util_1.isPlainObject)(value)) {
                    extractFieldPaths(value, childPath);
                }
                else if (value !== undefined) {
                    // If the value is undefined it can never participate in the document
                    // mask. With `ignoreUndefinedProperties` set to false,
                    // `validateDocumentData` will reject an undefined value before even
                    // computing the document mask.
                    fieldPaths.push(childPath);
                }
            }
            // Add a field path for an explicitly updated empty map.
            if (currentPath && isEmpty) {
                fieldPaths.push(currentPath);
            }
        }
        extractFieldPaths(data);
        return new DocumentMask(fieldPaths);
    }
    /**
     * Returns true if this document mask contains no fields.
     *
     * @private
     * @internal
     * @return {boolean} Whether this document mask is empty.
     */
    get isEmpty() {
        return this._sortedPaths.length === 0;
    }
    /**
     * Removes the specified values from a sorted field path array.
     *
     * @private
     * @internal
     * @param input A sorted array of FieldPaths.
     * @param values An array of FieldPaths to remove.
     */
    static removeFromSortedArray(input, values) {
        for (let i = 0; i < input.length;) {
            let removed = false;
            for (const fieldPath of values) {
                if (input[i].isEqual(fieldPath)) {
                    input.splice(i, 1);
                    removed = true;
                    break;
                }
            }
            if (!removed) {
                ++i;
            }
        }
    }
    /**
     * Removes the field path specified in 'fieldPaths' from this document mask.
     *
     * @private
     * @internal
     * @param fieldPaths An array of FieldPaths.
     */
    removeFields(fieldPaths) {
        DocumentMask.removeFromSortedArray(this._sortedPaths, fieldPaths);
    }
    /**
     * Returns whether this document mask contains 'fieldPath'.
     *
     * @private
     * @internal
     * @param fieldPath The field path to test.
     * @return Whether this document mask contains 'fieldPath'.
     */
    contains(fieldPath) {
        for (const sortedPath of this._sortedPaths) {
            const cmp = sortedPath.compareTo(fieldPath);
            if (cmp === 0) {
                return true;
            }
            else if (cmp > 0) {
                return false;
            }
        }
        return false;
    }
    /**
     * Removes all properties from 'data' that are not contained in this document
     * mask.
     *
     * @private
     * @internal
     * @param data An object to filter.
     * @return A shallow copy of the object filtered by this document mask.
     */
    applyTo(data) {
        /*!
         * Applies this DocumentMask to 'data' and computes the list of field paths
         * that were specified in the mask but are not present in 'data'.
         */
        const applyDocumentMask = data => {
            const remainingPaths = this._sortedPaths.slice(0);
            const processObject = (currentData, currentPath) => {
                let result = null;
                Object.keys(currentData).forEach(key => {
                    const childPath = currentPath
                        ? currentPath.append(key)
                        : new path_1.FieldPath(key);
                    if (this.contains(childPath)) {
                        DocumentMask.removeFromSortedArray(remainingPaths, [childPath]);
                        result = result || {};
                        result[key] = currentData[key];
                    }
                    else if ((0, util_1.isObject)(currentData[key])) {
                        const childObject = processObject(currentData[key], childPath);
                        if (childObject) {
                            result = result || {};
                            result[key] = childObject;
                        }
                    }
                });
                return result;
            };
            // processObject() returns 'null' if the DocumentMask is empty.
            const filteredData = processObject(data) || {};
            return {
                filteredData,
                remainingPaths,
            };
        };
        const result = applyDocumentMask(data);
        if (result.remainingPaths.length !== 0) {
            throw new Error(`Input data is missing for field "${result.remainingPaths[0]}".`);
        }
        return result.filteredData;
    }
    /**
     * Converts a document mask to the Firestore 'DocumentMask' Proto.
     *
     * @private
     * @internal
     * @returns A Firestore 'DocumentMask' Proto.
     */
    toProto() {
        if (this.isEmpty) {
            return {};
        }
        const encodedPaths = [];
        for (const fieldPath of this._sortedPaths) {
            encodedPaths.push(fieldPath.formattedName);
        }
        return {
            fieldPaths: encodedPaths,
        };
    }
}
exports.DocumentMask = DocumentMask;
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
class DocumentTransform {
    /**
     * @private
     * @internal
     * @private
     *
     * @param ref The DocumentReference for this transform.
     * @param transforms A Map of FieldPaths to FieldTransforms.
     */
    constructor(ref, transforms) {
        this.ref = ref;
        this.transforms = transforms;
    }
    /**
     * Generates a DocumentTransform from a JavaScript object.
     *
     * @private
     * @internal
     * @param ref The `DocumentReference` to use for the DocumentTransform.
     * @param obj The object to extract the transformations from.
     * @returns The Document Transform.
     */
    static fromObject(ref, obj) {
        const updateMap = new Map();
        for (const prop of Object.keys(obj)) {
            updateMap.set(new path_1.FieldPath(prop), obj[prop]);
        }
        return DocumentTransform.fromUpdateMap(ref, updateMap);
    }
    /**
     * Generates a DocumentTransform from an Update Map.
     *
     * @private
     * @internal
     * @param ref The `DocumentReference` to use for the DocumentTransform.
     * @param data The update data to extract the transformations from.
     * @returns The Document Transform.
     */
    static fromUpdateMap(ref, data) {
        const transforms = new Map();
        function encode_(val, path, allowTransforms) {
            if (val instanceof field_value_1.FieldTransform && val.includeInDocumentTransform) {
                if (allowTransforms) {
                    transforms.set(path, val);
                }
                else {
                    throw new Error(`${val.methodName}() is not supported inside of array values.`);
                }
            }
            else if (Array.isArray(val)) {
                for (let i = 0; i < val.length; ++i) {
                    // We need to verify that no array value contains a document transform
                    encode_(val[i], path.append(String(i)), false);
                }
            }
            else if ((0, util_1.isPlainObject)(val)) {
                for (const prop of Object.keys(val)) {
                    encode_(val[prop], path.append(new path_1.FieldPath(prop)), allowTransforms);
                }
            }
        }
        data.forEach((value, key) => {
            encode_(value, path_1.FieldPath.fromArgument(key), true);
        });
        return new DocumentTransform(ref, transforms);
    }
    /**
     * Whether this DocumentTransform contains any actionable transformations.
     *
     * @private
     * @internal
     */
    get isEmpty() {
        return this.transforms.size === 0;
    }
    /**
     * Returns the array of fields in this DocumentTransform.
     *
     * @private
     * @internal
     */
    get fields() {
        return Array.from(this.transforms.keys());
    }
    /**
     * Validates the user provided field values in this document transform.
     * @private
     * @internal
     */
    validate() {
        const allowUndefined = !!this.ref.firestore._settings.ignoreUndefinedProperties;
        this.transforms.forEach(transform => transform.validate(allowUndefined));
    }
    /**
     * Converts a document transform to the Firestore 'FieldTransform' Proto.
     *
     * @private
     * @internal
     * @param serializer The Firestore serializer
     * @returns A list of Firestore 'FieldTransform' Protos
     */
    toProto(serializer) {
        return Array.from(this.transforms, ([path, transform]) => transform.toProto(serializer, path));
    }
}
exports.DocumentTransform = DocumentTransform;
/**
 * A Firestore Precondition encapsulates options for database writes.
 *
 * @private
 * @internal
 * @class
 */
class Precondition {
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
    constructor(options) {
        if (options !== undefined) {
            this._exists = options.exists;
            this._lastUpdateTime = options.lastUpdateTime;
        }
    }
    /**
     * Generates the Protobuf `Preconditon` object for this precondition.
     *
     * @private
     * @internal
     * @returns The `Preconditon` Protobuf object or 'null' if there are no
     * preconditions.
     */
    toProto() {
        if (this.isEmpty) {
            return null;
        }
        const proto = {};
        if (this._lastUpdateTime !== undefined) {
            proto.updateTime = this._lastUpdateTime.toProto().timestampValue;
        }
        else {
            proto.exists = this._exists;
        }
        return proto;
    }
    /**
     * Whether this DocumentTransform contains any enforcement.
     *
     * @private
     * @internal
     */
    get isEmpty() {
        return this._exists === undefined && !this._lastUpdateTime;
    }
}
exports.Precondition = Precondition;
//# sourceMappingURL=document.js.map