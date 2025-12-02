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
exports.Serializer = void 0;
exports.validateUserInput = validateUserInput;
const field_value_1 = require("./field-value");
const convert_1 = require("./convert");
const geo_point_1 = require("./geo-point");
const index_1 = require("./index");
const path_1 = require("./path");
const timestamp_1 = require("./timestamp");
const util_1 = require("./util");
const validate_1 = require("./validate");
const map_type_1 = require("./map-type");
/**
 * The maximum depth of a Firestore object.
 *
 * @private
 * @internal
 */
const MAX_DEPTH = 20;
/**
 * Serializer that is used to convert between JavaScript types and their
 * Firestore Protobuf representation.
 *
 * @private
 * @internal
 */
class Serializer {
    constructor(firestore) {
        // Instead of storing the `firestore` object, we store just a reference to
        // its `.doc()` method. This avoid a circular reference, which breaks
        // JSON.stringify().
        this.createReference = path => firestore.doc(path);
        this.createInteger = n => firestore._settings.useBigInt ? BigInt(n) : Number(n);
        this.allowUndefined = !!firestore._settings.ignoreUndefinedProperties;
    }
    /**
     * Encodes a JavaScript object into the Firestore 'Fields' representation.
     *
     * @private
     * @internal
     * @param obj The object to encode.
     * @returns The Firestore 'Fields' representation
     */
    encodeFields(obj) {
        const fields = {};
        for (const prop of Object.keys(obj)) {
            const val = this.encodeValue(obj[prop]);
            if (val) {
                fields[prop] = val;
            }
        }
        return fields;
    }
    /**
     * Encodes a JavaScript value into the Firestore 'Value' representation.
     *
     * @private
     * @internal
     * @param val The object to encode
     * @returns The Firestore Proto or null if we are deleting a field.
     */
    encodeValue(val) {
        if (val instanceof field_value_1.FieldTransform) {
            return null;
        }
        if (typeof val === 'string') {
            return {
                stringValue: val,
            };
        }
        if (typeof val === 'boolean') {
            return {
                booleanValue: val,
            };
        }
        if (typeof val === 'number') {
            const isNegativeZero = val === 0 && 1 / val === 1 / -0;
            if (Number.isSafeInteger(val) && !isNegativeZero) {
                return {
                    integerValue: val,
                };
            }
            else {
                return {
                    doubleValue: val,
                };
            }
        }
        if (typeof val === 'bigint') {
            return {
                integerValue: val.toString(),
            };
        }
        if (val instanceof Date) {
            const timestamp = timestamp_1.Timestamp.fromDate(val);
            return {
                timestampValue: {
                    seconds: timestamp.seconds,
                    nanos: timestamp.nanoseconds,
                },
            };
        }
        if (isMomentJsType(val)) {
            const timestamp = timestamp_1.Timestamp.fromDate(val.toDate());
            return {
                timestampValue: {
                    seconds: timestamp.seconds,
                    nanos: timestamp.nanoseconds,
                },
            };
        }
        if (val === null) {
            return {
                nullValue: 'NULL_VALUE',
            };
        }
        if (val instanceof Buffer || val instanceof Uint8Array) {
            return {
                bytesValue: val,
            };
        }
        if (val instanceof field_value_1.VectorValue) {
            return val._toProto(this);
        }
        if ((0, util_1.isObject)(val)) {
            const toProto = val['toProto'];
            if (typeof toProto === 'function') {
                return toProto.bind(val)();
            }
        }
        if (Array.isArray(val)) {
            const array = {
                arrayValue: {},
            };
            if (val.length > 0) {
                array.arrayValue.values = [];
                for (let i = 0; i < val.length; ++i) {
                    const enc = this.encodeValue(val[i]);
                    if (enc) {
                        array.arrayValue.values.push(enc);
                    }
                }
            }
            return array;
        }
        if (typeof val === 'object' && (0, util_1.isPlainObject)(val)) {
            const map = {
                mapValue: {},
            };
            // If we encounter an empty object, we always need to send it to make sure
            // the server creates a map entry.
            if (!(0, util_1.isEmpty)(val)) {
                map.mapValue.fields = this.encodeFields(val);
                if ((0, util_1.isEmpty)(map.mapValue.fields)) {
                    return null;
                }
            }
            return map;
        }
        if (val === undefined && this.allowUndefined) {
            return null;
        }
        throw new Error(`Cannot encode value: ${val}`);
    }
    /**
     * @private
     */
    encodeVector(rawVector) {
        // A Firestore Vector is a map with reserved key/value pairs.
        return {
            mapValue: {
                fields: {
                    [map_type_1.RESERVED_MAP_KEY]: {
                        stringValue: map_type_1.RESERVED_MAP_KEY_VECTOR_VALUE,
                    },
                    [map_type_1.VECTOR_MAP_VECTORS_KEY]: {
                        arrayValue: {
                            values: rawVector.map(value => {
                                return {
                                    doubleValue: value,
                                };
                            }),
                        },
                    },
                },
            },
        };
    }
    /**
     * Decodes a single Firestore 'Value' Protobuf.
     *
     * @private
     * @internal
     * @param proto A Firestore 'Value' Protobuf.
     * @returns The converted JS type.
     */
    decodeValue(proto) {
        const valueType = (0, convert_1.detectValueType)(proto);
        switch (valueType) {
            case 'stringValue': {
                return proto.stringValue;
            }
            case 'booleanValue': {
                return proto.booleanValue;
            }
            case 'integerValue': {
                return this.createInteger(proto.integerValue);
            }
            case 'doubleValue': {
                return proto.doubleValue;
            }
            case 'timestampValue': {
                return timestamp_1.Timestamp.fromProto(proto.timestampValue);
            }
            case 'referenceValue': {
                const resourcePath = path_1.QualifiedResourcePath.fromSlashSeparatedString(proto.referenceValue);
                return this.createReference(resourcePath.relativeName);
            }
            case 'arrayValue': {
                const array = [];
                if (Array.isArray(proto.arrayValue.values)) {
                    for (const value of proto.arrayValue.values) {
                        array.push(this.decodeValue(value));
                    }
                }
                return array;
            }
            case 'nullValue': {
                return null;
            }
            case 'mapValue': {
                const fields = proto.mapValue.fields;
                if (fields) {
                    const obj = {};
                    for (const prop of Object.keys(fields)) {
                        obj[prop] = this.decodeValue(fields[prop]);
                    }
                    return obj;
                }
                else {
                    return {};
                }
            }
            case 'vectorValue': {
                const fields = proto.mapValue.fields;
                return field_value_1.VectorValue._fromProto(fields[map_type_1.VECTOR_MAP_VECTORS_KEY]);
            }
            case 'geoPointValue': {
                return geo_point_1.GeoPoint.fromProto(proto.geoPointValue);
            }
            case 'bytesValue': {
                return proto.bytesValue;
            }
            default: {
                throw new Error('Cannot decode type from Firestore Value: ' + JSON.stringify(proto));
            }
        }
    }
    /**
     * Decodes a google.protobuf.Value
     *
     * @private
     * @internal
     * @param proto A Google Protobuf 'Value'.
     * @returns The converted JS type.
     */
    decodeGoogleProtobufValue(proto) {
        switch ((0, convert_1.detectGoogleProtobufValueType)(proto)) {
            case 'nullValue': {
                return null;
            }
            case 'numberValue': {
                return proto.numberValue;
            }
            case 'stringValue': {
                return proto.stringValue;
            }
            case 'boolValue': {
                return proto.boolValue;
            }
            case 'listValue': {
                return this.decodeGoogleProtobufList(proto.listValue);
            }
            case 'structValue': {
                return this.decodeGoogleProtobufStruct(proto.structValue);
            }
            default: {
                throw new Error('Cannot decode type from google.protobuf.Value: ' +
                    JSON.stringify(proto));
            }
        }
    }
    /**
     * Decodes a google.protobuf.ListValue
     *
     * @private
     * @internal
     * @param proto A Google Protobuf 'ListValue'.
     * @returns The converted JS type.
     */
    decodeGoogleProtobufList(proto) {
        const result = [];
        if (proto && proto.values && Array.isArray(proto.values)) {
            for (const value of proto.values) {
                result.push(this.decodeGoogleProtobufValue(value));
            }
        }
        return result;
    }
    /**
     * Decodes a google.protobuf.Struct
     *
     * @private
     * @internal
     * @param proto A Google Protobuf 'Struct'.
     * @returns The converted JS type.
     */
    decodeGoogleProtobufStruct(proto) {
        const result = {};
        if (proto && proto.fields) {
            for (const prop of Object.keys(proto.fields)) {
                result[prop] = this.decodeGoogleProtobufValue(proto.fields[prop]);
            }
        }
        return result;
    }
}
exports.Serializer = Serializer;
/**
 * Validates a JavaScript value for usage as a Firestore value.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value JavaScript value to validate.
 * @param desc A description of the expected type.
 * @param path The field path to validate.
 * @param options Validation options
 * @param level The current depth of the traversal. This is used to decide
 * whether undefined values or deletes are allowed.
 * @param inArray Whether we are inside an array.
 * @throws when the object is invalid.
 */
function validateUserInput(arg, value, desc, options, path, level, inArray) {
    if (path && path.size - 1 > MAX_DEPTH) {
        throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} Input object is deeper than ${MAX_DEPTH} levels or contains a cycle.`);
    }
    level = level || 0;
    inArray = inArray || false;
    const fieldPathMessage = path ? ` (found in field "${path}")` : '';
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; ++i) {
            validateUserInput(arg, value[i], desc, options, path ? path.append(String(i)) : new path_1.FieldPath(String(i)), level + 1, 
            /* inArray= */ true);
        }
    }
    else if ((0, util_1.isPlainObject)(value)) {
        for (const prop of Object.keys(value)) {
            validateUserInput(arg, value[prop], desc, options, path ? path.append(new path_1.FieldPath(prop)) : new path_1.FieldPath(prop), level + 1, inArray);
        }
    }
    else if (value === undefined) {
        if (options.allowUndefined && level === 0) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} "undefined" values are only ignored inside of objects.`);
        }
        else if (!options.allowUndefined) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} Cannot use "undefined" as a Firestore value${fieldPathMessage}. ` +
                'If you want to ignore undefined values, enable `ignoreUndefinedProperties`.');
        }
    }
    else if (value instanceof field_value_1.VectorValue) {
        // OK
    }
    else if (value instanceof field_value_1.DeleteTransform) {
        if (inArray) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} ${value.methodName}() cannot be used inside of an array${fieldPathMessage}.`);
        }
        else if (options.allowDeletes === 'none') {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} ${value.methodName}() must appear at the top-level and can only be used in update() ` +
                `or set() with {merge:true}${fieldPathMessage}.`);
        }
        else if (options.allowDeletes === 'root') {
            if (level === 0) {
                // Ok (update() with UpdateData).
            }
            else if (level === 1 && (path === null || path === void 0 ? void 0 : path.size) === 1) {
                // Ok (update with varargs).
            }
            else {
                throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} ${value.methodName}() must appear at the top-level and can only be used in update() ` +
                    `or set() with {merge:true}${fieldPathMessage}.`);
            }
        }
    }
    else if (value instanceof field_value_1.FieldTransform) {
        if (inArray) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} ${value.methodName}() cannot be used inside of an array${fieldPathMessage}.`);
        }
        else if (!options.allowTransforms) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} ${value.methodName}() can only be used in set(), create() or update()${fieldPathMessage}.`);
        }
    }
    else if (value instanceof path_1.FieldPath) {
        throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, desc)} Cannot use object of type "FieldPath" as a Firestore value${fieldPathMessage}.`);
    }
    else if (value instanceof index_1.DocumentReference) {
        // Ok.
    }
    else if (value instanceof geo_point_1.GeoPoint) {
        // Ok.
    }
    else if (value instanceof timestamp_1.Timestamp || value instanceof Date) {
        // Ok.
    }
    else if (isMomentJsType(value)) {
        // Ok.
    }
    else if (value instanceof Buffer || value instanceof Uint8Array) {
        // Ok.
    }
    else if (value === null) {
        // Ok.
    }
    else if (typeof value === 'object') {
        throw new Error((0, validate_1.customObjectMessage)(arg, value, path));
    }
}
/**
 * Returns true if value is a MomentJs date object.
 * @private
 * @internal
 */
function isMomentJsType(value) {
    return (typeof value === 'object' &&
        value !== null &&
        value.constructor &&
        value.constructor.name === 'Moment' &&
        typeof value.toDate === 'function');
}
//# sourceMappingURL=serializer.js.map