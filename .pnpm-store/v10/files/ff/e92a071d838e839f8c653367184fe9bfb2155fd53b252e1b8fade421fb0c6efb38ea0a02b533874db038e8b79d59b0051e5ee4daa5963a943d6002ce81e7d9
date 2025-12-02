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
import { ScalarType } from "../descriptors.js";
/**
 * Return the TypeScript type (as a string) for the given scalar type.
 */
export function scalarTypeScriptType(scalar, longAsString) {
    switch (scalar) {
        case ScalarType.STRING:
            return "string";
        case ScalarType.BOOL:
            return "boolean";
        case ScalarType.UINT64:
        case ScalarType.SFIXED64:
        case ScalarType.FIXED64:
        case ScalarType.SINT64:
        case ScalarType.INT64:
            return longAsString ? "string" : "bigint";
        case ScalarType.BYTES:
            return "Uint8Array";
        default:
            return "number";
    }
}
/**
 * Return the JSON type (as a string) for the given scalar type.
 */
export function scalarJsonType(scalar) {
    switch (scalar) {
        case ScalarType.DOUBLE:
        case ScalarType.FLOAT:
            return `number | "NaN" | "Infinity" | "-Infinity"`;
        case ScalarType.UINT64:
        case ScalarType.SFIXED64:
        case ScalarType.FIXED64:
        case ScalarType.SINT64:
        case ScalarType.INT64:
            return "string";
        case ScalarType.INT32:
        case ScalarType.FIXED32:
        case ScalarType.UINT32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32:
            return "number";
        case ScalarType.STRING:
            return "string";
        case ScalarType.BOOL:
            return "boolean";
        case ScalarType.BYTES:
            return "string";
    }
}
