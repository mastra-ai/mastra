"use strict";
/**
 * Copyright 2024 Google LLC. All Rights Reserved.
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
exports.DocumentReference = void 0;
const index_1 = require("../index");
const path_1 = require("../path");
const types_1 = require("../types");
const collection_reference_1 = require("./collection-reference");
const util_1 = require("../util");
const validate_1 = require("../validate");
const document_1 = require("../document");
const trace_util_1 = require("../telemetry/trace-util");
/**
 * A DocumentReference refers to a document location in a Firestore database
 * and can be used to write, read, or listen to the location. The document at
 * the referenced location may or may not exist. A DocumentReference can
 * also be used to create a
 * [CollectionReference]{@link CollectionReference} to a
 * subcollection.
 *
 * @class DocumentReference
 */
class DocumentReference {
    /**
     * @private
     * @internal
     * @param _firestore The Firestore Database client.
     * @param _path The Path of this reference.
     * @param _converter The converter to use when serializing data.
     */
    constructor(_firestore, 
    /**
     * @private
     * @internal
     **/
    _path, 
    /**
     * @internal
     * @private
     **/
    _converter = (0, types_1.defaultConverter)()) {
        this._firestore = _firestore;
        this._path = _path;
        this._converter = _converter;
    }
    /**
     * The string representation of the DocumentReference's location.
     * @private
     * @internal
     * @type {string}
     * @name DocumentReference#formattedName
     */
    get formattedName() {
        const projectId = this.firestore.projectId;
        const databaseId = this.firestore.databaseId;
        return this._path.toQualifiedResourcePath(projectId, databaseId)
            .formattedName;
    }
    /**
     * The [Firestore]{@link Firestore} instance for the Firestore
     * database (useful for performing transactions, etc.).
     *
     * @type {Firestore}
     * @name DocumentReference#firestore
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   let firestore = documentReference.firestore;
     *   console.log(`Root location for document is ${firestore.formattedName}`);
     * });
     * ```
     */
    get firestore() {
        return this._firestore;
    }
    /**
     * A string representing the path of the referenced document (relative
     * to the root of the database).
     *
     * @type {string}
     * @name DocumentReference#path
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   console.log(`Added document at '${documentReference.path}'`);
     * });
     * ```
     */
    get path() {
        return this._path.relativeName;
    }
    /**
     * The last path element of the referenced document.
     *
     * @type {string}
     * @name DocumentReference#id
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   console.log(`Added document with name '${documentReference.id}'`);
     * });
     * ```
     */
    get id() {
        return this._path.id;
    }
    /**
     * Returns a resource path for this document.
     * @private
     * @internal
     */
    get _resourcePath() {
        return this._path;
    }
    /**
     * A reference to the collection to which this DocumentReference belongs.
     *
     * @name DocumentReference#parent
     * @type {CollectionReference}
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     * let collectionRef = documentRef.parent;
     *
     * collectionRef.where('foo', '==', 'bar').get().then(results => {
     *   console.log(`Found ${results.size} matches in parent collection`);
     * }):
     * ```
     */
    get parent() {
        return new collection_reference_1.CollectionReference(this._firestore, this._path.parent(), this._converter);
    }
    /**
     * Reads the document referred to by this DocumentReference.
     *
     * @returns {Promise.<DocumentSnapshot>} A Promise resolved with a
     * DocumentSnapshot for the retrieved document on success. For missing
     * documents, DocumentSnapshot.exists will be false. If the get() fails for
     * other reasons, the Promise will be rejected.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then(documentSnapshot => {
     *   if (documentSnapshot.exists) {
     *     console.log('Document retrieved successfully.');
     *   }
     * });
     * ```
     */
    get() {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_DOC_REF_GET, () => {
            return this._firestore.getAll(this).then(([result]) => result);
        });
    }
    /**
     * Gets a [CollectionReference]{@link CollectionReference} instance
     * that refers to the collection at the specified path.
     *
     * @param {string} collectionPath A slash-separated path to a collection.
     * @returns {CollectionReference} A reference to the new
     * subcollection.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     * let subcollection = documentRef.collection('subcollection');
     * console.log(`Path to subcollection: ${subcollection.path}`);
     * ```
     */
    collection(collectionPath) {
        (0, path_1.validateResourcePath)('collectionPath', collectionPath);
        const path = this._path.append(collectionPath);
        if (!path.isCollection) {
            throw new Error(`Value for argument "collectionPath" must point to a collection, but was "${collectionPath}". Your path does not contain an odd number of components.`);
        }
        return new collection_reference_1.CollectionReference(this._firestore, path);
    }
    /**
     * Fetches the subcollections that are direct children of this document.
     *
     * @returns {Promise.<Array.<CollectionReference>>} A Promise that resolves
     * with an array of CollectionReferences.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.listCollections().then(collections => {
     *   for (let collection of collections) {
     *     console.log(`Found subcollection with id: ${collection.id}`);
     *   }
     * });
     * ```
     */
    listCollections() {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_DOC_REF_LIST_COLLECTIONS, () => {
            const tag = (0, util_1.requestTag)();
            return this.firestore.initializeIfNeeded(tag).then(() => {
                const request = {
                    parent: this.formattedName,
                };
                return this._firestore
                    .request('listCollectionIds', request, tag)
                    .then(collectionIds => {
                    const collections = [];
                    // We can just sort this list using the default comparator since it
                    // will only contain collection ids.
                    collectionIds.sort();
                    for (const collectionId of collectionIds) {
                        collections.push(this.collection(collectionId));
                    }
                    return collections;
                });
            });
        });
    }
    /**
     * Create a document with the provided object values. This will fail the write
     * if a document exists at its location.
     *
     * @param {DocumentData} data An object that contains the fields and data to
     * serialize as the document.
     * @throws {Error} If the provided input is not a valid Firestore document or if the document already exists.
     * @returns {Promise.<WriteResult>} A Promise that resolves with the
     * write time of this create.
     *
     * @example
     * ```
     * let documentRef = firestore.collection('col').doc();
     *
     * documentRef.create({foo: 'bar'}).then((res) => {
     *   console.log(`Document created at ${res.updateTime}`);
     * }).catch((err) => {
     *   console.log(`Failed to create document: ${err}`);
     * });
     * ```
     */
    create(data) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_DOC_REF_CREATE, () => {
            const writeBatch = new index_1.WriteBatch(this._firestore);
            return writeBatch
                .create(this, data)
                .commit()
                .then(([writeResult]) => writeResult);
        });
    }
    /**
     * Deletes the document referred to by this `DocumentReference`.
     *
     * A delete for a non-existing document is treated as a success (unless
     * lastUptimeTime is provided).
     *
     * @param {Precondition=} precondition A precondition to enforce for this
     * delete.
     * @param {Timestamp=} precondition.lastUpdateTime If set, enforces that the
     * document was last updated at lastUpdateTime. Fails the delete if the
     * document was last updated at a different time.
     * @param {boolean=} precondition.exists If set, enforces that the target
     * document must or must not exist.
     * @returns {Promise.<WriteResult>} A Promise that resolves with the
     * delete time.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.delete().then(() => {
     *   console.log('Document successfully deleted.');
     * });
     * ```
     */
    delete(precondition) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_DOC_REF_DELETE, () => {
            const writeBatch = new index_1.WriteBatch(this._firestore);
            return writeBatch
                .delete(this, precondition)
                .commit()
                .then(([writeResult]) => writeResult);
        });
    }
    /**
     * Writes to the document referred to by this DocumentReference. If the
     * document does not yet exist, it will be created. If you pass
     * [SetOptions]{@link SetOptions}, the provided data can be merged into an
     * existing document.
     *
     * @param {T|Partial<AppModelType>} data A map of the fields and values for
     * the document.
     * @param {SetOptions=} options An object to configure the set behavior.
     * @param {boolean=} options.merge If true, set() merges the values specified
     * in its data argument. Fields omitted from this set() call remain untouched.
     * If your input sets any field to an empty map, all nested fields are
     * overwritten.
     * @param {Array.<string|FieldPath>=} options.mergeFields If provided,
     * set() only replaces the specified field paths. Any field path that is not
     * specified is ignored and remains untouched. If your input sets any field to
     * an empty map, all nested fields are overwritten.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {Promise.<WriteResult>} A Promise that resolves with the
     * write time of this set.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.set({foo: 'bar'}).then(res => {
     *   console.log(`Document written at ${res.updateTime}`);
     * });
     * ```
     */
    set(data, options) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_DOC_REF_SET, () => {
            let writeBatch = new index_1.WriteBatch(this._firestore);
            if (options) {
                writeBatch = writeBatch.set(this, data, options);
            }
            else {
                writeBatch = writeBatch.set(this, data);
            }
            return writeBatch.commit().then(([writeResult]) => writeResult);
        });
    }
    /**
     * Updates fields in the document referred to by this DocumentReference.
     * If the document doesn't yet exist, the update fails and the returned
     * Promise will be rejected.
     *
     * The update() method accepts either an object with field paths encoded as
     * keys and field values encoded as values, or a variable number of arguments
     * that alternate between field paths and field values.
     *
     * A Precondition restricting this update can be specified as the last
     * argument.
     *
     * @param {UpdateData|string|FieldPath} dataOrField An object containing the
     * fields and values with which to update the document or the path of the
     * first field to update.
     * @param {
     * ...(*|string|FieldPath|Precondition)} preconditionOrValues An alternating
     * list of field paths and values to update or a Precondition to restrict
     * this update.
     * @throws {Error} If the provided input is not valid Firestore data.
     * @returns {Promise.<WriteResult>} A Promise that resolves once the
     * data has been successfully written to the backend.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.update({foo: 'bar'}).then(res => {
     *   console.log(`Document updated at ${res.updateTime}`);
     * });
     * ```
     */
    update(dataOrField, ...preconditionOrValues) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_DOC_REF_UPDATE, () => {
            // eslint-disable-next-line prefer-rest-params
            (0, validate_1.validateMinNumberOfArguments)('DocumentReference.update', arguments, 1);
            const writeBatch = new index_1.WriteBatch(this._firestore);
            return writeBatch
                .update(this, dataOrField, ...preconditionOrValues)
                .commit()
                .then(([writeResult]) => writeResult);
        });
    }
    /**
     * Attaches a listener for DocumentSnapshot events.
     *
     * @param {documentSnapshotCallback} onNext A callback to be called every
     * time a new `DocumentSnapshot` is available.
     * @param {errorCallback=} onError A callback to be called if the listen fails
     * or is cancelled. No further callbacks will occur. If unset, errors will be
     * logged to the console.
     *
     * @returns {function()} An unsubscribe function that can be called to cancel
     * the snapshot listener.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * let unsubscribe = documentRef.onSnapshot(documentSnapshot => {
     *   if (documentSnapshot.exists) {
     *     console.log(documentSnapshot.data());
     *   }
     * }, err => {
     *   console.log(`Encountered error: ${err}`);
     * });
     *
     * // Remove this listener.
     * unsubscribe();
     * ```
     */
    onSnapshot(onNext, onError) {
        (0, validate_1.validateFunction)('onNext', onNext);
        (0, validate_1.validateFunction)('onError', onError, { optional: true });
        const watch = new (require('../watch').DocumentWatch)(this.firestore, this);
        return watch.onSnapshot((readTime, size, docs) => {
            for (const document of docs()) {
                if (document.ref.path === this.path) {
                    onNext(document);
                    return;
                }
            }
            // The document is missing.
            const ref = new DocumentReference(this._firestore, this._path, this._converter);
            const document = new document_1.DocumentSnapshotBuilder(ref);
            document.readTime = readTime;
            onNext(document.build());
        }, onError || console.error);
    }
    /**
     * Returns true if this `DocumentReference` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `DocumentReference` is equal to the provided
     * value.
     */
    isEqual(other) {
        return (this === other ||
            (other instanceof DocumentReference &&
                this._firestore === other._firestore &&
                this._path.isEqual(other._path) &&
                this._converter === other._converter));
    }
    /**
     * Converts this DocumentReference to the Firestore Proto representation.
     *
     * @private
     * @internal
     */
    toProto() {
        return { referenceValue: this.formattedName };
    }
    /**
     * Applies a custom data converter to this DocumentReference, allowing you to
     * use your own custom model objects with Firestore. When you call set(),
     * get(), etc. on the returned DocumentReference instance, the provided
     * converter will convert between Firestore data of type `NewDbModelType` and
     * your custom type `NewAppModelType`.
     *
     * Using the converter allows you to specify generic type arguments when
     * storing and retrieving objects from Firestore.
     *
     * Passing in `null` as the converter parameter removes the current
     * converter.
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
     * @param {FirestoreDataConverter | null} converter Converts objects to and
     * from Firestore. Passing in `null` removes the current converter.
     * @return A DocumentReference that uses the provided converter.
     */
    withConverter(converter) {
        return new DocumentReference(this.firestore, this._path, converter !== null && converter !== void 0 ? converter : (0, types_1.defaultConverter)());
    }
}
exports.DocumentReference = DocumentReference;
//# sourceMappingURL=document-reference.js.map