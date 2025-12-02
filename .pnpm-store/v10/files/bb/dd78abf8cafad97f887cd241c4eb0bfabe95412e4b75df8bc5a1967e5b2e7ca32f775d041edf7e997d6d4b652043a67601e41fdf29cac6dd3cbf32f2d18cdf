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
import { ScalarType, } from "../descriptors.js";
import { checkField, checkListItem, checkMapEntry } from "./reflect-check.js";
import { FieldError } from "./error.js";
import { unsafeClear, unsafeGet, unsafeIsSet, unsafeLocal, unsafeOneofCase, unsafeSet, } from "./unsafe.js";
import { create } from "../create.js";
import { isWrapper, isWrapperDesc } from "../wkt/wrappers.js";
import { scalarZeroValue } from "./scalar.js";
import { protoInt64 } from "../proto-int64.js";
import { isObject, isReflectList, isReflectMap, isReflectMessage, } from "./guard.js";
/**
 * Create a ReflectMessage.
 */
export function reflect(messageDesc, message, 
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
        this.message = this[unsafeLocal] = message !== null && message !== void 0 ? message : create(messageDesc);
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
        return unsafeOneofCase(this.message, oneof);
    }
    isSet(field) {
        assertOwn(this.message, field);
        return unsafeIsSet(this.message, field);
    }
    clear(field) {
        assertOwn(this.message, field);
        unsafeClear(this.message, field);
    }
    get(field) {
        assertOwn(this.message, field);
        const value = unsafeGet(this.message, field);
        switch (field.fieldKind) {
            case "list":
                // eslint-disable-next-line no-case-declarations
                let list = this.lists.get(field);
                if (!list || list[unsafeLocal] !== value) {
                    this.lists.set(field, 
                    // biome-ignore lint/suspicious/noAssignInExpressions: no
                    (list = new ReflectListImpl(field, value, this.check)));
                }
                return list;
            case "map":
                let map = this.maps.get(field);
                if (!map || map[unsafeLocal] !== value) {
                    this.maps.set(field, 
                    // biome-ignore lint/suspicious/noAssignInExpressions: no
                    (map = new ReflectMapImpl(field, value, this.check)));
                }
                return map;
            case "message":
                return messageToReflect(field, value, this.check);
            case "scalar":
                return (value === undefined
                    ? scalarZeroValue(field.scalar, false)
                    : longToReflect(field, value));
            case "enum":
                return (value !== null && value !== void 0 ? value : field.enum.values[0].number);
        }
    }
    set(field, value) {
        assertOwn(this.message, field);
        if (this.check) {
            const err = checkField(field, value);
            if (err) {
                throw err;
            }
        }
        let local;
        if (field.fieldKind == "message") {
            local = messageToLocal(field, value);
        }
        else if (isReflectMap(value) || isReflectList(value)) {
            local = value[unsafeLocal];
        }
        else {
            local = longToLocal(field, value);
        }
        unsafeSet(this.message, field, local);
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
        throw new FieldError(member, `cannot use ${member.toString()} with message ${owner.$typeName}`, "ForeignFieldError");
    }
}
/**
 * Create a ReflectList.
 */
export function reflectList(field, unsafeInput, 
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
        this._arr = this[unsafeLocal] = unsafeInput;
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
            throw new FieldError(this._field, `list item #${index + 1}: out of range`);
        }
        if (this.check) {
            const err = checkListItem(this._field, index, item);
            if (err) {
                throw err;
            }
        }
        this._arr[index] = listItemToLocal(this._field, item);
    }
    add(item) {
        if (this.check) {
            const err = checkListItem(this._field, this._arr.length, item);
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
export function reflectMap(field, unsafeInput, 
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
        this.obj = this[unsafeLocal] = unsafeInput !== null && unsafeInput !== void 0 ? unsafeInput : {};
        this.check = check;
        this._field = field;
    }
    field() {
        return this._field;
    }
    set(key, value) {
        if (this.check) {
            const err = checkMapEntry(this._field, key, value);
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
    if (!isReflectMessage(value)) {
        return value;
    }
    if (isWrapper(value.message) &&
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
        if (isWrapperDesc(field.message) &&
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
            isObject(value)) {
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
        case ScalarType.STRING:
            return key;
        case ScalarType.INT32:
        case ScalarType.FIXED32:
        case ScalarType.UINT32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32: {
            const n = Number.parseInt(key);
            if (Number.isFinite(n)) {
                return n;
            }
            break;
        }
        case ScalarType.BOOL:
            switch (key) {
                case "true":
                    return true;
                case "false":
                    return false;
            }
            break;
        case ScalarType.UINT64:
        case ScalarType.FIXED64:
            try {
                return protoInt64.uParse(key);
            }
            catch (_a) {
                //
            }
            break;
        default:
            // INT64, SFIXED64, SINT64
            try {
                return protoInt64.parse(key);
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
        case ScalarType.INT64:
        case ScalarType.SFIXED64:
        case ScalarType.SINT64:
            if ("longAsString" in field &&
                field.longAsString &&
                typeof value == "string") {
                value = protoInt64.parse(value);
            }
            break;
        case ScalarType.FIXED64:
        case ScalarType.UINT64:
            if ("longAsString" in field &&
                field.longAsString &&
                typeof value == "string") {
                value = protoInt64.uParse(value);
            }
            break;
    }
    return value;
}
function longToLocal(field, value) {
    switch (field.scalar) {
        case ScalarType.INT64:
        case ScalarType.SFIXED64:
        case ScalarType.SINT64:
            if ("longAsString" in field && field.longAsString) {
                value = String(value);
            }
            else if (typeof value == "string" || typeof value == "number") {
                value = protoInt64.parse(value);
            }
            break;
        case ScalarType.FIXED64:
        case ScalarType.UINT64:
            if ("longAsString" in field && field.longAsString) {
                value = String(value);
            }
            else if (typeof value == "string" || typeof value == "number") {
                value = protoInt64.uParse(value);
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
    if (isObject(json)) {
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
