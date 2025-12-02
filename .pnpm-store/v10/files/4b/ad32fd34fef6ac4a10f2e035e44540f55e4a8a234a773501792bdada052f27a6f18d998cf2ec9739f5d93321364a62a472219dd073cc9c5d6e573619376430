"use strict";
// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleProtobufStructToProto3JSON = googleProtobufStructToProto3JSON;
exports.googleProtobufListValueToProto3JSON = googleProtobufListValueToProto3JSON;
exports.googleProtobufValueToProto3JSON = googleProtobufValueToProto3JSON;
exports.googleProtobufStructFromProto3JSON = googleProtobufStructFromProto3JSON;
exports.googleProtobufListValueFromProto3JSON = googleProtobufListValueFromProto3JSON;
exports.googleProtobufValueFromProto3JSON = googleProtobufValueFromProto3JSON;
const util_1 = require("./util");
function googleProtobufStructToProto3JSON(obj) {
    const result = {};
    const fields = obj.fields;
    for (const [key, value] of Object.entries(fields)) {
        result[key] = googleProtobufValueToProto3JSON(value);
    }
    return result;
}
function googleProtobufListValueToProto3JSON(obj) {
    (0, util_1.assert)(Array.isArray(obj.values), 'ListValue internal representation must contain array of values');
    return obj.values.map(googleProtobufValueToProto3JSON);
}
function googleProtobufValueToProto3JSON(obj) {
    if (Object.prototype.hasOwnProperty.call(obj, 'nullValue')) {
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'numberValue') &&
        typeof obj.numberValue === 'number') {
        if (!Number.isFinite(obj.numberValue)) {
            return obj.numberValue.toString();
        }
        return obj.numberValue;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'stringValue') &&
        typeof obj.stringValue === 'string') {
        return obj.stringValue;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'boolValue') &&
        typeof obj.boolValue === 'boolean') {
        return obj.boolValue;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'structValue') &&
        typeof obj.structValue === 'object') {
        return googleProtobufStructToProto3JSON(obj.structValue);
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'listValue') &&
        typeof obj === 'object' &&
        typeof obj.listValue === 'object') {
        return googleProtobufListValueToProto3JSON(obj.listValue);
    }
    // Assuming empty Value to be null
    return null;
}
function googleProtobufStructFromProto3JSON(json) {
    const fields = {};
    for (const [key, value] of Object.entries(json)) {
        fields[key] = googleProtobufValueFromProto3JSON(value);
    }
    return { fields };
}
function googleProtobufListValueFromProto3JSON(json) {
    return {
        values: json.map(element => googleProtobufValueFromProto3JSON(element)),
    };
}
function googleProtobufValueFromProto3JSON(json) {
    if (json === null) {
        return { nullValue: 'NULL_VALUE' };
    }
    if (typeof json === 'number') {
        return { numberValue: json };
    }
    if (typeof json === 'string') {
        return { stringValue: json };
    }
    if (typeof json === 'boolean') {
        return { boolValue: json };
    }
    if (Array.isArray(json)) {
        return {
            listValue: googleProtobufListValueFromProto3JSON(json),
        };
    }
    if (typeof json === 'object') {
        return {
            structValue: googleProtobufStructFromProto3JSON(json),
        };
    }
    throw new Error(`googleProtobufValueFromProto3JSON: incorrect parameter type: ${typeof json}`);
}
//# sourceMappingURL=value.js.map