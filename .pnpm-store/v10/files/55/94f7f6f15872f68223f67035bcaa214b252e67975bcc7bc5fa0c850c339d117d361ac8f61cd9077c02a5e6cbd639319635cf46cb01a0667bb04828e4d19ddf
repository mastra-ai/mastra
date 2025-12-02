"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteTransform = exports.FieldTransform = exports.FieldValue = exports.VectorValue = void 0;
const deepEqual = require("fast-deep-equal");
const serializer_1 = require("./serializer");
const util_1 = require("./util");
const validate_1 = require("./validate");
/**
 * Represent a vector type in Firestore documents.
 * Create an instance with {@link FieldValue.vector}.
 *
 * @class VectorValue
 */
class VectorValue {
    /**
     * @private
     * @internal
     */
    constructor(values) {
        // Making a copy of the parameter.
        this._values = (values || []).map(n => n);
    }
    /**
     * Returns a copy of the raw number array form of the vector.
     */
    toArray() {
        return this._values.map(n => n);
    }
    /**
     * @private
     * @internal
     */
    _toProto(serializer) {
        return serializer.encodeVector(this._values);
    }
    /**
     * @private
     * @internal
     */
    static _fromProto(valueArray) {
        var _a, _b;
        const values = (_b = (_a = valueArray.arrayValue) === null || _a === void 0 ? void 0 : _a.values) === null || _b === void 0 ? void 0 : _b.map(v => {
            return v.doubleValue;
        });
        return new VectorValue(values);
    }
    /**
     * Returns `true` if the two VectorValue has the same raw number arrays, returns `false` otherwise.
     */
    isEqual(other) {
        return (0, util_1.isPrimitiveArrayEqual)(this._values, other._values);
    }
}
exports.VectorValue = VectorValue;
/**
 * Sentinel values that can be used when writing documents with set(), create()
 * or update().
 *
 * @class FieldValue
 */
class FieldValue {
    /** @private */
    constructor() { }
    /**
     * Creates a new `VectorValue` constructed with a copy of the given array of numbers.
     *
     * @param values - Create a `VectorValue` instance with a copy of this array of numbers.
     *
     * @returns A new `VectorValue` constructed with a copy of the given array of numbers.
     */
    static vector(values) {
        return new VectorValue(values);
    }
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
    static delete() {
        return DeleteTransform.DELETE_SENTINEL;
    }
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
    static serverTimestamp() {
        return ServerTimestampTransform.SERVER_TIMESTAMP_SENTINEL;
    }
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
    static increment(n) {
        // eslint-disable-next-line prefer-rest-params
        (0, validate_1.validateMinNumberOfArguments)('FieldValue.increment', arguments, 1);
        return new NumericIncrementTransform(n);
    }
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
    static arrayUnion(...elements) {
        (0, validate_1.validateMinNumberOfArguments)('FieldValue.arrayUnion', elements, 1);
        return new ArrayUnionTransform(elements);
    }
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
    static arrayRemove(...elements) {
        (0, validate_1.validateMinNumberOfArguments)('FieldValue.arrayRemove', elements, 1);
        return new ArrayRemoveTransform(elements);
    }
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
    isEqual(other) {
        return this === other;
    }
}
exports.FieldValue = FieldValue;
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
class FieldTransform extends FieldValue {
}
exports.FieldTransform = FieldTransform;
/**
 * A transform that deletes a field from a Firestore document.
 *
 * @private
 * @internal
 */
class DeleteTransform extends FieldTransform {
    constructor() {
        super();
    }
    /**
     * Deletes are included in document masks.
     * @private
     * @internal
     */
    get includeInDocumentMask() {
        return true;
    }
    /**
     * Deletes are are omitted from document transforms.
     * @private
     * @internal
     */
    get includeInDocumentTransform() {
        return false;
    }
    get methodName() {
        return 'FieldValue.delete';
    }
    validate() { }
    toProto() {
        throw new Error('FieldValue.delete() should not be included in a FieldTransform');
    }
}
exports.DeleteTransform = DeleteTransform;
/**
 * Sentinel value for a field delete.
 * @private
 * @internal
 */
DeleteTransform.DELETE_SENTINEL = new DeleteTransform();
/**
 * A transform that sets a field to the Firestore server time.
 *
 * @private
 * @internal
 */
class ServerTimestampTransform extends FieldTransform {
    constructor() {
        super();
    }
    /**
     * Server timestamps are omitted from document masks.
     *
     * @private
     * @internal
     */
    get includeInDocumentMask() {
        return false;
    }
    /**
     * Server timestamps are included in document transforms.
     *
     * @private
     * @internal
     */
    get includeInDocumentTransform() {
        return true;
    }
    get methodName() {
        return 'FieldValue.serverTimestamp';
    }
    validate() { }
    toProto(serializer, fieldPath) {
        return {
            fieldPath: fieldPath.formattedName,
            setToServerValue: 'REQUEST_TIME',
        };
    }
}
/**
 * Sentinel value for a server timestamp.
 *
 * @private
 * @internal
 */
ServerTimestampTransform.SERVER_TIMESTAMP_SENTINEL = new ServerTimestampTransform();
/**
 * Increments a field value on the backend.
 *
 * @private
 * @internal
 */
class NumericIncrementTransform extends FieldTransform {
    constructor(operand) {
        super();
        this.operand = operand;
    }
    /**
     * Numeric transforms are omitted from document masks.
     *
     * @private
     * @internal
     */
    get includeInDocumentMask() {
        return false;
    }
    /**
     * Numeric transforms are included in document transforms.
     *
     * @private
     * @internal
     */
    get includeInDocumentTransform() {
        return true;
    }
    get methodName() {
        return 'FieldValue.increment';
    }
    validate() {
        (0, validate_1.validateNumber)('FieldValue.increment()', this.operand);
    }
    toProto(serializer, fieldPath) {
        const encodedOperand = serializer.encodeValue(this.operand);
        return { fieldPath: fieldPath.formattedName, increment: encodedOperand };
    }
    isEqual(other) {
        return (this === other ||
            (other instanceof NumericIncrementTransform &&
                this.operand === other.operand));
    }
}
/**
 * Transforms an array value via a union operation.
 *
 * @private
 * @internal
 */
class ArrayUnionTransform extends FieldTransform {
    constructor(elements) {
        super();
        this.elements = elements;
    }
    /**
     * Array transforms are omitted from document masks.
     * @private
     * @internal
     */
    get includeInDocumentMask() {
        return false;
    }
    /**
     * Array transforms are included in document transforms.
     * @private
     * @internal
     */
    get includeInDocumentTransform() {
        return true;
    }
    get methodName() {
        return 'FieldValue.arrayUnion';
    }
    validate(allowUndefined) {
        for (let i = 0; i < this.elements.length; ++i) {
            validateArrayElement(i, this.elements[i], allowUndefined);
        }
    }
    toProto(serializer, fieldPath) {
        const encodedElements = serializer.encodeValue(this.elements).arrayValue;
        return {
            fieldPath: fieldPath.formattedName,
            appendMissingElements: encodedElements,
        };
    }
    isEqual(other) {
        return (this === other ||
            (other instanceof ArrayUnionTransform &&
                deepEqual(this.elements, other.elements)));
    }
}
/**
 * Transforms an array value via a remove operation.
 *
 * @private
 * @internal
 */
class ArrayRemoveTransform extends FieldTransform {
    constructor(elements) {
        super();
        this.elements = elements;
    }
    /**
     * Array transforms are omitted from document masks.
     * @private
     * @internal
     */
    get includeInDocumentMask() {
        return false;
    }
    /**
     * Array transforms are included in document transforms.
     * @private
     * @internal
     */
    get includeInDocumentTransform() {
        return true;
    }
    get methodName() {
        return 'FieldValue.arrayRemove';
    }
    validate(allowUndefined) {
        for (let i = 0; i < this.elements.length; ++i) {
            validateArrayElement(i, this.elements[i], allowUndefined);
        }
    }
    toProto(serializer, fieldPath) {
        const encodedElements = serializer.encodeValue(this.elements).arrayValue;
        return {
            fieldPath: fieldPath.formattedName,
            removeAllFromArray: encodedElements,
        };
    }
    isEqual(other) {
        return (this === other ||
            (other instanceof ArrayRemoveTransform &&
                deepEqual(this.elements, other.elements)));
    }
}
/**
 * Validates that `value` can be used as an element inside of an array. Certain
 * field values (such as ServerTimestamps) are rejected. Nested arrays are also
 * rejected.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The value to validate.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 */
function validateArrayElement(arg, value, allowUndefined) {
    if (Array.isArray(value)) {
        throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'array element')} Nested arrays are not supported.`);
    }
    (0, serializer_1.validateUserInput)(arg, value, 'array element', 
    /*path=*/ { allowDeletes: 'none', allowTransforms: false, allowUndefined }, 
    /*path=*/ undefined, 
    /*level=*/ 0, 
    /*inArray=*/ true);
}
//# sourceMappingURL=field-value.js.map