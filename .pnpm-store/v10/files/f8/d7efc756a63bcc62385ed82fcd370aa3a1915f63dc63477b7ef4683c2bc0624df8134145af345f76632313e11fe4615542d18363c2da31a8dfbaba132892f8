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
exports.StructRow = void 0;
const pretty_js_1 = require("../util/pretty.js");
const get_js_1 = require("../visitor/get.js");
const set_js_1 = require("../visitor/set.js");
/** @ignore */ const kParent = Symbol.for('parent');
/** @ignore */ const kRowIndex = Symbol.for('rowIndex');
class StructRow {
    constructor(parent, rowIndex) {
        this[kParent] = parent;
        this[kRowIndex] = rowIndex;
        return new Proxy(this, structRowProxyHandler);
    }
    toArray() { return Object.values(this.toJSON()); }
    toJSON() {
        const i = this[kRowIndex];
        const parent = this[kParent];
        const keys = parent.type.children;
        const json = {};
        for (let j = -1, n = keys.length; ++j < n;) {
            json[keys[j].name] = get_js_1.instance.visit(parent.children[j], i);
        }
        return json;
    }
    toString() {
        return `{${[...this].map(([key, val]) => `${(0, pretty_js_1.valueToString)(key)}: ${(0, pretty_js_1.valueToString)(val)}`).join(', ')}}`;
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toString();
    }
    [Symbol.iterator]() {
        return new StructRowIterator(this[kParent], this[kRowIndex]);
    }
}
exports.StructRow = StructRow;
class StructRowIterator {
    constructor(data, rowIndex) {
        this.childIndex = 0;
        this.children = data.children;
        this.rowIndex = rowIndex;
        this.childFields = data.type.children;
        this.numChildren = this.childFields.length;
    }
    [Symbol.iterator]() { return this; }
    next() {
        const i = this.childIndex;
        if (i < this.numChildren) {
            this.childIndex = i + 1;
            return {
                done: false,
                value: [
                    this.childFields[i].name,
                    get_js_1.instance.visit(this.children[i], this.rowIndex)
                ]
            };
        }
        return { done: true, value: null };
    }
}
Object.defineProperties(StructRow.prototype, {
    [Symbol.toStringTag]: { enumerable: false, configurable: false, value: 'Row' },
    [kParent]: { writable: true, enumerable: false, configurable: false, value: null },
    [kRowIndex]: { writable: true, enumerable: false, configurable: false, value: -1 },
});
class StructRowProxyHandler {
    isExtensible() { return false; }
    deleteProperty() { return false; }
    preventExtensions() { return true; }
    ownKeys(row) {
        return row[kParent].type.children.map((f) => f.name);
    }
    has(row, key) {
        return row[kParent].type.children.some((f) => f.name === key);
    }
    getOwnPropertyDescriptor(row, key) {
        if (row[kParent].type.children.some((f) => f.name === key)) {
            return { writable: true, enumerable: true, configurable: true };
        }
        return;
    }
    get(row, key) {
        // Look up key in row first
        if (Reflect.has(row, key)) {
            return row[key];
        }
        const idx = row[kParent].type.children.findIndex((f) => f.name === key);
        if (idx !== -1) {
            const val = get_js_1.instance.visit(row[kParent].children[idx], row[kRowIndex]);
            // Cache key/val lookups
            Reflect.set(row, key, val);
            return val;
        }
    }
    set(row, key, val) {
        const idx = row[kParent].type.children.findIndex((f) => f.name === key);
        if (idx !== -1) {
            set_js_1.instance.visit(row[kParent].children[idx], row[kRowIndex], val);
            // Cache key/val lookups
            return Reflect.set(row, key, val);
        }
        else if (Reflect.has(row, key) || typeof key === 'symbol') {
            return Reflect.set(row, key, val);
        }
        return false;
    }
}
const structRowProxyHandler = new StructRowProxyHandler();

//# sourceMappingURL=struct.js.map
