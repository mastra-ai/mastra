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
import * as protos from '../../protos/firestore_v1_proto_api';
import api = protos.google.firestore.v1;
import * as firestore from '@google-cloud/firestore';
import Firestore, { DocumentSnapshot, WriteResult } from '../index';
import { ResourcePath } from '../path';
import { Serializable } from '../serializer';
import { CollectionReference } from './collection-reference';
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
export declare class DocumentReference<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements Serializable, firestore.DocumentReference<AppModelType, DbModelType> {
    private readonly _firestore;
    /**
     * @private
     * @internal
     **/
    readonly _path: ResourcePath;
    /**
     * @internal
     * @private
     **/
    readonly _converter: firestore.FirestoreDataConverter<AppModelType, DbModelType>;
    /**
     * @private
     * @internal
     * @param _firestore The Firestore Database client.
     * @param _path The Path of this reference.
     * @param _converter The converter to use when serializing data.
     */
    constructor(_firestore: Firestore, 
    /**
     * @private
     * @internal
     **/
    _path: ResourcePath, 
    /**
     * @internal
     * @private
     **/
    _converter?: firestore.FirestoreDataConverter<AppModelType, DbModelType>);
    /**
     * The string representation of the DocumentReference's location.
     * @private
     * @internal
     * @type {string}
     * @name DocumentReference#formattedName
     */
    get formattedName(): string;
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
    get firestore(): Firestore;
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
    get path(): string;
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
    get id(): string;
    /**
     * Returns a resource path for this document.
     * @private
     * @internal
     */
    get _resourcePath(): ResourcePath;
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
    get parent(): CollectionReference<AppModelType, DbModelType>;
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
    get(): Promise<DocumentSnapshot<AppModelType, DbModelType>>;
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
    collection(collectionPath: string): CollectionReference;
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
    listCollections(): Promise<Array<CollectionReference>>;
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
    create(data: firestore.WithFieldValue<AppModelType>): Promise<WriteResult>;
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
    delete(precondition?: firestore.Precondition): Promise<WriteResult>;
    set(data: firestore.PartialWithFieldValue<AppModelType>, options: firestore.SetOptions): Promise<WriteResult>;
    set(data: firestore.WithFieldValue<AppModelType>): Promise<WriteResult>;
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
    update(dataOrField: firestore.UpdateData<DbModelType> | string | firestore.FieldPath, ...preconditionOrValues: Array<unknown | string | firestore.FieldPath | firestore.Precondition>): Promise<WriteResult>;
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
    onSnapshot(onNext: (snapshot: firestore.DocumentSnapshot<AppModelType, DbModelType>) => void, onError?: (error: Error) => void): () => void;
    /**
     * Returns true if this `DocumentReference` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `DocumentReference` is equal to the provided
     * value.
     */
    isEqual(other: firestore.DocumentReference<AppModelType, DbModelType>): boolean;
    /**
     * Converts this DocumentReference to the Firestore Proto representation.
     *
     * @private
     * @internal
     */
    toProto(): api.IValue;
    withConverter(converter: null): DocumentReference;
    withConverter<NewAppModelType, NewDbModelType extends firestore.DocumentData = firestore.DocumentData>(converter: firestore.FirestoreDataConverter<NewAppModelType, NewDbModelType>): DocumentReference<NewAppModelType, NewDbModelType>;
}
