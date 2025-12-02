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
exports.DictionaryBuilder = void 0;
const type_js_1 = require("../type.js");
const builder_js_1 = require("../builder.js");
const factories_js_1 = require("../factories.js");
/** @ignore */
class DictionaryBuilder extends builder_js_1.Builder {
    constructor({ 'type': type, 'nullValues': nulls, 'dictionaryHashFunction': hashFn }) {
        super({ type: new type_js_1.Dictionary(type.dictionary, type.indices, type.id, type.isOrdered) });
        this._nulls = null;
        this._dictionaryOffset = 0;
        this._keysToIndices = Object.create(null);
        this.indices = (0, factories_js_1.makeBuilder)({ 'type': this.type.indices, 'nullValues': nulls });
        this.dictionary = (0, factories_js_1.makeBuilder)({ 'type': this.type.dictionary, 'nullValues': null });
        if (typeof hashFn === 'function') {
            this.valueToKey = hashFn;
        }
    }
    get values() { return this.indices.values; }
    get nullCount() { return this.indices.nullCount; }
    get nullBitmap() { return this.indices.nullBitmap; }
    get byteLength() { return this.indices.byteLength + this.dictionary.byteLength; }
    get reservedLength() { return this.indices.reservedLength + this.dictionary.reservedLength; }
    get reservedByteLength() { return this.indices.reservedByteLength + this.dictionary.reservedByteLength; }
    isValid(value) { return this.indices.isValid(value); }
    setValid(index, valid) {
        const indices = this.indices;
        valid = indices.setValid(index, valid);
        this.length = indices.length;
        return valid;
    }
    setValue(index, value) {
        const keysToIndices = this._keysToIndices;
        const key = this.valueToKey(value);
        let idx = keysToIndices[key];
        if (idx === undefined) {
            keysToIndices[key] = idx = this._dictionaryOffset + this.dictionary.append(value).length - 1;
        }
        return this.indices.setValue(index, idx);
    }
    flush() {
        const type = this.type;
        const prev = this._dictionary;
        const curr = this.dictionary.toVector();
        const data = this.indices.flush().clone(type);
        data.dictionary = prev ? prev.concat(curr) : curr;
        this.finished || (this._dictionaryOffset += curr.length);
        this._dictionary = data.dictionary;
        this.clear();
        return data;
    }
    finish() {
        this.indices.finish();
        this.dictionary.finish();
        this._dictionaryOffset = 0;
        this._keysToIndices = Object.create(null);
        return super.finish();
    }
    clear() {
        this.indices.clear();
        this.dictionary.clear();
        return super.clear();
    }
    valueToKey(val) {
        return typeof val === 'string' ? val : `${val}`;
    }
}
exports.DictionaryBuilder = DictionaryBuilder;

//# sourceMappingURL=dictionary.js.map
