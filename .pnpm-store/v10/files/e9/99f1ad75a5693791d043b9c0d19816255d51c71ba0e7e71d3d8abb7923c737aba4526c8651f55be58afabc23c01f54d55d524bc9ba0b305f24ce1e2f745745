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
exports.AggregateQuerySnapshot = void 0;
const deepEqual = require("fast-deep-equal");
/**
 * The results of executing an aggregation query.
 */
class AggregateQuerySnapshot {
    /**
     * @internal
     *
     * @param _query The query that was executed to produce this result.
     * @param _readTime The time this snapshot was read.
     * @param _data The results of the aggregations performed over the underlying
     * query.
     */
    constructor(_query, _readTime, _data) {
        this._query = _query;
        this._readTime = _readTime;
        this._data = _data;
    }
    /** The query that was executed to produce this result. */
    get query() {
        return this._query;
    }
    /** The time this snapshot was read. */
    get readTime() {
        return this._readTime;
    }
    /**
     * Returns the results of the aggregations performed over the underlying
     * query.
     *
     * The keys of the returned object will be the same as those of the
     * `AggregateSpec` object specified to the aggregation method, and the
     * values will be the corresponding aggregation result.
     *
     * @returns The results of the aggregations performed over the underlying
     * query.
     */
    data() {
        return this._data;
    }
    /**
     * Compares this object with the given object for equality.
     *
     * Two `AggregateQuerySnapshot` instances are considered "equal" if they
     * have the same data and their underlying queries compare "equal" using
     * `AggregateQuery.isEqual()`.
     *
     * @param other The object to compare to this object for equality.
     * @return `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other) {
        if (this === other) {
            return true;
        }
        if (!(other instanceof AggregateQuerySnapshot)) {
            return false;
        }
        // Since the read time is different on every read, we explicitly ignore all
        // document metadata in this comparison, just like
        // `DocumentSnapshot.isEqual()` does.
        if (!this.query.isEqual(other.query)) {
            return false;
        }
        return deepEqual(this._data, other._data);
    }
}
exports.AggregateQuerySnapshot = AggregateQuerySnapshot;
//# sourceMappingURL=aggregate-query-snapshot.js.map