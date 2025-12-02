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
exports.FieldError = void 0;
exports.isFieldError = isFieldError;
const errorNames = [
    "FieldValueInvalidError",
    "FieldListRangeError",
    "ForeignFieldError",
];
class FieldError extends Error {
    constructor(fieldOrOneof, message, name = "FieldValueInvalidError") {
        super(message);
        this.name = name;
        this.field = () => fieldOrOneof;
    }
}
exports.FieldError = FieldError;
function isFieldError(arg) {
    return (arg instanceof Error &&
        errorNames.includes(arg.name) &&
        "field" in arg &&
        typeof arg.field == "function");
}
