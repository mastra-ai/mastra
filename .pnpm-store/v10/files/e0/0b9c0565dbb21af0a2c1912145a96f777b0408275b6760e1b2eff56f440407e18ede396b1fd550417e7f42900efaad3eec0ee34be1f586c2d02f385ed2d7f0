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
exports.isObject = isObject;
exports.isOneofADT = isOneofADT;
exports.isReflectList = isReflectList;
exports.isReflectMap = isReflectMap;
exports.isReflectMessage = isReflectMessage;
const unsafe_js_1 = require("./unsafe.js");
function isObject(arg) {
    return arg !== null && typeof arg == "object" && !Array.isArray(arg);
}
function isOneofADT(arg) {
    return (arg !== null &&
        typeof arg == "object" &&
        "case" in arg &&
        ((typeof arg.case == "string" && "value" in arg && arg.value != null) ||
            (arg.case === undefined &&
                (!("value" in arg) || arg.value === undefined))));
}
function isReflectList(arg, field) {
    var _a, _b, _c, _d;
    if (isObject(arg) &&
        unsafe_js_1.unsafeLocal in arg &&
        "add" in arg &&
        "field" in arg &&
        typeof arg.field == "function") {
        if (field !== undefined) {
            const a = field;
            const b = arg.field();
            return (a.listKind == b.listKind &&
                a.scalar === b.scalar &&
                ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) &&
                ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName));
        }
        return true;
    }
    return false;
}
function isReflectMap(arg, field) {
    var _a, _b, _c, _d;
    if (isObject(arg) &&
        unsafe_js_1.unsafeLocal in arg &&
        "has" in arg &&
        "field" in arg &&
        typeof arg.field == "function") {
        if (field !== undefined) {
            const a = field, b = arg.field();
            return (a.mapKey === b.mapKey &&
                a.mapKind == b.mapKind &&
                a.scalar === b.scalar &&
                ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) &&
                ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName));
        }
        return true;
    }
    return false;
}
function isReflectMessage(arg, messageDesc) {
    return (isObject(arg) &&
        unsafe_js_1.unsafeLocal in arg &&
        "desc" in arg &&
        isObject(arg.desc) &&
        arg.desc.kind === "message" &&
        (messageDesc === undefined || arg.desc.typeName == messageDesc.typeName));
}
