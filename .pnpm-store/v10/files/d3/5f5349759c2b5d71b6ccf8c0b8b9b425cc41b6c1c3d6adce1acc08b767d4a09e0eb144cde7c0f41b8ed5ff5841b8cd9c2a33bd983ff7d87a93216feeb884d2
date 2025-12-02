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
exports.isWrapper = isWrapper;
exports.isWrapperDesc = isWrapperDesc;
function isWrapper(arg) {
    return isWrapperTypeName(arg.$typeName);
}
function isWrapperDesc(messageDesc) {
    const f = messageDesc.fields[0];
    return (isWrapperTypeName(messageDesc.typeName) &&
        f !== undefined &&
        f.fieldKind == "scalar" &&
        f.name == "value" &&
        f.number == 1);
}
function isWrapperTypeName(name) {
    return (name.startsWith("google.protobuf.") &&
        [
            "DoubleValue",
            "FloatValue",
            "Int64Value",
            "UInt64Value",
            "Int32Value",
            "UInt32Value",
            "BoolValue",
            "StringValue",
            "BytesValue",
        ].includes(name.substring(16)));
}
