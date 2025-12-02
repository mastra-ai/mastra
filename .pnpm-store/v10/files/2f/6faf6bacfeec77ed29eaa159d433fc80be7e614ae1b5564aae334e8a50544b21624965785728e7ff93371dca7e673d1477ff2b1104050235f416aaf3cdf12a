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
import * as firestore from '@google-cloud/firestore';
import { ResourcePath } from '../path';
import { Query } from './query';
import Firestore from '../index';
import { DocumentReference } from './document-reference';
/**
 * A CollectionReference object can be used for adding documents, getting
 * document references, and querying for documents (using the methods
 * inherited from [Query]{@link Query}).
 *
 * @class CollectionReference
 * @extends Query
 */
export declare class CollectionReference<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> extends Query<AppModelType, DbModelType> implements firestore.CollectionReference<AppModelType, DbModelType> {
    /**
     * @private
     *
     * @param firestore The Firestore Database client.
     * @param path The Path of this collection.
     */
    constructor(firestore: Firestore, path: ResourcePath, converter?: firestore.FirestoreDataConverter<AppModelType, DbModelType>);
    /**
     * Returns a resource path for this collection.
     * @private
     * @internal
     */
    get _resourcePath(): ResourcePath;
    /**
     * The last path element of the referenced collection.
     *
     * @type {string}
     * @name CollectionReference#id
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col/doc/subcollection');
     * console.log(`ID of the subcollection: ${collectionRef.id}`);
     * ```
     */
    get id(): string;
    /**
     * A reference to the containing Document if this is a subcollection, else
     * null.
     *
     * @type {DocumentReference|null}
     * @name CollectionReference#parent
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col/doc/subcollection');
     * let documentRef = collectionRef.parent;
     * console.log(`Parent name: ${documentRef.path}`);
     * ```
     */
    get parent(): DocumentReference | null;
    /**
     * A string representing the path of the referenced collection (relative
     * to the root of the database).
     *
     * @type {string}
     * @name CollectionReference#path
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col/doc/subcollection');
     * console.log(`Path of the subcollection: ${collectionRef.path}`);
     * ```
     */
    get path(): string;
    /**
     * Retrieves the list of documents in this collection.
     *
     * The document references returned may include references to "missing
     * documents", i.e. document locations that have no document present but
     * which contain subcollections with documents. Attempting to read such a
     * document reference (e.g. via `.get()` or `.onSnapshot()`) will return a
     * `DocumentSnapshot` whose `.exists` property is false.
     *
     * @return {Promise<DocumentReference[]>} The list of documents in this
     * collection.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * return collectionRef.listDocuments().then(documentRefs => {
     *    return firestore.getAll(...documentRefs);
     * }).then(documentSnapshots => {
     *    for (let documentSnapshot of documentSnapshots) {
     *       if (documentSnapshot.exists) {
     *         console.log(`Found document with data: ${documentSnapshot.id}`);
     *       } else {
     *         console.log(`Found missing document: ${documentSnapshot.id}`);
     *       }
     *    }
     * });
     * ```
     */
    listDocuments(): Promise<Array<DocumentReference<AppModelType, DbModelType>>>;
    doc(): DocumentReference<AppModelType, DbModelType>;
    doc(documentPath: string): DocumentReference<AppModelType, DbModelType>;
    /**
     * Add a new document to this collection with the specified data, assigning
     * it a document ID automatically.
     *
     * @param {DocumentData} data An Object containing the data for the new
     * document.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {Promise.<DocumentReference>} A Promise resolved with a
     * [DocumentReference]{@link DocumentReference} pointing to the
     * newly created document.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   console.log(`Added document with name: ${documentReference.id}`);
     * });
     * ```
     */
    add(data: firestore.WithFieldValue<AppModelType>): Promise<DocumentReference<AppModelType, DbModelType>>;
    /**
     * Returns true if this `CollectionReference` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `CollectionReference` is equal to the
     * provided value.
     */
    isEqual(other: firestore.CollectionReference<AppModelType, DbModelType>): boolean;
    withConverter(converter: null): CollectionReference;
    withConverter<NewAppModelType, NewDbModelType extends firestore.DocumentData = firestore.DocumentData>(converter: firestore.FirestoreDataConverter<NewAppModelType, NewDbModelType>): CollectionReference<NewAppModelType, NewDbModelType>;
}
