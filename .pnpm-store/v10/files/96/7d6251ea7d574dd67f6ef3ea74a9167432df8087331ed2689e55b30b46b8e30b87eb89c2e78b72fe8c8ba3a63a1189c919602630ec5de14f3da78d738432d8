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
exports.merge = merge;
const reflect_js_1 = require("./reflect/reflect.js");
/**
 * Merge message `source` into message `target`, following Protobuf semantics.
 *
 * This is the same as serializing the source message, then deserializing it
 * into the target message via `mergeFromBinary()`, with one difference:
 * While serialization will create a copy of all values, `merge()` will copy
 * the reference for `bytes` and messages.
 *
 * Also see https://protobuf.com/docs/language-spec#merging-protobuf-messages
 */
function merge(schema, target, source) {
    reflectMerge((0, reflect_js_1.reflect)(schema, target), (0, reflect_js_1.reflect)(schema, source));
}
function reflectMerge(target, source) {
    var _a;
    var _b;
    const sourceUnknown = source.message.$unknown;
    if (sourceUnknown !== undefined && sourceUnknown.length > 0) {
        (_a = (_b = target.message).$unknown) !== null && _a !== void 0 ? _a : (_b.$unknown = []);
        target.message.$unknown.push(...sourceUnknown);
    }
    for (const f of target.fields) {
        if (!source.isSet(f)) {
            continue;
        }
        switch (f.fieldKind) {
            case "scalar":
            case "enum":
                target.set(f, source.get(f));
                break;
            case "message":
                if (target.isSet(f)) {
                    reflectMerge(target.get(f), source.get(f));
                }
                else {
                    target.set(f, source.get(f));
                }
                break;
            case "list":
                const list = target.get(f);
                for (const e of source.get(f)) {
                    list.add(e);
                }
                break;
            case "map":
                const map = target.get(f);
                for (const [k, v] of source.get(f)) {
                    map.set(k, v);
                }
                break;
        }
    }
}
