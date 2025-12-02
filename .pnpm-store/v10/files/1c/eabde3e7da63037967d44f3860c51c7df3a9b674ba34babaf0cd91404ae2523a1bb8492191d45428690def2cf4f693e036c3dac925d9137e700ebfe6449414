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
exports.MapRow = exports._kKeysAsStrings = exports.kKeysAsStrings = exports.kVals = exports.kKeys = void 0;
const vector_js_1 = require("../vector.js");
const pretty_js_1 = require("../util/pretty.js");
const get_js_1 = require("../visitor/get.js");
const set_js_1 = require("../visitor/set.js");
/** @ignore */ exports.kKeys = Symbol.for('keys');
/** @ignore */ exports.kVals = Symbol.for('vals');
/** @ignore */ exports.kKeysAsStrings = Symbol.for('kKeysAsStrings');
/** @ignore */ exports._kKeysAsStrings = Symbol.for('_kKeysAsStrings');
class MapRow {
    constructor(slice) {
        this[exports.kKeys] = new vector_js_1.Vector([slice.children[0]]).memoize();
        this[exports.kVals] = slice.children[1];
        return new Proxy(this, new MapRowProxyHandler());
    }
    /** @ignore */
    get [exports.kKeysAsStrings]() {
        return this[exports._kKeysAsStrings] || (this[exports._kKeysAsStrings] = Array.from(this[exports.kKeys].toArray(), String));
    }
    [Symbol.iterator]() {
        return new MapRowIterator(this[exports.kKeys], this[exports.kVals]);
    }
    get size() { return this[exports.kKeys].length; }
    toArray() { return Object.values(this.toJSON()); }
    toJSON() {
        const keys = this[exports.kKeys];
        const vals = this[exports.kVals];
        const json = {};
        for (let i = -1, n = keys.length; ++i < n;) {
            json[keys.get(i)] = get_js_1.instance.visit(vals, i);
        }
        return json;
    }
    toString() {
        return `{${[...this].map(([key, val]) => `${(0, pretty_js_1.valueToString)(key)}: ${(0, pretty_js_1.valueToString)(val)}`).join(', ')}}`;
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toString();
    }
}
exports.MapRow = MapRow;
class MapRowIterator {
    constructor(keys, vals) {
        this.keys = keys;
        this.vals = vals;
        this.keyIndex = 0;
        this.numKeys = keys.length;
    }
    [Symbol.iterator]() { return this; }
    next() {
        const i = this.keyIndex;
        if (i === this.numKeys) {
            return { done: true, value: null };
        }
        this.keyIndex++;
        return {
            done: false,
            value: [
                this.keys.get(i),
                get_js_1.instance.visit(this.vals, i),
            ]
        };
    }
}
/** @ignore */
class MapRowProxyHandler {
    isExtensible() { return false; }
    deleteProperty() { return false; }
    preventExtensions() { return true; }
    ownKeys(row) {
        return row[exports.kKeysAsStrings];
    }
    has(row, key) {
        return row[exports.kKeysAsStrings].includes(key);
    }
    getOwnPropertyDescriptor(row, key) {
        const idx = row[exports.kKeysAsStrings].indexOf(key);
        if (idx !== -1) {
            return { writable: true, enumerable: true, configurable: true };
        }
        return;
    }
    get(row, key) {
        // Look up key in row first
        if (Reflect.has(row, key)) {
            return row[key];
        }
        const idx = row[exports.kKeysAsStrings].indexOf(key);
        if (idx !== -1) {
            const val = get_js_1.instance.visit(Reflect.get(row, exports.kVals), idx);
            // Cache key/val lookups
            Reflect.set(row, key, val);
            return val;
        }
    }
    set(row, key, val) {
        const idx = row[exports.kKeysAsStrings].indexOf(key);
        if (idx !== -1) {
            set_js_1.instance.visit(Reflect.get(row, exports.kVals), idx, val);
            // Cache key/val lookups
            return Reflect.set(row, key, val);
        }
        else if (Reflect.has(row, key)) {
            return Reflect.set(row, key, val);
        }
        return false;
    }
}
Object.defineProperties(MapRow.prototype, {
    [Symbol.toStringTag]: { enumerable: false, configurable: false, value: 'Row' },
    [exports.kKeys]: { writable: true, enumerable: false, configurable: false, value: null },
    [exports.kVals]: { writable: true, enumerable: false, configurable: false, value: null },
    [exports._kKeysAsStrings]: { writable: true, enumerable: false, configurable: false, value: null },
});

//# sourceMappingURL=map.js.map
