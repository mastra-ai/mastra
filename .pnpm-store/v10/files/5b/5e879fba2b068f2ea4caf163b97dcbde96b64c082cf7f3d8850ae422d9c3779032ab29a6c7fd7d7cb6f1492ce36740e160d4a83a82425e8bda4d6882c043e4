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
exports.QueryOptions = void 0;
const deepEqual = require("fast-deep-equal");
const path_1 = require("../path");
const types_1 = require("../types");
const helpers_1 = require("./helpers");
/**
 * Internal class representing custom Query options.
 *
 * These options are immutable. Modified options can be created using `with()`.
 * @private
 * @internal
 */
class QueryOptions {
    constructor(parentPath, collectionId, converter, allDescendants, filters, fieldOrders, startAt, endAt, limit, limitType, offset, projection, 
    // Whether to select all documents under `parentPath`. By default, only
    // collections that match `collectionId` are selected.
    kindless = false, 
    // Whether to require consistent documents when restarting the query. By
    // default, restarting the query uses the readTime offset of the original
    // query to provide consistent results.
    requireConsistency = true) {
        this.parentPath = parentPath;
        this.collectionId = collectionId;
        this.converter = converter;
        this.allDescendants = allDescendants;
        this.filters = filters;
        this.fieldOrders = fieldOrders;
        this.startAt = startAt;
        this.endAt = endAt;
        this.limit = limit;
        this.limitType = limitType;
        this.offset = offset;
        this.projection = projection;
        this.kindless = kindless;
        this.requireConsistency = requireConsistency;
    }
    /**
     * Returns query options for a collection group query.
     * @private
     * @internal
     */
    static forCollectionGroupQuery(collectionId, converter = (0, types_1.defaultConverter)()) {
        return new QueryOptions(
        /*parentPath=*/ path_1.ResourcePath.EMPTY, collectionId, converter, 
        /*allDescendants=*/ true, 
        /*fieldFilters=*/ [], 
        /*fieldOrders=*/ []);
    }
    /**
     * Returns query options for a single-collection query.
     * @private
     * @internal
     */
    static forCollectionQuery(collectionRef, converter = (0, types_1.defaultConverter)()) {
        return new QueryOptions(collectionRef.parent(), collectionRef.id, converter, 
        /*allDescendants=*/ false, 
        /*fieldFilters=*/ [], 
        /*fieldOrders=*/ []);
    }
    /**
     * Returns query options for a query that fetches all descendants under the
     * specified reference.
     *
     * @private
     * @internal
     */
    static forKindlessAllDescendants(parent, id, requireConsistency = true) {
        let options = new QueryOptions(parent, id, (0, types_1.defaultConverter)(), 
        /*allDescendants=*/ true, 
        /*fieldFilters=*/ [], 
        /*fieldOrders=*/ []);
        options = options.with({
            kindless: true,
            requireConsistency,
        });
        return options;
    }
    /**
     * Returns the union of the current and the provided options.
     * @private
     * @internal
     */
    with(settings) {
        return new QueryOptions((0, helpers_1.coalesce)(settings.parentPath, this.parentPath), (0, helpers_1.coalesce)(settings.collectionId, this.collectionId), this.converter, (0, helpers_1.coalesce)(settings.allDescendants, this.allDescendants), (0, helpers_1.coalesce)(settings.filters, this.filters), (0, helpers_1.coalesce)(settings.fieldOrders, this.fieldOrders), (0, helpers_1.coalesce)(settings.startAt, this.startAt), (0, helpers_1.coalesce)(settings.endAt, this.endAt), (0, helpers_1.coalesce)(settings.limit, this.limit), (0, helpers_1.coalesce)(settings.limitType, this.limitType), (0, helpers_1.coalesce)(settings.offset, this.offset), (0, helpers_1.coalesce)(settings.projection, this.projection), (0, helpers_1.coalesce)(settings.kindless, this.kindless), (0, helpers_1.coalesce)(settings.requireConsistency, this.requireConsistency));
    }
    withConverter(converter) {
        return new QueryOptions(this.parentPath, this.collectionId, converter, this.allDescendants, this.filters, this.fieldOrders, this.startAt, this.endAt, this.limit, this.limitType, this.offset, this.projection);
    }
    hasFieldOrders() {
        return this.fieldOrders.length > 0;
    }
    isEqual(other) {
        if (this === other) {
            return true;
        }
        return (other instanceof QueryOptions &&
            this.parentPath.isEqual(other.parentPath) &&
            this.filtersEqual(other.filters) &&
            this.collectionId === other.collectionId &&
            this.converter === other.converter &&
            this.allDescendants === other.allDescendants &&
            this.limit === other.limit &&
            this.offset === other.offset &&
            deepEqual(this.fieldOrders, other.fieldOrders) &&
            deepEqual(this.startAt, other.startAt) &&
            deepEqual(this.endAt, other.endAt) &&
            deepEqual(this.projection, other.projection) &&
            this.kindless === other.kindless &&
            this.requireConsistency === other.requireConsistency);
    }
    filtersEqual(other) {
        if (this.filters.length !== other.length) {
            return false;
        }
        for (let i = 0; i < other.length; i++) {
            if (!this.filters[i].isEqual(other[i])) {
                return false;
            }
        }
        return true;
    }
}
exports.QueryOptions = QueryOptions;
//# sourceMappingURL=query-options.js.map