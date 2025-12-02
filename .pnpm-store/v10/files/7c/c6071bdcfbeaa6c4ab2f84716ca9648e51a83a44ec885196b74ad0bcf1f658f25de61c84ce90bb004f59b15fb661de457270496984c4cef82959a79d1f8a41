/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
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
import * as proto from '../protos/firestore_v1_proto_api';
import { FieldPath } from './path';
import { Serializer } from './serializer';
import api = proto.google.firestore.v1;
/**
 * Represent a vector type in Firestore documents.
 * Create an instance with {@link FieldValue.vector}.
 *
 * @class VectorValue
 */
export declare class VectorValue implements firestore.VectorValue {
    private readonly _values;
    /**
     * @private
     * @internal
     */
    constructor(values: number[] | undefined);
    /**
     * Returns a copy of the raw number array form of the vector.
     */
    toArray(): number[];
    /**
     * @private
     * @internal
     */
    _toProto(serializer: Serializer): api.IValue;
    /**
     * @private
     * @internal
     */
    static _fromProto(valueArray: api.IValue): VectorValue;
    /**
     * Returns `true` if the two VectorValue has the same raw number arrays, returns `false` otherwise.
     */
    isEqual(other: VectorValue): boolean;
}
/**
 * Sentinel values that can be used when writing documents with set(), create()
 * or update().
 *
 * @class FieldValue
 */
export declare class FieldValue implements firestore.FieldValue {
    /** @private */
    constructor();
    /**
     * Creates a new `VectorValue` constructed with a copy of the given array of numbers.
     *
     * @param values - Create a `VectorValue` instance with a copy of this array of numbers.
     *
     * @returns A new `VectorValue` constructed with a copy of the given array of numbers.
     */
    static vector(values?: number[]): VectorValue;
    /**
     * Returns a sentinel for use with update() or set() with {merge:true} to mark
     * a field for deletion.
     *
     * @returns {FieldValue} The sentinel value to use in your objects.
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     * let data = { a: 'b', c: 'd' };
     *
     * documentRef.set(data).then(() => {
     *   return documentRef.update({a: Firestore.FieldValue.delete()});
     * }).then(() => {
     *   // Document now only contains { c: 'd' }
     * });
     * ```
     */
    static delete(): FieldValue;
    /**
     * Returns a sentinel used with set(), create() or update() to include a
     * server-generated timestamp in the written data.
     *
     * @return {FieldValue} The FieldValue sentinel for use in a call to set(),
     * create() or update().
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.set({
     *   time: Firestore.FieldValue.serverTimestamp()
     * }).then(() => {
     *   return documentRef.get();
     * }).then(doc => {
     *   console.log(`Server time set to ${doc.get('time')}`);
     * });
     * ```
     */
    static serverTimestamp(): FieldValue;
    /**
     * Returns a special value that can be used with set(), create() or update()
     * that tells the server to increment the the field's current value by the
     * given value.
     *
     * If either current field value or the operand uses floating point
     * precision, both values will be interpreted as floating point numbers and
     * all arithmetic will follow IEEE 754 semantics. Otherwise, integer
     * precision is kept and the result is capped between -2^63 and 2^63-1.
     *
     * If the current field value is not of type 'number', or if the field does
     * not yet exist, the transformation will set the field to the given value.
     *
     * @param {number} n The value to increment by.
     * @return {FieldValue} The FieldValue sentinel for use in a call to set(),
     * create() or update().
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.update(
     *   'counter', Firestore.FieldValue.increment(1)
     * ).then(() => {
     *   return documentRef.get();
     * }).then(doc => {
     *   // doc.get('counter') was incremented
     * });
     * ```
     */
    static increment(n: number): FieldValue;
    /**
     * Returns a special value that can be used with set(), create() or update()
     * that tells the server to union the given elements with any array value that
     * already exists on the server. Each specified element that doesn't already
     * exist in the array will be added to the end. If the field being modified is
     * not already an array it will be overwritten with an array containing
     * exactly the specified elements.
     *
     * @param {...*} elements The elements to union into the array.
     * @return {FieldValue} The FieldValue sentinel for use in a call to set(),
     * create() or update().
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.update(
     *   'array', Firestore.FieldValue.arrayUnion('foo')
     * ).then(() => {
     *   return documentRef.get();
     * }).then(doc => {
     *   // doc.get('array') contains field 'foo'
     * });
     * ```
     */
    static arrayUnion(...elements: unknown[]): FieldValue;
    /**
     * Returns a special value that can be used with set(), create() or update()
     * that tells the server to remove the given elements from any array value
     * that already exists on the server. All instances of each element specified
     * will be removed from the array. If the field being modified is not already
     * an array it will be overwritten with an empty array.
     *
     * @param {...*} elements The elements to remove from the array.
     * @return {FieldValue} The FieldValue sentinel for use in a call to set(),
     * create() or update().
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.update(
     *   'array', Firestore.FieldValue.arrayRemove('foo')
     * ).then(() => {
     *   return documentRef.get();
     * }).then(doc => {
     *   // doc.get('array') no longer contains field 'foo'
     * });
     * ```
     */
    static arrayRemove(...elements: unknown[]): FieldValue;
    /**
     * Returns true if this `FieldValue` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `FieldValue` is equal to the provided value.
     *
     * @example
     * ```
     * let fieldValues = [
     *   Firestore.FieldValue.increment(-1.0),
     *   Firestore.FieldValue.increment(-1),
     *   Firestore.FieldValue.increment(-0.0),
     *   Firestore.FieldValue.increment(-0),
     *   Firestore.FieldValue.increment(0),
     *   Firestore.FieldValue.increment(0.0),
     *   Firestore.FieldValue.increment(1),
     *   Firestore.FieldValue.increment(1.0)
     * ];
     *
     * let equal = 0;
     * for (let i = 0; i < fieldValues.length; ++i) {
     *   for (let j = i + 1; j < fieldValues.length; ++j) {
     *     if (fieldValues[i].isEqual(fieldValues[j])) {
     *       ++equal;
     *     }
     *   }
     * }
     * console.log(`Found ${equal} equalities.`);
     * ```
     */
    isEqual(other: firestore.FieldValue): boolean;
}
/**
 * An internal interface shared by all field transforms.
 *
 * A 'FieldTransform` subclass should implement '.includeInDocumentMask',
 * '.includeInDocumentTransform' and 'toProto' (if '.includeInDocumentTransform'
 * is 'true').
 *
 * @private
 * @internal
 * @abstract
 */
export declare abstract class FieldTransform extends FieldValue {
    /** Whether this FieldTransform should be included in the document mask. */
    abstract get includeInDocumentMask(): boolean;
    /**
     * Whether this FieldTransform should be included in the list of document
     * transforms.
     */
    abstract get includeInDocumentTransform(): boolean;
    /** The method name used to obtain the field transform. */
    abstract get methodName(): string;
    /**
     * Performs input validation on the values of this field transform.
     *
     * @param allowUndefined Whether to allow nested properties that are `undefined`.
     */
    abstract validate(allowUndefined: boolean): void;
    /***
     * The proto representation for this field transform.
     *
     * @param serializer The Firestore serializer.
     * @param fieldPath The field path to apply this transformation to.
     * @return The 'FieldTransform' proto message.
     */
    abstract toProto(serializer: Serializer, fieldPath: FieldPath): api.DocumentTransform.IFieldTransform;
}
/**
 * A transform that deletes a field from a Firestore document.
 *
 * @private
 * @internal
 */
export declare class DeleteTransform extends FieldTransform {
    /**
     * Sentinel value for a field delete.
     * @private
     * @internal
     */
    static DELETE_SENTINEL: DeleteTransform;
    private constructor();
    /**
     * Deletes are included in document masks.
     * @private
     * @internal
     */
    get includeInDocumentMask(): true;
    /**
     * Deletes are are omitted from document transforms.
     * @private
     * @internal
     */
    get includeInDocumentTransform(): false;
    get methodName(): string;
    validate(): void;
    toProto(): never;
}
