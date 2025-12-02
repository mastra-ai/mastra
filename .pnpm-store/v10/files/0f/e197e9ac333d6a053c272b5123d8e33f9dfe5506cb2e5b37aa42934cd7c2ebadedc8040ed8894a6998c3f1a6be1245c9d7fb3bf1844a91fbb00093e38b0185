"use strict";
/**
 * Copyright 2024 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeFilterInternal = void 0;
const filter_internal_1 = require("./filter-internal");
class CompositeFilterInternal extends filter_internal_1.FilterInternal {
    constructor(filters, operator) {
        super();
        this.filters = filters;
        this.operator = operator;
        // Memoized list of all field filters that can be found by traversing the tree of filters
        // contained in this composite filter.
        this.memoizedFlattenedFilters = null;
    }
    getFilters() {
        return this.filters;
    }
    isConjunction() {
        return this.operator === 'AND';
    }
    getFlattenedFilters() {
        if (this.memoizedFlattenedFilters !== null) {
            return this.memoizedFlattenedFilters;
        }
        this.memoizedFlattenedFilters = this.filters.reduce((allFilters, subfilter) => allFilters.concat(subfilter.getFlattenedFilters()), []);
        return this.memoizedFlattenedFilters;
    }
    toProto() {
        if (this.filters.length === 1) {
            return this.filters[0].toProto();
        }
        const proto = {
            compositeFilter: {
                op: this.operator,
                filters: this.filters.map(filter => filter.toProto()),
            },
        };
        return proto;
    }
    isEqual(other) {
        if (other instanceof CompositeFilterInternal) {
            const otherFilters = other.getFilters();
            return (this.operator === other.operator &&
                this.getFilters().length === other.getFilters().length &&
                this.getFilters().every((filter, index) => filter.isEqual(otherFilters[index])));
        }
        else {
            return false;
        }
    }
}
exports.CompositeFilterInternal = CompositeFilterInternal;
//# sourceMappingURL=composite-filter-internal.js.map