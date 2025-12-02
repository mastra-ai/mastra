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
exports.VectorQuery = void 0;
const field_value_1 = require("../field-value");
const path_1 = require("../path");
const util_1 = require("../util");
const query_util_1 = require("./query-util");
const vector_query_snapshot_1 = require("./vector-query-snapshot");
const query_profile_1 = require("../query-profile");
/**
 * A query that finds the documents whose vector fields are closest to a certain query vector.
 * Create an instance of `VectorQuery` with {@link Query.findNearest}.
 */
class VectorQuery {
    /**
     * @private
     * @internal
     */
    constructor(_query, _options) {
        this._query = _query;
        this._options = _options;
        this._queryUtil = new query_util_1.QueryUtil(_query._firestore, _query._queryOptions, _query._serializer);
    }
    /** The query whose results participants in the vector search. Filtering
     * performed by the query will apply before the vector search.
     **/
    get query() {
        return this._query;
    }
    /**
     * @private
     * @internal
     */
    get _rawVectorField() {
        return typeof this._options.vectorField === 'string'
            ? this._options.vectorField
            : this._options.vectorField.toString();
    }
    /**
     * @private
     * @internal
     */
    get _rawDistanceResultField() {
        if (typeof this._options.distanceResultField === 'undefined')
            return;
        return typeof this._options.distanceResultField === 'string'
            ? this._options.distanceResultField
            : this._options.distanceResultField.toString();
    }
    /**
     * @private
     * @internal
     */
    get _rawQueryVector() {
        return Array.isArray(this._options.queryVector)
            ? this._options.queryVector
            : this._options.queryVector.toArray();
    }
    /**
     * Plans and optionally executes this vector search query. Returns a Promise that will be
     * resolved with the planner information, statistics from the query execution (if any),
     * and the query results (if any).
     *
     * @return A Promise that will be resolved with the planner information, statistics
     *  from the query execution (if any), and the query results (if any).
     */
    async explain(options) {
        if (options === undefined) {
            options = {};
        }
        const { result, explainMetrics } = await this._getResponse(options);
        if (!explainMetrics) {
            throw new Error('No explain results');
        }
        return new query_profile_1.ExplainResults(explainMetrics, result || null);
    }
    /**
     * Executes this vector search query.
     *
     * @returns A promise that will be resolved with the results of the query.
     */
    async get() {
        const { result } = await this._getResponse();
        if (!result) {
            throw new Error('No VectorQuerySnapshot result');
        }
        return result;
    }
    _getResponse(explainOptions) {
        return this._queryUtil._getResponse(this, 
        /*transactionOrReadTime*/ undefined, 
        // VectorQuery cannot be retried with cursors as they do not support cursors yet.
        /*retryWithCursor*/ false, explainOptions);
    }
    /**
     * Internal streaming method that accepts an optional transaction ID.
     *
     * @param transactionId - A transaction ID.
     * @private
     * @internal
     * @returns A stream of document results.
     */
    _stream(transactionId) {
        return this._queryUtil._stream(this, transactionId, 
        /*retryWithCursor*/ false);
    }
    /**
     * Internal method for serializing a query to its proto
     * representation with an optional transaction id.
     *
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    toProto(transactionOrReadTime, explainOptions) {
        var _a, _b, _c;
        const queryProto = this._query.toProto(transactionOrReadTime);
        const queryVector = Array.isArray(this._options.queryVector)
            ? new field_value_1.VectorValue(this._options.queryVector)
            : this._options.queryVector;
        queryProto.structuredQuery.findNearest = {
            limit: { value: this._options.limit },
            distanceMeasure: this._options.distanceMeasure,
            vectorField: {
                fieldPath: path_1.FieldPath.fromArgument(this._options.vectorField)
                    .formattedName,
            },
            queryVector: queryVector._toProto(this._query._serializer),
            distanceResultField: ((_a = this._options) === null || _a === void 0 ? void 0 : _a.distanceResultField)
                ? path_1.FieldPath.fromArgument(this._options.distanceResultField)
                    .formattedName
                : undefined,
            distanceThreshold: ((_b = this._options) === null || _b === void 0 ? void 0 : _b.distanceThreshold)
                ? { value: (_c = this._options) === null || _c === void 0 ? void 0 : _c.distanceThreshold }
                : undefined,
        };
        if (explainOptions) {
            queryProto.explainOptions = explainOptions;
        }
        return queryProto;
    }
    /**
     * Construct the resulting vector snapshot for this query with given documents.
     *
     * @private
     * @internal
     */
    _createSnapshot(readTime, size, docs, changes) {
        return new vector_query_snapshot_1.VectorQuerySnapshot(this, readTime, size, docs, changes);
    }
    /**
     * Construct a new vector query whose result will start after To support stream().
     * This now throws an exception because cursors are not supported from the backend for vector queries yet.
     *
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    startAfter(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...fieldValuesOrDocumentSnapshot) {
        throw new Error('Unimplemented: Vector query does not support cursors yet.');
    }
    /**
     * Compares this object with the given object for equality.
     *
     * This object is considered "equal" to the other object if and only if
     * `other` performs the same vector distance search as this `VectorQuery` and
     * the underlying Query of `other` compares equal to that of this object
     * using `Query.isEqual()`.
     *
     * @param other - The object to compare to this object for equality.
     * @returns `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other) {
        if (this === other) {
            return true;
        }
        if (!(other instanceof VectorQuery)) {
            return false;
        }
        if (!this.query.isEqual(other.query)) {
            return false;
        }
        return (this._rawVectorField === other._rawVectorField &&
            (0, util_1.isPrimitiveArrayEqual)(this._rawQueryVector, other._rawQueryVector) &&
            this._options.limit === other._options.limit &&
            this._options.distanceMeasure === other._options.distanceMeasure &&
            this._options.distanceThreshold === other._options.distanceThreshold &&
            this._rawDistanceResultField === other._rawDistanceResultField);
    }
}
exports.VectorQuery = VectorQuery;
//# sourceMappingURL=vector-query.js.map