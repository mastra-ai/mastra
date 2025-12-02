import { DocumentByInfo, GenericTableInfo, IndexNames, NamedIndex, NamedSearchIndex, SearchIndexNames } from "./data_model.js";
import { ExpressionOrValue, FilterBuilder } from "./filter_builder.js";
import { IndexRange, IndexRangeBuilder } from "./index_range_builder.js";
import { PaginationResult, PaginationOptions } from "./pagination.js";
import { SearchFilter, SearchFilterBuilder } from "./search_filter_builder.js";
/**
 * The {@link QueryInitializer} interface is the entry point for building a {@link Query}
 * over a Convex database table.
 *
 * There are two types of queries:
 * 1. Full table scans: Queries created with {@link QueryInitializer.fullTableScan} which
 * iterate over all of the documents in the table in insertion order.
 * 2. Indexed Queries: Queries created with {@link QueryInitializer.withIndex} which iterate
 * over an index range in index order.
 *
 * For convenience, {@link QueryInitializer} extends the {@link Query} interface, implicitly
 * starting a full table scan.
 *
 * @public
 */
export interface QueryInitializer<TableInfo extends GenericTableInfo> extends Query<TableInfo> {
    /**
     * Query by reading all of the values out of this table.
     *
     * This query's cost is relative to the size of the entire table, so this
     * should only be used on tables that will stay very small (say between a few
     * hundred and a few thousand documents) and are updated infrequently.
     *
     * @returns - The {@link Query} that iterates over every document of the table.
     */
    fullTableScan(): Query<TableInfo>;
    /**
     * Query by reading documents from an index on this table.
     *
     * This query's cost is relative to the number of documents that match the
     * index range expression.
     *
     * Results will be returned in index order.
     *
     * To learn about indexes, see [Indexes](https://docs.convex.dev/using/indexes).
     *
     * @param indexName - The name of the index to query.
     * @param indexRange - An optional index range constructed with the supplied
     *  {@link IndexRangeBuilder}. An index range is a description of which
     * documents Convex should consider when running the query. If no index
     * range is present, the query will consider all documents in the index.
     * @returns - The query that yields documents in the index.
     */
    withIndex<IndexName extends IndexNames<TableInfo>>(indexName: IndexName, indexRange?: (q: IndexRangeBuilder<DocumentByInfo<TableInfo>, NamedIndex<TableInfo, IndexName>>) => IndexRange): Query<TableInfo>;
    /**
     * Query by running a full text search against a search index.
     *
     * Search queries must always search for some text within the index's
     * `searchField`. This query can optionally add equality filters for any
     * `filterFields` specified in the index.
     *
     * Documents will be returned in relevance order based on how well they
     * match the search text.
     *
     * To learn about full text search, see [Indexes](https://docs.convex.dev/text-search).
     *
     * @param indexName - The name of the search index to query.
     * @param searchFilter - A search filter expression constructed with the
     * supplied {@link SearchFilterBuilder}. This defines the full text search to run
     * along with equality filtering to run within the search index.
     * @returns - A query that searches for matching documents, returning them
     * in relevancy order.
     */
    withSearchIndex<IndexName extends SearchIndexNames<TableInfo>>(indexName: IndexName, searchFilter: (q: SearchFilterBuilder<DocumentByInfo<TableInfo>, NamedSearchIndex<TableInfo, IndexName>>) => SearchFilter): OrderedQuery<TableInfo>;
}
/**
 * The {@link Query} interface allows functions to read values out of the database.
 *
 * **If you only need to load an object by ID, use `db.get(id)` instead.**
 *
 * Executing a query consists of calling
 * 1. (Optional) {@link Query.order} to define the order
 * 2. (Optional) {@link Query.filter} to refine the results
 * 3. A *consumer* method to obtain the results
 *
 * Queries are lazily evaluated. No work is done until iteration begins, so constructing and
 * extending a query is free. The query is executed incrementally as the results are iterated over,
 * so early terminating also reduces the cost of the query.
 *
 * It is more efficient to use `filter` expression rather than executing JavaScript to filter.
 *
 * |                                              | |
 * |----------------------------------------------|-|
 * | **Ordering**                                 | |
 * | [`order("asc")`](#order)                     | Define the order of query results. |
 * |                                              | |
 * | **Filtering**                                | |
 * | [`filter(...)`](#filter)                     | Filter the query results to only the values that match some condition. |
 * |                                              | |
 * | **Consuming**                                | Execute a query and return results in different ways. |
 * | [`[Symbol.asyncIterator]()`](#asynciterator) | The query's results can be iterated over using a `for await..of` loop. |
 * | [`collect()`](#collect)                      | Return all of the results as an array. |
 * | [`take(n: number)`](#take)                   | Return the first `n` results as an array. |
 * | [`first()`](#first)                          | Return the first result. |
 * | [`unique()`](#unique)                        | Return the only result, and throw if there is more than one result. |
 *
 * To learn more about how to write queries, see [Querying the Database](https://docs.convex.dev/using/database-queries).
 *
 * @public
 */
export interface Query<TableInfo extends GenericTableInfo> extends OrderedQuery<TableInfo> {
    /**
     * Define the order of the query output.
     *
     * Use `"asc"` for an ascending order and `"desc"` for a descending order. If not specified, the order defaults to ascending.
     * @param order - The order to return results in.
     */
    order(order: "asc" | "desc"): OrderedQuery<TableInfo>;
}
/**
 * A {@link Query} with an order that has already been defined.
 *
 * @public
 */
export interface OrderedQuery<TableInfo extends GenericTableInfo> extends AsyncIterable<DocumentByInfo<TableInfo>> {
    /**
     * Filter the query output, returning only the values for which `predicate` evaluates to true.
     *
     * @param predicate - An {@link Expression} constructed with the supplied {@link FilterBuilder} that specifies which documents to keep.
     * @returns - A new {@link OrderedQuery} with the given filter predicate applied.
     */
    filter(predicate: (q: FilterBuilder<TableInfo>) => ExpressionOrValue<boolean>): this;
    /**
     * Load a page of `n` results and obtain a {@link Cursor} for loading more.
     *
     * Note: If this is called from a reactive query function the number of
     * results may not match `paginationOpts.numItems`!
     *
     * `paginationOpts.numItems` is only an initial value. After the first invocation,
     * `paginate` will return all items in the original query range. This ensures
     * that all pages will remain adjacent and non-overlapping.
     *
     * @param paginationOpts - A {@link PaginationOptions} object containing the number
     * of items to load and the cursor to start at.
     * @returns A {@link PaginationResult} containing the page of results and a
     * cursor to continue paginating.
     */
    paginate(paginationOpts: PaginationOptions): Promise<PaginationResult<DocumentByInfo<TableInfo>>>;
    /**
     * Execute the query and return all of the results as an array.
     *
     * Note: when processing a query with a lot of results, it's often better to use the `Query` as an
     * `AsyncIterable` instead.
     *
     * @returns - An array of all of the query's results.
     */
    collect(): Promise<Array<DocumentByInfo<TableInfo>>>;
    /**
     * Execute the query and return the first `n` results.
     *
     * @param n - The number of items to take.
     * @returns - An array of the first `n` results of the query (or less if the
     * query doesn't have `n` results).
     */
    take(n: number): Promise<Array<DocumentByInfo<TableInfo>>>;
    /**
     * Execute the query and return the first result if there is one.
     *
     * @returns - The first value of the query or `null` if the query returned no results.
     * */
    first(): Promise<DocumentByInfo<TableInfo> | null>;
    /**
     * Execute the query and return the singular result if there is one.
     *
     * @returns - The single result returned from the query or null if none exists.
     * @throws  Will throw an error if the query returns more than one result.
     */
    unique(): Promise<DocumentByInfo<TableInfo> | null>;
}
//# sourceMappingURL=query.d.ts.map