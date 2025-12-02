"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiRange = exports.Range = void 0;
class Range {
    _lower;
    _upper;
    _incLower;
    _incUpper;
    _isEmpty = false;
    constructor(_lower, _upper, _incLower = _lower != null, _incUpper = false) {
        this._lower = _lower;
        this._upper = _upper;
        this._incLower = _incLower;
        this._incUpper = _incUpper;
    }
    get lower() {
        return this._lower;
    }
    get upper() {
        return this._upper;
    }
    get incLower() {
        return this._incLower;
    }
    get incUpper() {
        return this._incUpper;
    }
    get isEmpty() {
        return this._isEmpty;
    }
    static empty() {
        const range = new Range(null, null);
        range._isEmpty = true;
        return range;
    }
    toJSON() {
        return this.isEmpty
            ? { empty: true }
            : {
                lower: this._lower,
                upper: this._upper,
                inc_lower: this._incLower,
                inc_upper: this._incUpper,
            };
    }
}
exports.Range = Range;
class MultiRange {
    _ranges;
    constructor(ranges = []) {
        this._ranges = [...ranges];
    }
    get length() {
        return this._ranges.length;
    }
    *[Symbol.iterator]() {
        for (const range of this._ranges) {
            yield range;
        }
    }
    toJSON() {
        return [...this._ranges];
    }
}
exports.MultiRange = MultiRange;
