"use strict";
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapBuilder = void 0;
const schema_js_1 = require("../schema.js");
const type_js_1 = require("../type.js");
const builder_js_1 = require("../builder.js");
/** @ignore */
class MapBuilder extends builder_js_1.VariableWidthBuilder {
    set(index, value) {
        return super.set(index, value);
    }
    setValue(index, value) {
        const row = (value instanceof Map ? value : new Map(Object.entries(value)));
        const pending = this._pending || (this._pending = new Map());
        const current = pending.get(index);
        current && (this._pendingLength -= current.size);
        this._pendingLength += row.size;
        pending.set(index, row);
    }
    addChild(child, name = `${this.numChildren}`) {
        if (this.numChildren > 0) {
            throw new Error('ListBuilder can only have one child.');
        }
        this.children[this.numChildren] = child;
        this.type = new type_js_1.Map_(new schema_js_1.Field(name, child.type, true), this.type.keysSorted);
        return this.numChildren - 1;
    }
    _flushPending(pending) {
        const offsets = this._offsets;
        const [child] = this.children;
        for (const [index, value] of pending) {
            if (value === undefined) {
                offsets.set(index, 0);
            }
            else {
                let { [index]: idx, [index + 1]: end } = offsets.set(index, value.size).buffer;
                for (const val of value.entries()) {
                    child.set(idx, val);
                    if (++idx >= end)
                        break;
                }
            }
        }
    }
}
exports.MapBuilder = MapBuilder;

//# sourceMappingURL=map.js.map
