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
exports.clone = clone;
const descriptors_js_1 = require("./descriptors.js");
const reflect_js_1 = require("./reflect/reflect.js");
const guard_js_1 = require("./reflect/guard.js");
/**
 * Create a deep copy of a message, including extensions and unknown fields.
 */
function clone(schema, message) {
    return cloneReflect((0, reflect_js_1.reflect)(schema, message)).message;
}
function cloneReflect(i) {
    const o = (0, reflect_js_1.reflect)(i.desc);
    for (const f of i.fields) {
        if (!i.isSet(f)) {
            continue;
        }
        switch (f.fieldKind) {
            case "list":
                const list = o.get(f);
                for (const item of i.get(f)) {
                    list.add(cloneSingular(f, item));
                }
                break;
            case "map":
                const map = o.get(f);
                for (const entry of i.get(f).entries()) {
                    map.set(entry[0], cloneSingular(f, entry[1]));
                }
                break;
            default: {
                o.set(f, cloneSingular(f, i.get(f)));
                break;
            }
        }
    }
    const unknown = i.getUnknown();
    if (unknown && unknown.length > 0) {
        o.setUnknown([...unknown]);
    }
    return o;
}
function cloneSingular(field, value) {
    if (field.message !== undefined && (0, guard_js_1.isReflectMessage)(value)) {
        return cloneReflect(value);
    }
    if (field.scalar == descriptors_js_1.ScalarType.BYTES && value instanceof Uint8Array) {
        // @ts-expect-error T cannot extend Uint8Array in practice
        return value.slice();
    }
    return value;
}
