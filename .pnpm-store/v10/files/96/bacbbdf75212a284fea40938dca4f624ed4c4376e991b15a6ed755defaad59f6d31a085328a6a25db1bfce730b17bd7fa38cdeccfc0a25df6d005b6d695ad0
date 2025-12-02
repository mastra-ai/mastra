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
exports.BinaryBuilder = void 0;
const buffer_js_1 = require("./buffer.js");
const builder_js_1 = require("../builder.js");
const buffer_js_2 = require("../util/buffer.js");
/** @ignore */
class BinaryBuilder extends builder_js_1.VariableWidthBuilder {
    constructor(opts) {
        super(opts);
        this._values = new buffer_js_1.BufferBuilder(Uint8Array);
    }
    get byteLength() {
        let size = this._pendingLength + (this.length * 4);
        this._offsets && (size += this._offsets.byteLength);
        this._values && (size += this._values.byteLength);
        this._nulls && (size += this._nulls.byteLength);
        return size;
    }
    setValue(index, value) {
        return super.setValue(index, (0, buffer_js_2.toUint8Array)(value));
    }
    _flushPending(pending, pendingLength) {
        const offsets = this._offsets;
        const data = this._values.reserve(pendingLength).buffer;
        let offset = 0;
        for (const [index, value] of pending) {
            if (value === undefined) {
                offsets.set(index, 0);
            }
            else {
                const length = value.length;
                data.set(value, offset);
                offsets.set(index, length);
                offset += length;
            }
        }
    }
}
exports.BinaryBuilder = BinaryBuilder;

//# sourceMappingURL=binary.js.map
