"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFieldSet = isFieldSet;
exports.clearField = clearField;
const unsafe_js_1 = require("./reflect/unsafe.js");
/**
 * Returns true if the field is set.
 *
 * - Scalar and enum fields with implicit presence (proto3):
 *   Set if not a zero value.
 *
 * - Scalar and enum fields with explicit presence (proto2, oneof):
 *   Set if a value was set when creating or parsing the message, or when a
 *   value was assigned to the field's property.
 *
 * - Message fields:
 *   Set if the property is not undefined.
 *
 * - List and map fields:
 *   Set if not empty.
 */
function isFieldSet(message, field) {
    return (field.parent.typeName == message.$typeName && (0, unsafe_js_1.unsafeIsSet)(message, field));
}
/**
 * Resets the field, so that isFieldSet() will return false.
 */
function clearField(message, field) {
    if (field.parent.typeName == message.$typeName) {
        (0, unsafe_js_1.unsafeClear)(message, field);
    }
}
