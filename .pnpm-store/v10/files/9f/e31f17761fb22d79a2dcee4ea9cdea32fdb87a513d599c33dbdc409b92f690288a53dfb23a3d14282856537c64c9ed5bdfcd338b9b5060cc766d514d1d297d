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
exports.timestampFromJson = timestampFromJson;
exports.detectValueType = detectValueType;
exports.detectGoogleProtobufValueType = detectGoogleProtobufValueType;
exports.valueFromJson = valueFromJson;
exports.fieldsFromJson = fieldsFromJson;
const validate_1 = require("./validate");
const map_type_1 = require("./map-type");
/*!
 * @module firestore/convert
 * @private
 * @internal
 *
 * This module contains utility functions to convert
 * `firestore.v1.Documents` from Proto3 JSON to their equivalent
 * representation in Protobuf JS. Protobuf JS is the only encoding supported by
 * this client, and dependencies that use Proto3 JSON (such as the Google Cloud
 * Functions SDK) are supported through this conversion and its usage in
 * {@see Firestore#snapshot_}.
 */
/**
 * Converts an ISO 8601 or google.protobuf.Timestamp proto into Protobuf JS.
 *
 * @private
 * @internal
 * @param timestampValue The value to convert.
 * @param argumentName The argument name to use in the error message if the
 * conversion fails. If omitted, 'timestampValue' is used.
 * @return The value as expected by Protobuf JS or undefined if no input was
 * provided.
 */
function timestampFromJson(timestampValue, argumentName) {
    let timestampProto = {};
    if (typeof timestampValue === 'string') {
        const date = new Date(timestampValue);
        const seconds = Math.floor(date.getTime() / 1000);
        let nanos = 0;
        if (timestampValue.length > 20) {
            const nanoString = timestampValue.substring(20, timestampValue.length - 1);
            const trailingZeroes = 9 - nanoString.length;
            nanos = Number(nanoString) * Math.pow(10, trailingZeroes);
        }
        if (isNaN(seconds) || isNaN(nanos)) {
            argumentName = argumentName || 'timestampValue';
            throw new Error(`Specify a valid ISO 8601 timestamp for "${argumentName}".`);
        }
        timestampProto = {
            seconds: seconds || undefined,
            nanos: nanos || undefined,
        };
    }
    else if (timestampValue !== undefined) {
        (0, validate_1.validateObject)('timestampValue', timestampValue);
        timestampProto = {
            seconds: timestampValue.seconds || undefined,
            nanos: timestampValue.nanos || undefined,
        };
    }
    return timestampProto;
}
/**
 * Converts a Proto3 JSON 'bytesValue' field into Protobuf JS.
 *
 * @private
 * @internal
 * @param bytesValue The value to convert.
 * @return The value as expected by Protobuf JS.
 */
function bytesFromJson(bytesValue) {
    if (typeof bytesValue === 'string') {
        return Buffer.from(bytesValue, 'base64');
    }
    else {
        return bytesValue;
    }
}
/**
 * Detects 'valueType' from a Proto3 JSON `firestore.v1.Value` proto.
 *
 * @private
 * @internal
 * @param proto The `firestore.v1.Value` proto.
 * @return The string value for 'valueType'.
 */
function detectValueType(proto) {
    var _a;
    let valueType;
    if (proto.valueType) {
        valueType = proto.valueType;
    }
    else {
        const detectedValues = [];
        if (proto.stringValue !== undefined) {
            detectedValues.push('stringValue');
        }
        if (proto.booleanValue !== undefined) {
            detectedValues.push('booleanValue');
        }
        if (proto.integerValue !== undefined) {
            detectedValues.push('integerValue');
        }
        if (proto.doubleValue !== undefined) {
            detectedValues.push('doubleValue');
        }
        if (proto.timestampValue !== undefined) {
            detectedValues.push('timestampValue');
        }
        if (proto.referenceValue !== undefined) {
            detectedValues.push('referenceValue');
        }
        if (proto.arrayValue !== undefined) {
            detectedValues.push('arrayValue');
        }
        if (proto.nullValue !== undefined) {
            detectedValues.push('nullValue');
        }
        if (proto.mapValue !== undefined) {
            detectedValues.push('mapValue');
        }
        if (proto.geoPointValue !== undefined) {
            detectedValues.push('geoPointValue');
        }
        if (proto.bytesValue !== undefined) {
            detectedValues.push('bytesValue');
        }
        if (detectedValues.length !== 1) {
            throw new Error(`Unable to infer type value from '${JSON.stringify(proto)}'.`);
        }
        valueType = detectedValues[0];
    }
    // Special handling of mapValues used to represent other data types
    if (valueType === 'mapValue') {
        const fields = (_a = proto.mapValue) === null || _a === void 0 ? void 0 : _a.fields;
        if (fields) {
            const props = Object.keys(fields);
            if (props.indexOf(map_type_1.RESERVED_MAP_KEY) !== -1 &&
                detectValueType(fields[map_type_1.RESERVED_MAP_KEY]) === 'stringValue' &&
                fields[map_type_1.RESERVED_MAP_KEY].stringValue === map_type_1.RESERVED_MAP_KEY_VECTOR_VALUE) {
                valueType = 'vectorValue';
            }
        }
    }
    return valueType;
}
/**
 * Detects the value kind from a Proto3 JSON `google.protobuf.Value` proto.
 *
 * @private
 * @internal
 * @param proto The `firestore.v1.Value` proto.
 * @return The string value for 'valueType'.
 */
function detectGoogleProtobufValueType(proto) {
    const detectedValues = [];
    if (proto.nullValue !== undefined) {
        detectedValues.push('nullValue');
    }
    if (proto.numberValue !== undefined) {
        detectedValues.push('numberValue');
    }
    if (proto.stringValue !== undefined) {
        detectedValues.push('stringValue');
    }
    if (proto.boolValue !== undefined) {
        detectedValues.push('boolValue');
    }
    if (proto.structValue !== undefined) {
        detectedValues.push('structValue');
    }
    if (proto.listValue !== undefined) {
        detectedValues.push('listValue');
    }
    if (detectedValues.length !== 1) {
        throw new Error(`Unable to infer type value from '${JSON.stringify(proto)}'.`);
    }
    return detectedValues[0];
}
/**
 * Converts a `firestore.v1.Value` in Proto3 JSON encoding into the
 * Protobuf JS format expected by this client.
 *
 * @private
 * @internal
 * @param fieldValue The `firestore.v1.Value` in Proto3 JSON format.
 * @return The `firestore.v1.Value` in Protobuf JS format.
 */
function valueFromJson(fieldValue) {
    const valueType = detectValueType(fieldValue);
    switch (valueType) {
        case 'timestampValue':
            return {
                timestampValue: timestampFromJson(fieldValue.timestampValue),
            };
        case 'bytesValue':
            return {
                bytesValue: bytesFromJson(fieldValue.bytesValue),
            };
        case 'doubleValue':
            return {
                doubleValue: Number(fieldValue.doubleValue),
            };
        case 'arrayValue': {
            const arrayValue = [];
            if (Array.isArray(fieldValue.arrayValue.values)) {
                for (const value of fieldValue.arrayValue.values) {
                    arrayValue.push(valueFromJson(value));
                }
            }
            return {
                arrayValue: {
                    values: arrayValue,
                },
            };
        }
        case 'mapValue':
        case 'vectorValue': {
            const mapValue = {};
            const fields = fieldValue.mapValue.fields;
            if (fields) {
                for (const prop of Object.keys(fields)) {
                    mapValue[prop] = valueFromJson(fieldValue.mapValue.fields[prop]);
                }
            }
            return {
                mapValue: {
                    fields: mapValue,
                },
            };
        }
        default:
            return fieldValue;
    }
}
/**
 * Converts a map of IValues in Proto3 JSON encoding into the Protobuf JS format
 * expected by this client. This conversion creates a copy of the underlying
 * fields.
 *
 * @private
 * @internal
 * @param document An object with IValues in Proto3 JSON format.
 * @return The object in Protobuf JS format.
 */
function fieldsFromJson(document) {
    const result = {};
    for (const prop of Object.keys(document)) {
        result[prop] = valueFromJson(document[prop]);
    }
    return result;
}
//# sourceMappingURL=convert.js.map