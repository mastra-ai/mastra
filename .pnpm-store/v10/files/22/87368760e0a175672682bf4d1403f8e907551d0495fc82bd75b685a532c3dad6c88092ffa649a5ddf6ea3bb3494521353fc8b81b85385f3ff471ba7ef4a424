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
exports.reflect = reflect;
exports.reflectList = reflectList;
exports.reflectMap = reflectMap;
const descriptors_js_1 = require("../descriptors.js");
const reflect_check_js_1 = require("./reflect-check.js");
const error_js_1 = require("./error.js");
const unsafe_js_1 = require("./unsafe.js");
const create_js_1 = require("../create.js");
const wrappers_js_1 = require("../wkt/wrappers.js");
const scalar_js_1 = require("./scalar.js");
const proto_int64_js_1 = require("../proto-int64.js");
const guard_js_1 = require("./guard.js");
/**
 * Create a ReflectMessage.
 */
function reflect(messageDesc, message, 
/**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */
check = true) {
    return new ReflectMessageImpl(messageDesc, message, check);
}
const messageSortedFields = new WeakMap();
class ReflectMessageImpl {
    get sortedFields() {
        const cached = messageSortedFields.get(this.desc);
        if (cached) {
            return cached;
        }
        const sortedFields = this.desc.fields
            .concat()
            .sort((a, b) => a.number - b.number);
        messageSortedFields.set(this.desc, sortedFields);
        return sortedFields;
    }
    constructor(messageDesc, message, check = true) {
        this.lists = new Map();
        this.maps = new Map();
        this.check = check;
        this.desc = messageDesc;
        this.message = this[unsafe_js_1.unsafeLocal] = message !== null && message !== void 0 ? message : (0, create_js_1.create)(messageDesc);
        this.fields = messageDesc.fields;
        this.oneofs = messageDesc.oneofs;
        this.members = messageDesc.members;
    }
    findNumber(number) {
        if (!this._fieldsByNumber) {
            this._fieldsByNumber = new Map(this.desc.fields.map((f) => [f.number, f]));
        }
        return this._fieldsByNumber.get(number);
    }
    oneofCase(oneof) {
        assertOwn(this.message, oneof);
        return (0, unsafe_js_1.unsafeOneofCase)(this.message, oneof);
    }
    isSet(field) {
        assertOwn(this.message, field);
        return (0, unsafe_js_1.unsafeIsSet)(this.message, field);
    }
    clear(field) {
        assertOwn(this.message, field);
        (0, unsafe_js_1.unsafeClear)(this.message, field);
    }
    get(field) {
        assertOwn(this.message, field);
        const value = (0, unsafe_js_1.unsafeGet)(this.message, field);
        switch (field.fieldKind) {
            case "list":
                // eslint-disable-next-line no-case-declarations
                let list = this.lists.get(field);
                if (!list || list[unsafe_js_1.unsafeLocal] !== value) {
                    this.lists.set(field, 
                    // biome-ignore lint/suspicious/noAssignInExpressions: no
                    (list = new ReflectListImpl(field, value, this.check)));
                }
                return list;
            case "map":
                let map = this.maps.get(field);
                if (!map || map[unsafe_js_1.unsafeLocal] !== value) {
                    this.maps.set(field, 
                    // biome-ignore lint/suspicious/noAssignInExpressions: no
                    (map = new ReflectMapImpl(field, value, this.check)));
                }
                return map;
            case "message":
                return messageToReflect(field, value, this.check);
            case "scalar":
                return (value === undefined
                    ? (0, scalar_js_1.scalarZeroValue)(field.scalar, false)
                    : longToReflect(field, value));
            case "enum":
                return (value !== null && value !== void 0 ? value : field.enum.values[0].number);
        }
    }
    set(field, value) {
        assertOwn(this.message, field);
        if (this.check) {
            const err = (0, reflect_check_js_1.checkField)(field, value);
            if (err) {
                throw err;
            }
        }
        let local;
        if (field.fieldKind == "message") {
            local = messageToLocal(field, value);
        }
        else if ((0, guard_js_1.isReflectMap)(value) || (0, guard_js_1.isReflectList)(value)) {
            local = value[unsafe_js_1.unsafeLocal];
        }
        else {
            local = longToLocal(field, value);
        }
        (0, unsafe_js_1.unsafeSet)(this.message, field, local);
    }
    getUnknown() {
        return this.message.$unknown;
    }
    setUnknown(value) {
        this.message.$unknown = value;
    }
}
function assertOwn(owner, member) {
    if (member.parent.typeName !== owner.$typeName) {
        throw new error_js_1.FieldError(member, `cannot use ${member.toString()} with message ${owner.$typeName}`, "ForeignFieldError");
    }
}
/**
 * Create a ReflectList.
 */
function reflectList(field, unsafeInput, 
/**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */
check = true) {
    return new ReflectListImpl(field, unsafeInput !== null && unsafeInput !== void 0 ? unsafeInput : [], check);
}
class ReflectListImpl {
    field() {
        return this._field;
    }
    get size() {
        return this._arr.length;
    }
    constructor(field, unsafeInput, check) {
        this._field = field;
        this._arr = this[unsafe_js_1.unsafeLocal] = unsafeInput;
        this.check = check;
    }
    get(index) {
        const item = this._arr[index];
        return item === undefined
            ? undefined
            : listItemToReflect(this._field, item, this.check);
    }
    set(index, item) {
        if (index < 0 || index >= this._arr.length) {
            throw new error_js_1.FieldError(this._field, `list item #${index + 1}: out of range`);
        }
        if (this.check) {
            const err = (0, reflect_check_js_1.checkListItem)(this._field, index, item);
            if (err) {
                throw err;
            }
        }
        this._arr[index] = listItemToLocal(this._field, item);
    }
    add(item) {
        if (this.check) {
            const err = (0, reflect_check_js_1.checkListItem)(this._field, this._arr.length, item);
            if (err) {
                throw err;
            }
        }
        this._arr.push(listItemToLocal(this._field, item));
        return undefined;
    }
    clear() {
        this._arr.splice(0, this._arr.length);
    }
    [Symbol.iterator]() {
        return this.values();
    }
    keys() {
        return this._arr.keys();
    }
    *values() {
        for (const item of this._arr) {
            yield listItemToReflect(this._field, item, this.check);
        }
    }
    *entries() {
        for (let i = 0; i < this._arr.length; i++) {
            yield [i, listItemToReflect(this._field, this._arr[i], this.check)];
        }
    }
}
/**
 * Create a ReflectMap.
 */
function reflectMap(field, unsafeInput, 
/**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */
check = true) {
    return new ReflectMapImpl(field, unsafeInput, check);
}
class ReflectMapImpl {
    constructor(field, unsafeInput, check = true) {
        this.obj = this[unsafe_js_1.unsafeLocal] = unsafeInput !== null && unsafeInput !== void 0 ? unsafeInput : {};
        this.check = check;
        this._field = field;
    }
    field() {
        return this._field;
    }
    set(key, value) {
        if (this.check) {
            const err = (0, reflect_check_js_1.checkMapEntry)(this._field, key, value);
            if (err) {
                throw err;
            }
        }
        this.obj[mapKeyToLocal(key)] = mapValueToLocal(this._field, value);
        return this;
    }
    delete(key) {
        const k = mapKeyToLocal(key);
        const has = Object.prototype.hasOwnProperty.call(this.obj, k);
        if (has) {
            delete this.obj[k];
        }
        return has;
    }
    clear() {
        for (const key of Object.keys(this.obj)) {
            delete this.obj[key];
        }
    }
    get(key) {
        let val = this.obj[mapKeyToLocal(key)];
        if (val !== undefined) {
            val = mapValueToReflect(this._field, val, this.check);
        }
        return val;
    }
    has(key) {
        return Object.prototype.hasOwnProperty.call(this.obj, mapKeyToLocal(key));
    }
    *keys() {
        for (const objKey of Object.keys(this.obj)) {
            yield mapKeyToReflect(objKey, this._field.mapKey);
        }
    }
    *entries() {
        for (const objEntry of Object.entries(this.obj)) {
            yield [
                mapKeyToReflect(objEntry[0], this._field.mapKey),
                mapValueToReflect(this._field, objEntry[1], this.check),
            ];
        }
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    get size() {
        return Object.keys(this.obj).length;
    }
    *values() {
        for (const val of Object.values(this.obj)) {
            yield mapValueToReflect(this._field, val, this.check);
        }
    }
    forEach(callbackfn, thisArg) {
        for (const mapEntry of this.entries()) {
            callbackfn.call(thisArg, mapEntry[1], mapEntry[0], this);
        }
    }
}
function messageToLocal(field, value) {
    if (!(0, guard_js_1.isReflectMessage)(value)) {
        return value;
    }
    if ((0, wrappers_js_1.isWrapper)(value.message) &&
        !field.oneof &&
        field.fieldKind == "message") {
        // Types from google/protobuf/wrappers.proto are unwrapped when used in
        // a singular field that is not part of a oneof group.
        return value.message.value;
    }
    if (value.desc.typeName == "google.protobuf.Struct" &&
        field.parent.typeName != "google.protobuf.Value") {
        // google.protobuf.Struct is represented with JsonObject when used in a
        // field, except when used in google.protobuf.Value.
        return wktStructToLocal(value.message);
    }
    return value.message;
}
function messageToReflect(field, value, check) {
    if (value !== undefined) {
        if ((0, wrappers_js_1.isWrapperDesc)(field.message) &&
            !field.oneof &&
            field.fieldKind == "message") {
            // Types from google/protobuf/wrappers.proto are unwrapped when used in
            // a singular field that is not part of a oneof group.
            value = {
                $typeName: field.message.typeName,
                value: longToReflect(field.message.fields[0], value),
            };
        }
        else if (field.message.typeName == "google.protobuf.Struct" &&
            field.parent.typeName != "google.protobuf.Value" &&
            (0, guard_js_1.isObject)(value)) {
            // google.protobuf.Struct is represented with JsonObject when used in a
            // field, except when used in google.protobuf.Value.
            value = wktStructToReflect(value);
        }
    }
    return new ReflectMessageImpl(field.message, value, check);
}
function listItemToLocal(field, value) {
    if (field.listKind == "message") {
        return messageToLocal(field, value);
    }
    return longToLocal(field, value);
}
function listItemToReflect(field, value, check) {
    if (field.listKind == "message") {
        return messageToReflect(field, value, check);
    }
    return longToReflect(field, value);
}
function mapValueToLocal(field, value) {
    if (field.mapKind == "message") {
        return messageToLocal(field, value);
    }
    return longToLocal(field, value);
}
function mapValueToReflect(field, value, check) {
    if (field.mapKind == "message") {
        return messageToReflect(field, value, check);
    }
    return value;
}
function mapKeyToLocal(key) {
    return typeof key == "string" || typeof key == "number" ? key : String(key);
}
/**
 * Converts a map key (any scalar value except float, double, or bytes) from its
 * representation in a message (string or number, the only possible object key
 * types) to the closest possible type in ECMAScript.
 */
function mapKeyToReflect(key, type) {
    switch (type) {
        case descriptors_js_1.ScalarType.STRING:
            return key;
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32: {
            const n = Number.parseInt(key);
            if (Number.isFinite(n)) {
                return n;
            }
            break;
        }
        case descriptors_js_1.ScalarType.BOOL:
            switch (key) {
                case "true":
                    return true;
                case "false":
                    return false;
            }
            break;
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
            try {
                return proto_int64_js_1.protoInt64.uParse(key);
            }
            catch (_a) {
                //
            }
            break;
        default:
            // INT64, SFIXED64, SINT64
            try {
                return proto_int64_js_1.protoInt64.parse(key);
            }
            catch (_b) {
                //
            }
            break;
    }
    return key;
}
function longToReflect(field, value) {
    switch (field.scalar) {
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
            if ("longAsString" in field &&
                field.longAsString &&
                typeof value == "string") {
                value = proto_int64_js_1.protoInt64.parse(value);
            }
            break;
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
            if ("longAsString" in field &&
                field.longAsString &&
                typeof value == "string") {
                value = proto_int64_js_1.protoInt64.uParse(value);
            }
            break;
    }
    return value;
}
function longToLocal(field, value) {
    switch (field.scalar) {
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
            if ("longAsString" in field && field.longAsString) {
                value = String(value);
            }
            else if (typeof value == "string" || typeof value == "number") {
                value = proto_int64_js_1.protoInt64.parse(value);
            }
            break;
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
            if ("longAsString" in field && field.longAsString) {
                value = String(value);
            }
            else if (typeof value == "string" || typeof value == "number") {
                value = proto_int64_js_1.protoInt64.uParse(value);
            }
            break;
    }
    return value;
}
function wktStructToReflect(json) {
    const struct = {
        $typeName: "google.protobuf.Struct",
        fields: {},
    };
    if ((0, guard_js_1.isObject)(json)) {
        for (const [k, v] of Object.entries(json)) {
            struct.fields[k] = wktValueToReflect(v);
        }
    }
    return struct;
}
function wktStructToLocal(val) {
    const json = {};
    for (const [k, v] of Object.entries(val.fields)) {
        json[k] = wktValueToLocal(v);
    }
    return json;
}
function wktValueToLocal(val) {
    switch (val.kind.case) {
        case "structValue":
            return wktStructToLocal(val.kind.value);
        case "listValue":
            return val.kind.value.values.map(wktValueToLocal);
        case "nullValue":
        case undefined:
            return null;
        default:
            return val.kind.value;
    }
}
function wktValueToReflect(json) {
    const value = {
        $typeName: "google.protobuf.Value",
        kind: { case: undefined },
    };
    switch (typeof json) {
        case "number":
            value.kind = { case: "numberValue", value: json };
            break;
        case "string":
            value.kind = { case: "stringValue", value: json };
            break;
        case "boolean":
            value.kind = { case: "boolValue", value: json };
            break;
        case "object":
            if (json === null) {
                const nullValue = 0;
                value.kind = { case: "nullValue", value: nullValue };
            }
            else if (Array.isArray(json)) {
                const listValue = {
                    $typeName: "google.protobuf.ListValue",
                    values: [],
                };
                if (Array.isArray(json)) {
                    for (const e of json) {
                        listValue.values.push(wktValueToReflect(e));
                    }
                }
                value.kind = {
                    case: "listValue",
                    value: listValue,
                };
            }
            else {
                value.kind = {
                    case: "structValue",
                    value: wktStructToReflect(json),
                };
            }
            break;
    }
    return value;
}
