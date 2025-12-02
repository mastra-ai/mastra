"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.BooleanQuery = exports.MultiMatchQuery = exports.BoostQuery = exports.PhraseQuery = exports.MatchQuery = exports.Occur = exports.Operator = exports.FullTextQueryType = exports.Query = exports.TakeQuery = exports.VectorQuery = exports.StandardQueryBase = exports.QueryBase = void 0;
exports.RecordBatchIterator = RecordBatchIterator;
exports.instanceOfFullTextQuery = instanceOfFullTextQuery;
const arrow_1 = require("./arrow");
const native_1 = require("./native");
async function* RecordBatchIterator(promisedInner) {
    const inner = await promisedInner;
    if (inner === undefined) {
        throw new Error("Invalid iterator state");
    }
    for (let buffer = await inner.next(); buffer; buffer = await inner.next()) {
        const { batches } = (0, arrow_1.tableFromIPC)(buffer);
        if (batches.length !== 1) {
            throw new Error("Expected only one batch");
        }
        yield batches[0];
    }
}
class RecordBatchIterable {
    inner;
    options;
    constructor(inner, options) {
        this.inner = inner;
        this.options = options;
    }
    // biome-ignore lint/suspicious/noExplicitAny: skip
    [Symbol.asyncIterator]() {
        return RecordBatchIterator(this.inner.execute(this.options?.maxBatchLength, this.options?.timeoutMs));
    }
}
/** Common methods supported by all query types
 *
 * @see {@link Query}
 * @see {@link VectorQuery}
 *
 * @hideconstructor
 */
class QueryBase {
    inner;
    /**
     * @hidden
     */
    constructor(inner) {
        this.inner = inner;
        // intentionally empty
    }
    // call a function on the inner (either a promise or the actual object)
    /**
     * @hidden
     */
    doCall(fn) {
        if (this.inner instanceof Promise) {
            this.inner = this.inner.then((inner) => {
                fn(inner);
                return inner;
            });
        }
        else {
            fn(this.inner);
        }
    }
    /**
     * Return only the specified columns.
     *
     * By default a query will return all columns from the table.  However, this can have
     * a very significant impact on latency.  LanceDb stores data in a columnar fashion.  This
     * means we can finely tune our I/O to select exactly the columns we need.
     *
     * As a best practice you should always limit queries to the columns that you need.  If you
     * pass in an array of column names then only those columns will be returned.
     *
     * You can also use this method to create new "dynamic" columns based on your existing columns.
     * For example, you may not care about "a" or "b" but instead simply want "a + b".  This is often
     * seen in the SELECT clause of an SQL query (e.g. `SELECT a+b FROM my_table`).
     *
     * To create dynamic columns you can pass in a Map<string, string>.  A column will be returned
     * for each entry in the map.  The key provides the name of the column.  The value is
     * an SQL string used to specify how the column is calculated.
     *
     * For example, an SQL query might state `SELECT a + b AS combined, c`.  The equivalent
     * input to this method would be:
     * @example
     * new Map([["combined", "a + b"], ["c", "c"]])
     *
     * Columns will always be returned in the order given, even if that order is different than
     * the order used when adding the data.
     *
     * Note that you can pass in a `Record<string, string>` (e.g. an object literal). This method
     * uses `Object.entries` which should preserve the insertion order of the object.  However,
     * object insertion order is easy to get wrong and `Map` is more foolproof.
     */
    select(columns) {
        const selectColumns = (columnArray) => {
            this.doCall((inner) => {
                inner.selectColumns(columnArray);
            });
        };
        const selectMapping = (columnTuples) => {
            this.doCall((inner) => {
                inner.select(columnTuples);
            });
        };
        if (typeof columns === "string") {
            selectColumns([columns]);
        }
        else if (Array.isArray(columns)) {
            selectColumns(columns);
        }
        else if (columns instanceof Map) {
            selectMapping(Array.from(columns.entries()));
        }
        else {
            selectMapping(Object.entries(columns));
        }
        return this;
    }
    /**
     * Whether to return the row id in the results.
     *
     * This column can be used to match results between different queries. For
     * example, to match results from a full text search and a vector search in
     * order to perform hybrid search.
     */
    withRowId() {
        this.doCall((inner) => inner.withRowId());
        return this;
    }
    /**
     * @hidden
     */
    nativeExecute(options) {
        if (this.inner instanceof Promise) {
            return this.inner.then((inner) => inner.execute(options?.maxBatchLength, options?.timeoutMs));
        }
        else {
            return this.inner.execute(options?.maxBatchLength, options?.timeoutMs);
        }
    }
    /**
     * Execute the query and return the results as an @see {@link AsyncIterator}
     * of @see {@link RecordBatch}.
     *
     * By default, LanceDb will use many threads to calculate results and, when
     * the result set is large, multiple batches will be processed at one time.
     * This readahead is limited however and backpressure will be applied if this
     * stream is consumed slowly (this constrains the maximum memory used by a
     * single query)
     *
     */
    execute(options) {
        return RecordBatchIterator(this.nativeExecute(options));
    }
    /**
     * @hidden
     */
    // biome-ignore lint/suspicious/noExplicitAny: skip
    [Symbol.asyncIterator]() {
        return RecordBatchIterator(this.nativeExecute());
    }
    /** Collect the results as an Arrow @see {@link ArrowTable}. */
    async toArrow(options) {
        const batches = [];
        let inner;
        if (this.inner instanceof Promise) {
            inner = await this.inner;
        }
        else {
            inner = this.inner;
        }
        for await (const batch of new RecordBatchIterable(inner, options)) {
            batches.push(batch);
        }
        return new arrow_1.Table(batches);
    }
    /** Collect the results as an array of objects. */
    // biome-ignore lint/suspicious/noExplicitAny: arrow.toArrow() returns any[]
    async toArray(options) {
        const tbl = await this.toArrow(options);
        return tbl.toArray();
    }
    /**
     * Generates an explanation of the query execution plan.
     *
     * @example
     * import * as lancedb from "@lancedb/lancedb"
     * const db = await lancedb.connect("./.lancedb");
     * const table = await db.createTable("my_table", [
     *   { vector: [1.1, 0.9], id: "1" },
     * ]);
     * const plan = await table.query().nearestTo([0.5, 0.2]).explainPlan();
     *
     * @param verbose - If true, provides a more detailed explanation. Defaults to false.
     * @returns A Promise that resolves to a string containing the query execution plan explanation.
     */
    async explainPlan(verbose = false) {
        if (this.inner instanceof Promise) {
            return this.inner.then((inner) => inner.explainPlan(verbose));
        }
        else {
            return this.inner.explainPlan(verbose);
        }
    }
    /**
     * Executes the query and returns the physical query plan annotated with runtime metrics.
     *
     * This is useful for debugging and performance analysis, as it shows how the query was executed
     * and includes metrics such as elapsed time, rows processed, and I/O statistics.
     *
     * @example
     * import * as lancedb from "@lancedb/lancedb"
     *
     * const db = await lancedb.connect("./.lancedb");
     * const table = await db.createTable("my_table", [
     *   { vector: [1.1, 0.9], id: "1" },
     * ]);
     *
     * const plan = await table.query().nearestTo([0.5, 0.2]).analyzePlan();
     *
     * Example output (with runtime metrics inlined):
     * AnalyzeExec verbose=true, metrics=[]
     *  ProjectionExec: expr=[id@3 as id, vector@0 as vector, _distance@2 as _distance], metrics=[output_rows=1, elapsed_compute=3.292µs]
     *   Take: columns="vector, _rowid, _distance, (id)", metrics=[output_rows=1, elapsed_compute=66.001µs, batches_processed=1, bytes_read=8, iops=1, requests=1]
     *    CoalesceBatchesExec: target_batch_size=1024, metrics=[output_rows=1, elapsed_compute=3.333µs]
     *     GlobalLimitExec: skip=0, fetch=10, metrics=[output_rows=1, elapsed_compute=167ns]
     *      FilterExec: _distance@2 IS NOT NULL, metrics=[output_rows=1, elapsed_compute=8.542µs]
     *       SortExec: TopK(fetch=10), expr=[_distance@2 ASC NULLS LAST], metrics=[output_rows=1, elapsed_compute=63.25µs, row_replacements=1]
     *        KNNVectorDistance: metric=l2, metrics=[output_rows=1, elapsed_compute=114.333µs, output_batches=1]
     *         LanceScan: uri=/path/to/data, projection=[vector], row_id=true, row_addr=false, ordered=false, metrics=[output_rows=1, elapsed_compute=103.626µs, bytes_read=549, iops=2, requests=2]
     *
     * @returns A query execution plan with runtime metrics for each step.
     */
    async analyzePlan() {
        if (this.inner instanceof Promise) {
            return this.inner.then((inner) => inner.analyzePlan());
        }
        else {
            return this.inner.analyzePlan();
        }
    }
    /**
     * Returns the schema of the output that will be returned by this query.
     *
     * This can be used to inspect the types and names of the columns that will be
     * returned by the query before executing it.
     *
     * @returns An Arrow Schema describing the output columns.
     */
    async outputSchema() {
        let schemaBuffer;
        if (this.inner instanceof Promise) {
            schemaBuffer = await this.inner.then((inner) => inner.outputSchema());
        }
        else {
            schemaBuffer = await this.inner.outputSchema();
        }
        const schema = (0, arrow_1.tableFromIPC)(schemaBuffer).schema;
        return schema;
    }
}
exports.QueryBase = QueryBase;
class StandardQueryBase extends QueryBase {
    constructor(inner) {
        super(inner);
    }
    /**
     * A filter statement to be applied to this query.
     *
     * The filter should be supplied as an SQL query string.  For example:
     * @example
     * x > 10
     * y > 0 AND y < 100
     * x > 5 OR y = 'test'
     *
     * Filtering performance can often be improved by creating a scalar index
     * on the filter column(s).
     */
    where(predicate) {
        this.doCall((inner) => inner.onlyIf(predicate));
        return this;
    }
    /**
     * A filter statement to be applied to this query.
     * @see where
     * @deprecated Use `where` instead
     */
    filter(predicate) {
        return this.where(predicate);
    }
    fullTextSearch(query, options) {
        let columns = null;
        if (options) {
            if (typeof options.columns === "string") {
                columns = [options.columns];
            }
            else if (Array.isArray(options.columns)) {
                columns = options.columns;
            }
        }
        this.doCall((inner) => {
            if (typeof query === "string") {
                inner.fullTextSearch({
                    query: query,
                    columns: columns,
                });
            }
            else {
                inner.fullTextSearch({ query: query.inner });
            }
        });
        return this;
    }
    /**
     * Set the maximum number of results to return.
     *
     * By default, a plain search has no limit.  If this method is not
     * called then every valid row from the table will be returned.
     */
    limit(limit) {
        this.doCall((inner) => inner.limit(limit));
        return this;
    }
    /**
     * Set the number of rows to skip before returning results.
     *
     * This is useful for pagination.
     */
    offset(offset) {
        this.doCall((inner) => inner.offset(offset));
        return this;
    }
    /**
     * Skip searching un-indexed data. This can make search faster, but will miss
     * any data that is not yet indexed.
     *
     * Use {@link Table#optimize} to index all un-indexed data.
     */
    fastSearch() {
        this.doCall((inner) => inner.fastSearch());
        return this;
    }
}
exports.StandardQueryBase = StandardQueryBase;
/**
 * A builder used to construct a vector search
 *
 * This builder can be reused to execute the query many times.
 *
 * @see {@link Query#nearestTo}
 *
 * @hideconstructor
 */
class VectorQuery extends StandardQueryBase {
    /**
     * @hidden
     */
    constructor(inner) {
        super(inner);
    }
    /**
     * Set the number of partitions to search (probe)
     *
     * This argument is only used when the vector column has an IVF PQ index.
     * If there is no index then this value is ignored.
     *
     * The IVF stage of IVF PQ divides the input into partitions (clusters) of
     * related values.
     *
     * The partition whose centroids are closest to the query vector will be
     * exhaustiely searched to find matches.  This parameter controls how many
     * partitions should be searched.
     *
     * Increasing this value will increase the recall of your query but will
     * also increase the latency of your query.  The default value is 20.  This
     * default is good for many cases but the best value to use will depend on
     * your data and the recall that you need to achieve.
     *
     * For best results we recommend tuning this parameter with a benchmark against
     * your actual data to find the smallest possible value that will still give
     * you the desired recall.
     *
     * For more fine grained control over behavior when you have a very narrow filter
     * you can use `minimumNprobes` and `maximumNprobes`.  This method sets both
     * the minimum and maximum to the same value.
     */
    nprobes(nprobes) {
        super.doCall((inner) => inner.nprobes(nprobes));
        return this;
    }
    /**
     * Set the minimum number of probes used.
     *
     * This controls the minimum number of partitions that will be searched.  This
     * parameter will impact every query against a vector index, regardless of the
     * filter.  See `nprobes` for more details.  Higher values will increase recall
     * but will also increase latency.
     */
    minimumNprobes(minimumNprobes) {
        super.doCall((inner) => inner.minimumNprobes(minimumNprobes));
        return this;
    }
    /**
     * Set the maximum number of probes used.
     *
     * This controls the maximum number of partitions that will be searched.  If this
     * number is greater than minimumNprobes then the excess partitions will _only_ be
     * searched if we have not found enough results.  This can be useful when there is
     * a narrow filter to allow these queries to spend more time searching and avoid
     * potential false negatives.
     */
    maximumNprobes(maximumNprobes) {
        super.doCall((inner) => inner.maximumNprobes(maximumNprobes));
        return this;
    }
    /*
     * Set the distance range to use
     *
     * Only rows with distances within range [lower_bound, upper_bound)
     * will be returned.
     *
     * `undefined` means no lower or upper bound.
     */
    distanceRange(lowerBound, upperBound) {
        super.doCall((inner) => inner.distanceRange(lowerBound, upperBound));
        return this;
    }
    /**
     * Set the number of candidates to consider during the search
     *
     * This argument is only used when the vector column has an HNSW index.
     * If there is no index then this value is ignored.
     *
     * Increasing this value will increase the recall of your query but will
     * also increase the latency of your query. The default value is 1.5*limit.
     */
    ef(ef) {
        super.doCall((inner) => inner.ef(ef));
        return this;
    }
    /**
     * Set the vector column to query
     *
     * This controls which column is compared to the query vector supplied in
     * the call to @see {@link Query#nearestTo}
     *
     * This parameter must be specified if the table has more than one column
     * whose data type is a fixed-size-list of floats.
     */
    column(column) {
        super.doCall((inner) => inner.column(column));
        return this;
    }
    /**
     * Set the distance metric to use
     *
     * When performing a vector search we try and find the "nearest" vectors according
     * to some kind of distance metric.  This parameter controls which distance metric to
     * use.  See @see {@link IvfPqOptions.distanceType} for more details on the different
     * distance metrics available.
     *
     * Note: if there is a vector index then the distance type used MUST match the distance
     * type used to train the vector index.  If this is not done then the results will be
     * invalid.
     *
     * By default "l2" is used.
     */
    distanceType(distanceType) {
        super.doCall((inner) => inner.distanceType(distanceType));
        return this;
    }
    /**
     * A multiplier to control how many additional rows are taken during the refine step
     *
     * This argument is only used when the vector column has an IVF PQ index.
     * If there is no index then this value is ignored.
     *
     * An IVF PQ index stores compressed (quantized) values.  They query vector is compared
     * against these values and, since they are compressed, the comparison is inaccurate.
     *
     * This parameter can be used to refine the results.  It can improve both improve recall
     * and correct the ordering of the nearest results.
     *
     * To refine results LanceDb will first perform an ANN search to find the nearest
     * `limit` * `refine_factor` results.  In other words, if `refine_factor` is 3 and
     * `limit` is the default (10) then the first 30 results will be selected.  LanceDb
     * then fetches the full, uncompressed, values for these 30 results.  The results are
     * then reordered by the true distance and only the nearest 10 are kept.
     *
     * Note: there is a difference between calling this method with a value of 1 and never
     * calling this method at all.  Calling this method with any value will have an impact
     * on your search latency.  When you call this method with a `refine_factor` of 1 then
     * LanceDb still needs to fetch the full, uncompressed, values so that it can potentially
     * reorder the results.
     *
     * Note: if this method is NOT called then the distances returned in the _distance column
     * will be approximate distances based on the comparison of the quantized query vector
     * and the quantized result vectors.  This can be considerably different than the true
     * distance between the query vector and the actual uncompressed vector.
     */
    refineFactor(refineFactor) {
        super.doCall((inner) => inner.refineFactor(refineFactor));
        return this;
    }
    /**
     * If this is called then filtering will happen after the vector search instead of
     * before.
     *
     * By default filtering will be performed before the vector search.  This is how
     * filtering is typically understood to work.  This prefilter step does add some
     * additional latency.  Creating a scalar index on the filter column(s) can
     * often improve this latency.  However, sometimes a filter is too complex or scalar
     * indices cannot be applied to the column.  In these cases postfiltering can be
     * used instead of prefiltering to improve latency.
     *
     * Post filtering applies the filter to the results of the vector search.  This means
     * we only run the filter on a much smaller set of data.  However, it can cause the
     * query to return fewer than `limit` results (or even no results) if none of the nearest
     * results match the filter.
     *
     * Post filtering happens during the "refine stage" (described in more detail in
     * @see {@link VectorQuery#refineFactor}).  This means that setting a higher refine
     * factor can often help restore some of the results lost by post filtering.
     */
    postfilter() {
        super.doCall((inner) => inner.postfilter());
        return this;
    }
    /**
     * If this is called then any vector index is skipped
     *
     * An exhaustive (flat) search will be performed.  The query vector will
     * be compared to every vector in the table.  At high scales this can be
     * expensive.  However, this is often still useful.  For example, skipping
     * the vector index can give you ground truth results which you can use to
     * calculate your recall to select an appropriate value for nprobes.
     */
    bypassVectorIndex() {
        super.doCall((inner) => inner.bypassVectorIndex());
        return this;
    }
    /*
     * Add a query vector to the search
     *
     * This method can be called multiple times to add multiple query vectors
     * to the search. If multiple query vectors are added, then they will be searched
     * in parallel, and the results will be concatenated. A column called `query_index`
     * will be added to indicate the index of the query vector that produced the result.
     *
     * Performance wise, this is equivalent to running multiple queries concurrently.
     */
    addQueryVector(vector) {
        if (vector instanceof Promise) {
            const res = (async () => {
                try {
                    const v = await vector;
                    const arr = Float32Array.from(v);
                    //
                    // biome-ignore lint/suspicious/noExplicitAny: we need to get the `inner`, but js has no package scoping
                    const value = this.addQueryVector(arr);
                    const inner = value.inner;
                    return inner;
                }
                catch (e) {
                    return Promise.reject(e);
                }
            })();
            return new VectorQuery(res);
        }
        else {
            super.doCall((inner) => {
                inner.addQueryVector(Float32Array.from(vector));
            });
            return this;
        }
    }
    rerank(reranker) {
        super.doCall((inner) => inner.rerank({
            rerankHybrid: async (_, args) => {
                const vecResults = await (0, arrow_1.fromBufferToRecordBatch)(args.vecResults);
                const ftsResults = await (0, arrow_1.fromBufferToRecordBatch)(args.ftsResults);
                const result = await reranker.rerankHybrid(args.query, vecResults, ftsResults);
                const buffer = (0, arrow_1.fromRecordBatchToBuffer)(result);
                return buffer;
            },
        }));
        return this;
    }
}
exports.VectorQuery = VectorQuery;
/**
 * A query that returns a subset of the rows in the table.
 *
 * @hideconstructor
 */
class TakeQuery extends QueryBase {
    constructor(inner) {
        super(inner);
    }
}
exports.TakeQuery = TakeQuery;
/** A builder for LanceDB queries.
 *
 * @see {@link Table#query}, {@link Table#search}
 *
 * @hideconstructor
 */
class Query extends StandardQueryBase {
    /**
     * @hidden
     */
    constructor(tbl) {
        super(tbl.query());
    }
    /**
     * Find the nearest vectors to the given query vector.
     *
     * This converts the query from a plain query to a vector query.
     *
     * This method will attempt to convert the input to the query vector
     * expected by the embedding model.  If the input cannot be converted
     * then an error will be thrown.
     *
     * By default, there is no embedding model, and the input should be
     * an array-like object of numbers (something that can be used as input
     * to Float32Array.from)
     *
     * If there is only one vector column (a column whose data type is a
     * fixed size list of floats) then the column does not need to be specified.
     * If there is more than one vector column you must use
     * @see {@link VectorQuery#column}  to specify which column you would like
     * to compare with.
     *
     * If no index has been created on the vector column then a vector query
     * will perform a distance comparison between the query vector and every
     * vector in the database and then sort the results.  This is sometimes
     * called a "flat search"
     *
     * For small databases, with a few hundred thousand vectors or less, this can
     * be reasonably fast.  In larger databases you should create a vector index
     * on the column.  If there is a vector index then an "approximate" nearest
     * neighbor search (frequently called an ANN search) will be performed.  This
     * search is much faster, but the results will be approximate.
     *
     * The query can be further parameterized using the returned builder.  There
     * are various ANN search parameters that will let you fine tune your recall
     * accuracy vs search latency.
     *
     * Vector searches always have a `limit`.  If `limit` has not been called then
     * a default `limit` of 10 will be used.  @see {@link Query#limit}
     */
    nearestTo(vector) {
        if (this.inner instanceof Promise) {
            const nativeQuery = this.inner.then(async (inner) => {
                if (vector instanceof Promise) {
                    const arr = await vector.then((v) => Float32Array.from(v));
                    return inner.nearestTo(arr);
                }
                else {
                    return inner.nearestTo(Float32Array.from(vector));
                }
            });
            return new VectorQuery(nativeQuery);
        }
        if (vector instanceof Promise) {
            const res = (async () => {
                try {
                    const v = await vector;
                    const arr = Float32Array.from(v);
                    //
                    // biome-ignore lint/suspicious/noExplicitAny: we need to get the `inner`, but js has no package scoping
                    const value = this.nearestTo(arr);
                    const inner = value.inner;
                    return inner;
                }
                catch (e) {
                    return Promise.reject(e);
                }
            })();
            return new VectorQuery(res);
        }
        else {
            const vectorQuery = this.inner.nearestTo(Float32Array.from(vector));
            return new VectorQuery(vectorQuery);
        }
    }
    nearestToText(query, columns) {
        this.doCall((inner) => {
            if (typeof query === "string") {
                inner.fullTextSearch({
                    query: query,
                    columns: columns,
                });
            }
            else {
                inner.fullTextSearch({ query: query.inner });
            }
        });
        return this;
    }
}
exports.Query = Query;
/**
 * Enum representing the types of full-text queries supported.
 *
 * - `Match`: Performs a full-text search for terms in the query string.
 * - `MatchPhrase`: Searches for an exact phrase match in the text.
 * - `Boost`: Boosts the relevance score of specific terms in the query.
 * - `MultiMatch`: Searches across multiple fields for the query terms.
 */
var FullTextQueryType;
(function (FullTextQueryType) {
    FullTextQueryType["Match"] = "match";
    FullTextQueryType["MatchPhrase"] = "match_phrase";
    FullTextQueryType["Boost"] = "boost";
    FullTextQueryType["MultiMatch"] = "multi_match";
    FullTextQueryType["Boolean"] = "boolean";
})(FullTextQueryType || (exports.FullTextQueryType = FullTextQueryType = {}));
/**
 * Enum representing the logical operators used in full-text queries.
 *
 * - `And`: All terms must match.
 * - `Or`: At least one term must match.
 */
var Operator;
(function (Operator) {
    Operator["And"] = "AND";
    Operator["Or"] = "OR";
})(Operator || (exports.Operator = Operator = {}));
/**
 * Enum representing the occurrence of terms in full-text queries.
 *
 * - `Must`: The term must be present in the document.
 * - `Should`: The term should contribute to the document score, but is not required.
 * - `MustNot`: The term must not be present in the document.
 */
var Occur;
(function (Occur) {
    Occur["Should"] = "SHOULD";
    Occur["Must"] = "MUST";
    Occur["MustNot"] = "MUST_NOT";
})(Occur || (exports.Occur = Occur = {}));
// biome-ignore lint/suspicious/noExplicitAny: we want any here
function instanceOfFullTextQuery(obj) {
    return obj != null && obj.inner instanceof native_1.JsFullTextQuery;
}
class MatchQuery {
    /** @ignore */
    inner;
    /**
     * Creates an instance of MatchQuery.
     *
     * @param query - The text query to search for.
     * @param column - The name of the column to search within.
     * @param options - Optional parameters for the match query.
     *   - `boost`: The boost factor for the query (default is 1.0).
     *   - `fuzziness`: The fuzziness level for the query (default is 0).
     *   - `maxExpansions`: The maximum number of terms to consider for fuzzy matching (default is 50).
     *   - `operator`: The logical operator to use for combining terms in the query (default is "OR").
     *   - `prefixLength`: The number of beginning characters being unchanged for fuzzy matching.
     */
    constructor(query, column, options) {
        let fuzziness = options?.fuzziness;
        if (fuzziness === undefined) {
            fuzziness = 0;
        }
        this.inner = native_1.JsFullTextQuery.matchQuery(query, column, options?.boost ?? 1.0, fuzziness, options?.maxExpansions ?? 50, options?.operator ?? Operator.Or, options?.prefixLength ?? 0);
    }
    queryType() {
        return FullTextQueryType.Match;
    }
}
exports.MatchQuery = MatchQuery;
class PhraseQuery {
    /** @ignore */
    inner;
    /**
     * Creates an instance of `PhraseQuery`.
     *
     * @param query - The phrase to search for in the specified column.
     * @param column - The name of the column to search within.
     * @param options - Optional parameters for the phrase query.
     *   - `slop`: The maximum number of intervening unmatched positions allowed between words in the phrase (default is 0).
     */
    constructor(query, column, options) {
        this.inner = native_1.JsFullTextQuery.phraseQuery(query, column, options?.slop ?? 0);
    }
    queryType() {
        return FullTextQueryType.MatchPhrase;
    }
}
exports.PhraseQuery = PhraseQuery;
class BoostQuery {
    /** @ignore */
    inner;
    /**
     * Creates an instance of BoostQuery.
     * The boost returns documents that match the positive query,
     * but penalizes those that match the negative query.
     * the penalty is controlled by the `negativeBoost` parameter.
     *
     * @param positive - The positive query that boosts the relevance score.
     * @param negative - The negative query that reduces the relevance score.
     * @param options - Optional parameters for the boost query.
     *  - `negativeBoost`: The boost factor for the negative query (default is 0.0).
     */
    constructor(positive, negative, options) {
        this.inner = native_1.JsFullTextQuery.boostQuery(positive.inner, negative.inner, options?.negativeBoost);
    }
    queryType() {
        return FullTextQueryType.Boost;
    }
}
exports.BoostQuery = BoostQuery;
class MultiMatchQuery {
    /** @ignore */
    inner;
    /**
     * Creates an instance of MultiMatchQuery.
     *
     * @param query - The text query to search for across multiple columns.
     * @param columns - An array of column names to search within.
     * @param options - Optional parameters for the multi-match query.
     *  - `boosts`: An array of boost factors for each column (default is 1.0 for all).
     *  - `operator`: The logical operator to use for combining terms in the query (default is "OR").
     */
    constructor(query, columns, options) {
        this.inner = native_1.JsFullTextQuery.multiMatchQuery(query, columns, options?.boosts, options?.operator ?? Operator.Or);
    }
    queryType() {
        return FullTextQueryType.MultiMatch;
    }
}
exports.MultiMatchQuery = MultiMatchQuery;
class BooleanQuery {
    /** @ignore */
    inner;
    /**
     * Creates an instance of BooleanQuery.
     *
     * @param queries - An array of (Occur, FullTextQuery objects) to combine.
     * Occur specifies whether the query must match, or should match.
     */
    constructor(queries) {
        this.inner = native_1.JsFullTextQuery.booleanQuery(queries.map(([occur, query]) => [occur, query.inner]));
    }
    queryType() {
        return FullTextQueryType.Boolean;
    }
}
exports.BooleanQuery = BooleanQuery;
