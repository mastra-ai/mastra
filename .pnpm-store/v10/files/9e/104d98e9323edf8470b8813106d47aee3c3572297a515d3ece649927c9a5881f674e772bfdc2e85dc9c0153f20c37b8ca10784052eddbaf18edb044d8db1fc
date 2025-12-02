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
exports.Query = void 0;
const stream_1 = require("stream");
const query_util_1 = require("./query-util");
const index_1 = require("../index");
const field_order_1 = require("./field-order");
const field_filter_internal_1 = require("./field-filter-internal");
const composite_filter_internal_1 = require("./composite-filter-internal");
const constants_1 = require("./constants");
const document_reference_1 = require("./document-reference");
const query_snapshot_1 = require("./query-snapshot");
const serializer_1 = require("../serializer");
const query_profile_1 = require("../query-profile");
const filter_1 = require("../filter");
const path_1 = require("../path");
const helpers_1 = require("./helpers");
const validate_1 = require("../validate");
const types_1 = require("./types");
const aggregate_query_1 = require("./aggregate-query");
const vector_query_1 = require("./vector-query");
const order_1 = require("../order");
const types_2 = require("../types");
const trace_util_1 = require("../telemetry/trace-util");
/**
 * A Query refers to a query which you can read or stream from. You can also
 * construct refined Query objects by adding filters and ordering.
 *
 * @class Query
 */
class Query {
    /**
     * @internal
     * @private
     *
     * @param _firestore The Firestore Database client.
     * @param _queryOptions Options that define the query.
     */
    constructor(
    /**
     * @internal
     * @private
     **/
    _firestore, 
    /**
     * @internal
     * @private
     **/
    _queryOptions) {
        this._firestore = _firestore;
        this._queryOptions = _queryOptions;
        this._serializer = new serializer_1.Serializer(_firestore);
        this._allowUndefined =
            !!this._firestore._settings.ignoreUndefinedProperties;
        this._queryUtil = new query_util_1.QueryUtil(_firestore, _queryOptions, this._serializer);
    }
    /**
     * Extracts field values from the DocumentSnapshot based on the provided
     * field order.
     *
     * @private
     * @internal
     * @param documentSnapshot The document to extract the fields from.
     * @param fieldOrders The field order that defines what fields we should
     * extract.
     * @return {Array.<*>} The field values to use.
     */
    static _extractFieldValues(documentSnapshot, fieldOrders) {
        const fieldValues = [];
        for (const fieldOrder of fieldOrders) {
            if (index_1.FieldPath.documentId().isEqual(fieldOrder.field)) {
                fieldValues.push(documentSnapshot.ref);
            }
            else {
                const fieldValue = documentSnapshot.get(fieldOrder.field);
                if (fieldValue === undefined) {
                    throw new Error(`Field "${fieldOrder.field}" is missing in the provided DocumentSnapshot. ` +
                        'Please provide a document that contains values for all specified ' +
                        'orderBy() and where() constraints.');
                }
                else {
                    fieldValues.push(fieldValue);
                }
            }
        }
        return fieldValues;
    }
    /**
     * The [Firestore]{@link Firestore} instance for the Firestore
     * database (useful for performing transactions, etc.).
     *
     * @type {Firestore}
     * @name Query#firestore
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   let firestore = documentReference.firestore;
     *   console.log(`Root location for document is ${firestore.formattedName}`);
     * });
     * ```
     */
    get firestore() {
        return this._firestore;
    }
    where(fieldPathOrFilter, opStr, value) {
        let filter;
        if (fieldPathOrFilter instanceof index_1.Filter) {
            filter = fieldPathOrFilter;
        }
        else {
            filter = index_1.Filter.where(fieldPathOrFilter, opStr, value);
        }
        if (this._queryOptions.startAt || this._queryOptions.endAt) {
            throw new Error('Cannot specify a where() filter after calling startAt(), ' +
                'startAfter(), endBefore() or endAt().');
        }
        const parsedFilter = this._parseFilter(filter);
        if (parsedFilter.getFilters().length === 0) {
            // Return the existing query if not adding any more filters (e.g. an empty composite filter).
            return this;
        }
        const options = this._queryOptions.with({
            filters: this._queryOptions.filters.concat(parsedFilter),
        });
        return new Query(this._firestore, options);
    }
    /**
     * @internal
     * @private
     */
    _parseFilter(filter) {
        if (filter instanceof filter_1.UnaryFilter) {
            return this._parseFieldFilter(filter);
        }
        return this._parseCompositeFilter(filter);
    }
    /**
     * @internal
     * @private
     */
    _parseFieldFilter(fieldFilterData) {
        let value = fieldFilterData._getValue();
        let operator = fieldFilterData._getOperator();
        const fieldPath = fieldFilterData._getField();
        (0, path_1.validateFieldPath)('fieldPath', fieldPath);
        operator = (0, helpers_1.validateQueryOperator)('opStr', operator, value);
        (0, helpers_1.validateQueryValue)('value', value, this._allowUndefined);
        const path = index_1.FieldPath.fromArgument(fieldPath);
        if (index_1.FieldPath.documentId().isEqual(path)) {
            if (operator === 'array-contains' || operator === 'array-contains-any') {
                throw new Error(`Invalid Query. You can't perform '${operator}' ` +
                    'queries on FieldPath.documentId().');
            }
            else if (operator === 'in' || operator === 'not-in') {
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error(`Invalid Query. A non-empty array is required for '${operator}' filters.`);
                }
                value = value.map(el => this.validateReference(el));
            }
            else {
                value = this.validateReference(value);
            }
        }
        return new field_filter_internal_1.FieldFilterInternal(this._serializer, path, constants_1.comparisonOperators[operator], value);
    }
    /**
     * @internal
     * @private
     */
    _parseCompositeFilter(compositeFilterData) {
        const parsedFilters = compositeFilterData
            ._getFilters()
            .map(filter => this._parseFilter(filter))
            .filter(parsedFilter => parsedFilter.getFilters().length > 0);
        // For composite filters containing 1 filter, return the only filter.
        // For example: AND(FieldFilter1) == FieldFilter1
        if (parsedFilters.length === 1) {
            return parsedFilters[0];
        }
        return new composite_filter_internal_1.CompositeFilterInternal(parsedFilters, compositeFilterData._getOperator() === 'AND' ? 'AND' : 'OR');
    }
    /**
     * Creates and returns a new [Query]{@link Query} instance that applies a
     * field mask to the result and returns only the specified subset of fields.
     * You can specify a list of field paths to return, or use an empty list to
     * only return the references of matching documents.
     *
     * Queries that contain field masks cannot be listened to via `onSnapshot()`
     * listeners.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the field mask.
     *
     * @param {...(string|FieldPath)} fieldPaths The field paths to return.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     * let documentRef = collectionRef.doc('doc');
     *
     * return documentRef.set({x:10, y:5}).then(() => {
     *   return collectionRef.where('x', '>', 5).select('y').get();
     * }).then((res) => {
     *   console.log(`y is ${res.docs[0].get('y')}.`);
     * });
     * ```
     */
    select(...fieldPaths) {
        const fields = [];
        if (fieldPaths.length === 0) {
            fields.push({ fieldPath: index_1.FieldPath.documentId().formattedName });
        }
        else {
            for (let i = 0; i < fieldPaths.length; ++i) {
                (0, path_1.validateFieldPath)(i, fieldPaths[i]);
                fields.push({
                    fieldPath: index_1.FieldPath.fromArgument(fieldPaths[i]).formattedName,
                });
            }
        }
        // By specifying a field mask, the query result no longer conforms to type
        // `T`. We there return `Query<DocumentData>`;
        const options = this._queryOptions.with({
            projection: { fields },
        });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that's additionally sorted
     * by the specified field, optionally in descending order instead of
     * ascending.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the field mask.
     *
     * @param {string|FieldPath} fieldPath The field to sort by.
     * @param {string=} directionStr Optional direction to sort by ('asc' or
     * 'desc'). If not specified, order will be ascending.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.orderBy('foo', 'desc').get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    orderBy(fieldPath, directionStr) {
        (0, path_1.validateFieldPath)('fieldPath', fieldPath);
        directionStr = (0, helpers_1.validateQueryOrder)('directionStr', directionStr);
        if (this._queryOptions.startAt || this._queryOptions.endAt) {
            throw new Error('Cannot specify an orderBy() constraint after calling ' +
                'startAt(), startAfter(), endBefore() or endAt().');
        }
        const newOrder = new field_order_1.FieldOrder(index_1.FieldPath.fromArgument(fieldPath), constants_1.directionOperators[directionStr || 'asc']);
        const options = this._queryOptions.with({
            fieldOrders: this._queryOptions.fieldOrders.concat(newOrder),
        });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that only returns the
     * first matching documents.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the limit.
     *
     * @param {number} limit The maximum number of items to return.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limit(1).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    limit(limit) {
        (0, validate_1.validateInteger)('limit', limit);
        const options = this._queryOptions.with({
            limit,
            limitType: types_1.LimitType.First,
        });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that only returns the
     * last matching documents.
     *
     * You must specify at least one orderBy clause for limitToLast queries,
     * otherwise an exception will be thrown during execution.
     *
     * Results for limitToLast queries cannot be streamed via the `stream()` API.
     *
     * @param limit The maximum number of items to return.
     * @return The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limitToLast(1).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Last matching document is ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    limitToLast(limit) {
        (0, validate_1.validateInteger)('limitToLast', limit);
        const options = this._queryOptions.with({ limit, limitType: types_1.LimitType.Last });
        return new Query(this._firestore, options);
    }
    /**
     * Specifies the offset of the returned results.
     *
     * This function returns a new (immutable) instance of the
     * [Query]{@link Query} (rather than modify the existing instance)
     * to impose the offset.
     *
     * @param {number} offset The offset to apply to the Query results
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limit(10).offset(20).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    offset(offset) {
        (0, validate_1.validateInteger)('offset', offset);
        const options = this._queryOptions.with({ offset });
        return new Query(this._firestore, options);
    }
    /**
     * Returns a query that counts the documents in the result set of this
     * query.
     *
     * The returned query, when executed, counts the documents in the result set
     * of this query without actually downloading the documents.
     *
     * Using the returned query to count the documents is efficient because only
     * the final count, not the documents' data, is downloaded. The returned
     * query can count the documents in cases where the result set is
     * prohibitively large to download entirely (thousands of documents).
     *
     * @return a query that counts the documents in the result set of this
     * query. The count can be retrieved from `snapshot.data().count`, where
     * `snapshot` is the `AggregateQuerySnapshot` resulting from running the
     * returned query.
     */
    count() {
        return this.aggregate({
            count: index_1.AggregateField.count(),
        });
    }
    /**
     * Returns a query that can perform the given aggregations.
     *
     * The returned query, when executed, calculates the specified aggregations
     * over the documents in the result set of this query without actually
     * downloading the documents.
     *
     * Using the returned query to perform aggregations is efficient because only
     * the final aggregation values, not the documents' data, is downloaded. The
     * returned query can perform aggregations of the documents count the
     * documents in cases where the result set is prohibitively large to download
     * entirely (thousands of documents).
     *
     * @param aggregateSpec An `AggregateSpec` object that specifies the aggregates
     * to perform over the result set. The AggregateSpec specifies aliases for each
     * aggregate, which can be used to retrieve the aggregate result.
     * @example
     * ```typescript
     * const aggregateQuery = col.aggregate(query, {
     *   countOfDocs: count(),
     *   totalHours: sum('hours'),
     *   averageScore: average('score')
     * });
     *
     * const aggregateSnapshot = await aggregateQuery.get();
     * const countOfDocs: number = aggregateSnapshot.data().countOfDocs;
     * const totalHours: number = aggregateSnapshot.data().totalHours;
     * const averageScore: number | null = aggregateSnapshot.data().averageScore;
     * ```
     */
    aggregate(aggregateSpec) {
        return new aggregate_query_1.AggregateQuery(this, aggregateSpec);
    }
    findNearest(vectorFieldOrOptions, queryVector, options) {
        if (typeof vectorFieldOrOptions === 'string' ||
            vectorFieldOrOptions instanceof index_1.FieldPath) {
            const vqOptions = {
                distanceMeasure: options.distanceMeasure,
                limit: options.limit,
                queryVector: queryVector,
                vectorField: vectorFieldOrOptions,
            };
            return this._findNearest(vqOptions);
        }
        else {
            return this._findNearest(vectorFieldOrOptions);
        }
    }
    _findNearest(options) {
        (0, path_1.validateFieldPath)('vectorField', options.vectorField);
        if (options.limit <= 0) {
            throw (0, validate_1.invalidArgumentMessage)('limit', 'positive limit number');
        }
        if ((Array.isArray(options.queryVector)
            ? options.queryVector.length
            : options.queryVector.toArray().length) === 0) {
            throw (0, validate_1.invalidArgumentMessage)('queryVector', 'vector size must be larger than 0');
        }
        return new vector_query_1.VectorQuery(this, options);
    }
    /**
     * Returns true if this `Query` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `Query` is equal to the provided value.
     */
    isEqual(other) {
        if (this === other) {
            return true;
        }
        return (other instanceof Query && this._queryOptions.isEqual(other._queryOptions));
    }
    /**
     * Returns the sorted array of inequality filter fields used in this query.
     *
     * @return An array of inequality filter fields sorted lexicographically by FieldPath.
     */
    getInequalityFilterFields() {
        const inequalityFields = [];
        for (const filter of this._queryOptions.filters) {
            for (const subFilter of filter.getFlattenedFilters()) {
                if (subFilter.isInequalityFilter()) {
                    inequalityFields.push(subFilter.field);
                }
            }
        }
        return inequalityFields.sort((a, b) => a.compareTo(b));
    }
    /**
     * Computes the backend ordering semantics for DocumentSnapshot cursors.
     *
     * @private
     * @internal
     * @param cursorValuesOrDocumentSnapshot The snapshot of the document or the
     * set of field values to use as the boundary.
     * @returns The implicit ordering semantics.
     */
    createImplicitOrderBy(cursorValuesOrDocumentSnapshot) {
        // Add an implicit orderBy if the only cursor value is a DocumentSnapshot.
        if (cursorValuesOrDocumentSnapshot.length !== 1 ||
            !(cursorValuesOrDocumentSnapshot[0] instanceof index_1.DocumentSnapshot)) {
            return this._queryOptions.fieldOrders;
        }
        const fieldOrders = this._queryOptions.fieldOrders.slice();
        const fieldsNormalized = new Set([
            ...fieldOrders.map(item => item.field.toString()),
        ]);
        /** The order of the implicit ordering always matches the last explicit order by. */
        const lastDirection = fieldOrders.length === 0
            ? constants_1.directionOperators.ASC
            : fieldOrders[fieldOrders.length - 1].direction;
        /**
         * Any inequality fields not explicitly ordered should be implicitly ordered in a
         * lexicographical order. When there are multiple inequality filters on the same field, the
         * field should be added only once.
         * Note: getInequalityFilterFields function sorts the key field before
         * other fields. However, we want the key field to be sorted last.
         */
        const inequalityFields = this.getInequalityFilterFields();
        for (const field of inequalityFields) {
            if (!fieldsNormalized.has(field.toString()) &&
                !field.isEqual(index_1.FieldPath.documentId())) {
                fieldOrders.push(new field_order_1.FieldOrder(field, lastDirection));
                fieldsNormalized.add(field.toString());
            }
        }
        // Add the document key field to the last if it is not explicitly ordered.
        if (!fieldsNormalized.has(index_1.FieldPath.documentId().toString())) {
            fieldOrders.push(new field_order_1.FieldOrder(index_1.FieldPath.documentId(), lastDirection));
        }
        return fieldOrders;
    }
    /**
     * Builds a Firestore 'Position' proto message.
     *
     * @private
     * @internal
     * @param {Array.<FieldOrder>} fieldOrders The field orders to use for this
     * cursor.
     * @param {Array.<DocumentSnapshot|*>} cursorValuesOrDocumentSnapshot The
     * snapshot of the document or the set of field values to use as the boundary.
     * @param before Whether the query boundary lies just before or after the
     * provided data.
     * @returns {Object} The proto message.
     */
    createCursor(fieldOrders, cursorValuesOrDocumentSnapshot, before) {
        let fieldValues;
        if (cursorValuesOrDocumentSnapshot.length === 1 &&
            cursorValuesOrDocumentSnapshot[0] instanceof index_1.DocumentSnapshot) {
            fieldValues = Query._extractFieldValues(cursorValuesOrDocumentSnapshot[0], fieldOrders);
        }
        else {
            fieldValues = cursorValuesOrDocumentSnapshot;
        }
        if (fieldValues.length > fieldOrders.length) {
            throw new Error('Too many cursor values specified. The specified ' +
                'values must match the orderBy() constraints of the query.');
        }
        const options = { values: [], before };
        for (let i = 0; i < fieldValues.length; ++i) {
            let fieldValue = fieldValues[i];
            if (index_1.FieldPath.documentId().isEqual(fieldOrders[i].field)) {
                fieldValue = this.validateReference(fieldValue);
            }
            (0, helpers_1.validateQueryValue)(i, fieldValue, this._allowUndefined);
            options.values.push(this._serializer.encodeValue(fieldValue));
        }
        return options;
    }
    /**
     * Validates that a value used with FieldValue.documentId() is either a
     * string or a DocumentReference that is part of the query`s result set.
     * Throws a validation error or returns a DocumentReference that can
     * directly be used in the Query.
     *
     * @param val The value to validate.
     * @throws If the value cannot be used for this query.
     * @return If valid, returns a DocumentReference that can be used with the
     * query.
     * @private
     * @internal
     */
    validateReference(val) {
        const basePath = this._queryOptions.allDescendants
            ? this._queryOptions.parentPath
            : this._queryOptions.parentPath.append(this._queryOptions.collectionId);
        let reference;
        if (typeof val === 'string') {
            const path = basePath.append(val);
            if (this._queryOptions.allDescendants) {
                if (!path.isDocument) {
                    throw new Error('When querying a collection group and ordering by ' +
                        'FieldPath.documentId(), the corresponding value must result in ' +
                        `a valid document path, but '${val}' is not because it ` +
                        'contains an odd number of segments.');
                }
            }
            else if (val.indexOf('/') !== -1) {
                throw new Error('When querying a collection and ordering by FieldPath.documentId(), ' +
                    `the corresponding value must be a plain document ID, but '${val}' ` +
                    'contains a slash.');
            }
            reference = new document_reference_1.DocumentReference(this._firestore, basePath.append(val), this._queryOptions.converter);
        }
        else if (val instanceof document_reference_1.DocumentReference) {
            reference = val;
            if (!basePath.isPrefixOf(reference._path)) {
                throw new Error(`"${reference.path}" is not part of the query result set and ` +
                    'cannot be used as a query boundary.');
            }
        }
        else {
            throw new Error('The corresponding value for FieldPath.documentId() must be a ' +
                `string or a DocumentReference, but was "${val}".`);
        }
        if (!this._queryOptions.allDescendants &&
            reference._path.parent().compareTo(basePath) !== 0) {
            throw new Error('Only a direct child can be used as a query boundary. ' +
                `Found: "${reference.path}".`);
        }
        return reference;
    }
    /**
     * Creates and returns a new [Query]{@link Query} that starts at the provided
     * set of field values relative to the order of the query. The order of the
     * provided values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should start at or the field values to
     * start this query at, in order of the query's order by.
     * @returns {Query} A query with the new starting point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').startAt(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    startAt(...fieldValuesOrDocumentSnapshot) {
        (0, validate_1.validateMinNumberOfArguments)('Query.startAt', fieldValuesOrDocumentSnapshot, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const startAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, true);
        const options = this._queryOptions.with({ fieldOrders, startAt });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that starts after the
     * provided set of field values relative to the order of the query. The order
     * of the provided values must match the order of the order by clauses of the
     * query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should start after or the field values to
     * start this query after, in order of the query's order by.
     * @returns {Query} A query with the new starting point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').startAfter(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    startAfter(...fieldValuesOrDocumentSnapshot) {
        (0, validate_1.validateMinNumberOfArguments)('Query.startAfter', fieldValuesOrDocumentSnapshot, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const startAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, false);
        const options = this._queryOptions.with({ fieldOrders, startAt });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that ends before the set of
     * field values relative to the order of the query. The order of the provided
     * values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should end before or the field values to
     * end this query before, in order of the query's order by.
     * @returns {Query} A query with the new ending point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').endBefore(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    endBefore(...fieldValuesOrDocumentSnapshot) {
        (0, validate_1.validateMinNumberOfArguments)('Query.endBefore', fieldValuesOrDocumentSnapshot, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const endAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, true);
        const options = this._queryOptions.with({ fieldOrders, endAt });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that ends at the provided
     * set of field values relative to the order of the query. The order of the
     * provided values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should end at or the field values to end
     * this query at, in order of the query's order by.
     * @returns {Query} A query with the new ending point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').endAt(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    endAt(...fieldValuesOrDocumentSnapshot) {
        (0, validate_1.validateMinNumberOfArguments)('Query.endAt', fieldValuesOrDocumentSnapshot, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const endAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, false);
        const options = this._queryOptions.with({ fieldOrders, endAt });
        return new Query(this._firestore, options);
    }
    /**
     * Executes the query and returns the results as a
     * [QuerySnapshot]{@link QuerySnapshot}.
     *
     * @returns {Promise.<QuerySnapshot>} A Promise that resolves with the results
     * of the Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    async get() {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_QUERY_GET, async () => {
            const { result } = await this._get();
            return result;
        });
    }
    /**
     * Plans and optionally executes this query. Returns a Promise that will be
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
        const { result, explainMetrics } = await this._getResponse(undefined, options);
        if (!explainMetrics) {
            throw new Error('No explain results');
        }
        return new query_profile_1.ExplainResults(explainMetrics, result || null);
    }
    /**
     * Internal get() method that accepts an optional transaction options, and
     * returns a query snapshot with transaction and explain metadata.
     *
     * @private
     * @internal
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     */
    async _get(transactionOrReadTime) {
        const result = await this._getResponse(transactionOrReadTime);
        if (!result.result) {
            throw new Error('No QuerySnapshot result');
        }
        return result;
    }
    _getResponse(transactionOrReadTime, explainOptions) {
        return this._queryUtil._getResponse(this, transactionOrReadTime, true, explainOptions);
    }
    /**
     * Executes the query and streams the results as
     * [QueryDocumentSnapshots]{@link QueryDocumentSnapshot}.
     *
     * @returns {Stream.<QueryDocumentSnapshot>} A stream of
     * QueryDocumentSnapshots.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let count = 0;
     *
     * query.stream().on('data', (documentSnapshot) => {
     *   console.log(`Found document with name '${documentSnapshot.id}'`);
     *   ++count;
     * }).on('end', () => {
     *   console.log(`Total count is ${count}`);
     * });
     * ```
     */
    stream() {
        return this._queryUtil.stream(this);
    }
    /**
     * Executes the query and streams the results as the following object:
     * {document?: DocumentSnapshot, metrics?: ExplainMetrics}
     *
     * The stream surfaces documents one at a time as they are received from the
     * server, and at the end, it will surface the metrics associated with
     * executing the query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let count = 0;
     *
     * query.explainStream({analyze: true}).on('data', (data) => {
     *   if (data.document) {
     *     // Use data.document which is a DocumentSnapshot instance.
     *     console.log(`Found document with name '${data.document.id}'`);
     *     ++count;
     *   }
     *   if (data.metrics) {
     *     // Use data.metrics which is an ExplainMetrics instance.
     *   }
     * }).on('end', () => {
     *   console.log(`Received ${count} documents.`);
     * });
     * ```
     */
    explainStream(explainOptions) {
        if (explainOptions === undefined) {
            explainOptions = {};
        }
        if (this._queryOptions.limitType === types_1.LimitType.Last) {
            throw new Error('Query results for queries that include limitToLast() ' +
                'constraints cannot be streamed. Use Query.explain() instead.');
        }
        const responseStream = this._stream(undefined, explainOptions);
        const transform = new stream_1.Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                if (chunk.document || chunk.explainMetrics) {
                    callback(undefined, {
                        document: chunk.document,
                        metrics: chunk.explainMetrics,
                    });
                }
            },
        });
        responseStream.pipe(transform);
        responseStream.on('error', e => transform.destroy(e));
        return transform;
    }
    /**
     * Converts a QueryCursor to its proto representation.
     *
     * @param cursor The original cursor value
     * @private
     * @internal
     */
    toCursor(cursor) {
        if (cursor) {
            return cursor.before
                ? { before: true, values: cursor.values }
                : { values: cursor.values };
        }
        return undefined;
    }
    /**
     * Internal method for serializing a query to its RunQuery proto
     * representation with an optional transaction id or read time.
     *
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     * @param explainOptions Options to use for explaining the query (if any).
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    toProto(transactionOrReadTime, explainOptions) {
        const projectId = this.firestore.projectId;
        const databaseId = this.firestore.databaseId;
        const parentPath = this._queryOptions.parentPath.toQualifiedResourcePath(projectId, databaseId);
        const structuredQuery = this.toStructuredQuery();
        // For limitToLast queries, the structured query has to be translated to a version with
        // reversed ordered, and flipped startAt/endAt to work properly.
        if (this._queryOptions.limitType === types_1.LimitType.Last) {
            if (!this._queryOptions.hasFieldOrders()) {
                throw new Error('limitToLast() queries require specifying at least one orderBy() clause.');
            }
            structuredQuery.orderBy = this._queryOptions.fieldOrders.map(order => {
                // Flip the orderBy directions since we want the last results
                const dir = order.direction === 'DESCENDING' ? 'ASCENDING' : 'DESCENDING';
                return new field_order_1.FieldOrder(order.field, dir).toProto();
            });
            // Swap the cursors to match the now-flipped query ordering.
            structuredQuery.startAt = this._queryOptions.endAt
                ? this.toCursor({
                    values: this._queryOptions.endAt.values,
                    before: !this._queryOptions.endAt.before,
                })
                : undefined;
            structuredQuery.endAt = this._queryOptions.startAt
                ? this.toCursor({
                    values: this._queryOptions.startAt.values,
                    before: !this._queryOptions.startAt.before,
                })
                : undefined;
        }
        const runQueryRequest = {
            parent: parentPath.formattedName,
            structuredQuery,
        };
        if (transactionOrReadTime instanceof Uint8Array) {
            runQueryRequest.transaction = transactionOrReadTime;
        }
        else if (transactionOrReadTime instanceof index_1.Timestamp) {
            runQueryRequest.readTime = transactionOrReadTime.toProto().timestampValue;
        }
        else if (transactionOrReadTime) {
            runQueryRequest.newTransaction = transactionOrReadTime;
        }
        if (explainOptions) {
            runQueryRequest.explainOptions = explainOptions;
        }
        return runQueryRequest;
    }
    /**
     * Converts current Query to an IBundledQuery.
     *
     * @private
     * @internal
     */
    _toBundledQuery() {
        const projectId = this.firestore.projectId;
        const databaseId = this.firestore.databaseId;
        const parentPath = this._queryOptions.parentPath.toQualifiedResourcePath(projectId, databaseId);
        const structuredQuery = this.toStructuredQuery();
        const bundledQuery = {
            parent: parentPath.formattedName,
            structuredQuery,
        };
        if (this._queryOptions.limitType === types_1.LimitType.First) {
            bundledQuery.limitType = 'FIRST';
        }
        else if (this._queryOptions.limitType === types_1.LimitType.Last) {
            bundledQuery.limitType = 'LAST';
        }
        return bundledQuery;
    }
    toStructuredQuery() {
        const structuredQuery = {
            from: [{}],
        };
        if (this._queryOptions.allDescendants) {
            structuredQuery.from[0].allDescendants = true;
        }
        // Kindless queries select all descendant documents, so we remove the
        // collectionId field.
        if (!this._queryOptions.kindless) {
            structuredQuery.from[0].collectionId = this._queryOptions.collectionId;
        }
        if (this._queryOptions.filters.length >= 1) {
            structuredQuery.where = new composite_filter_internal_1.CompositeFilterInternal(this._queryOptions.filters, 'AND').toProto();
        }
        if (this._queryOptions.hasFieldOrders()) {
            structuredQuery.orderBy = this._queryOptions.fieldOrders.map(o => o.toProto());
        }
        structuredQuery.startAt = this.toCursor(this._queryOptions.startAt);
        structuredQuery.endAt = this.toCursor(this._queryOptions.endAt);
        if (this._queryOptions.limit) {
            structuredQuery.limit = { value: this._queryOptions.limit };
        }
        structuredQuery.offset = this._queryOptions.offset;
        structuredQuery.select = this._queryOptions.projection;
        return structuredQuery;
    }
    /**
     * @internal
     * @private
     * This method exists solely to maintain backward compatability.
     */
    _isPermanentRpcError(err, methodName) {
        return this._queryUtil._isPermanentRpcError(err, methodName);
    }
    /**
     * @internal
     * @private
     * This method exists solely to maintain backward compatability.
     */
    _hasRetryTimedOut(methodName, startTime) {
        return this._queryUtil._hasRetryTimedOut(methodName, startTime);
    }
    /**
     * Internal streaming method that accepts an optional transaction ID.
     *
     * BEWARE: If `transactionOrReadTime` is `ITransactionOptions`, then the first
     * response in the stream will be a transaction response.
     *
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     * @param explainOptions Options to use for explaining the query (if any).
     * @private
     * @internal
     * @returns A stream of document results, optionally preceded by a transaction response.
     */
    _stream(transactionOrReadTime, explainOptions) {
        return this._queryUtil._stream(this, transactionOrReadTime, true, explainOptions);
    }
    /**
     * Attaches a listener for QuerySnapshot events.
     *
     * @param {querySnapshotCallback} onNext A callback to be called every time
     * a new [QuerySnapshot]{@link QuerySnapshot} is available.
     * @param {errorCallback=} onError A callback to be called if the listen
     * fails or is cancelled. No further callbacks will occur.
     *
     * @returns {function()} An unsubscribe function that can be called to cancel
     * the snapshot listener.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let unsubscribe = query.onSnapshot(querySnapshot => {
     *   console.log(`Received query snapshot of size ${querySnapshot.size}`);
     * }, err => {
     *   console.log(`Encountered error: ${err}`);
     * });
     *
     * // Remove this listener.
     * unsubscribe();
     * ```
     */
    onSnapshot(onNext, onError) {
        (0, validate_1.validateFunction)('onNext', onNext);
        (0, validate_1.validateFunction)('onError', onError, { optional: true });
        const watch = new (require('../watch').QueryWatch)(this.firestore, this, this._queryOptions.converter);
        return watch.onSnapshot((readTime, size, docs, changes) => {
            onNext(new query_snapshot_1.QuerySnapshot(this, readTime, size, docs, changes));
        }, onError || console.error);
    }
    /**
     * Returns a function that can be used to sort QueryDocumentSnapshots
     * according to the sort criteria of this query.
     *
     * @private
     * @internal
     */
    comparator() {
        return (doc1, doc2) => {
            // Add implicit sorting by name, using the last specified direction.
            const lastDirection = this._queryOptions.hasFieldOrders()
                ? this._queryOptions.fieldOrders[this._queryOptions.fieldOrders.length - 1].direction
                : 'ASCENDING';
            const orderBys = this._queryOptions.fieldOrders.concat(new field_order_1.FieldOrder(index_1.FieldPath.documentId(), lastDirection));
            for (const orderBy of orderBys) {
                let comp;
                if (index_1.FieldPath.documentId().isEqual(orderBy.field)) {
                    comp = doc1.ref._path.compareTo(doc2.ref._path);
                }
                else {
                    const v1 = doc1.protoField(orderBy.field);
                    const v2 = doc2.protoField(orderBy.field);
                    if (v1 === undefined || v2 === undefined) {
                        throw new Error('Trying to compare documents on fields that ' +
                            "don't exist. Please include the fields you are ordering on " +
                            'in your select() call.');
                    }
                    comp = (0, order_1.compare)(v1, v2);
                }
                if (comp !== 0) {
                    const direction = orderBy.direction === 'ASCENDING' ? 1 : -1;
                    return direction * comp;
                }
            }
            return 0;
        };
    }
    /**
     * Applies a custom data converter to this Query, allowing you to use your
     * own custom model objects with Firestore. When you call get() on the
     * returned Query, the provided converter will convert between Firestore
     * data of type `NewDbModelType` and your custom type `NewAppModelType`.
     *
     * Using the converter allows you to specify generic type arguments when
     * storing and retrieving objects from Firestore.
     *
     * Passing in `null` as the converter parameter removes the current
     * converter.
     *
     * @example
     * ```
     * class Post {
     *   constructor(readonly title: string, readonly author: string) {}
     *
     *   toString(): string {
     *     return this.title + ', by ' + this.author;
     *   }
     * }
     *
     * const postConverter = {
     *   toFirestore(post: Post): FirebaseFirestore.DocumentData {
     *     return {title: post.title, author: post.author};
     *   },
     *   fromFirestore(
     *     snapshot: FirebaseFirestore.QueryDocumentSnapshot
     *   ): Post {
     *     const data = snapshot.data();
     *     return new Post(data.title, data.author);
     *   }
     * };
     *
     * const postSnap = await Firestore()
     *   .collection('posts')
     *   .withConverter(postConverter)
     *   .doc().get();
     * const post = postSnap.data();
     * if (post !== undefined) {
     *   post.title; // string
     *   post.toString(); // Should be defined
     *   post.someNonExistentProperty; // TS error
     * }
     *
     * ```
     * @param {FirestoreDataConverter | null} converter Converts objects to and
     * from Firestore. Passing in `null` removes the current converter.
     * @return A Query that uses the provided converter.
     */
    withConverter(converter) {
        return new Query(this.firestore, this._queryOptions.withConverter(converter !== null && converter !== void 0 ? converter : (0, types_2.defaultConverter)()));
    }
    /**
     * Construct the resulting snapshot for this query with given documents.
     *
     * @private
     * @internal
     */
    _createSnapshot(readTime, size, docs, changes) {
        return new query_snapshot_1.QuerySnapshot(this, readTime, size, docs, changes);
    }
}
exports.Query = Query;
//# sourceMappingURL=query.js.map