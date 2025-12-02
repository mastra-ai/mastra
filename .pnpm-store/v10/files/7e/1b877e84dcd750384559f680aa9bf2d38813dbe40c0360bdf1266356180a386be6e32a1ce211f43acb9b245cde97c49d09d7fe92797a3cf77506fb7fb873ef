import { v } from "../values/validator.js";
import type { Validator } from "../values/validators.js";
import type { Value } from "../values/value.js";

/**
 * An opaque identifier used for paginating a database query.
 *
 * Cursors are returned from {@link OrderedQuery.paginate} and represent the
 * point of the query where the page of results ended.
 *
 * To continue paginating, pass the cursor back into
 * {@link OrderedQuery.paginate} in the {@link PaginationOptions} object to
 * fetch another page of results.
 *
 * Note: Cursors can only be passed to _exactly_ the same database query that
 * they were generated from. You may not reuse a cursor between different
 * database queries.
 *
 * @public
 */
export type Cursor = string;

/**
 * The result of paginating using {@link OrderedQuery.paginate}.
 *
 * @public
 */
export interface PaginationResult<T> {
  /**
   * The page of results.
   */
  page: T[];

  /**
   * Have we reached the end of the results?
   */
  isDone: boolean;

  /**
   * A {@link Cursor} to continue loading more results.
   */
  continueCursor: Cursor;

  /**
   * A {@link Cursor} to split the page into two, so the page from
   * (cursor, continueCursor] can be replaced by two pages (cursor, splitCursor]
   * and (splitCursor, continueCursor].
   */
  splitCursor?: Cursor | null;

  /**
   * When a query reads too much data, it may return 'SplitRecommended' to
   * indicate that the page should be split into two with `splitCursor`.
   * When a query reads so much data that `page` might be incomplete, its status
   * becomes 'SplitRequired'.
   */
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
}

/**
 * The options passed to {@link OrderedQuery.paginate}.
 *
 * To use this type in [argument validation](https://docs.convex.dev/functions/validation),
 * use the {@link paginationOptsValidator}.
 *
 * @public
 */
export interface PaginationOptions {
  /**
   * Number of items to load in this page of results.
   *
   * Note: This is only an initial value!
   *
   * If you are running this paginated query in a reactive query function, you
   * may receive more or less items than this if items were added to or removed
   * from the query range.
   */
  numItems: number;

  /**
   * A {@link Cursor} representing the start of this page or `null` to start
   * at the beginning of the query results.
   */
  cursor: Cursor | null;

  /**
   * A {@link Cursor} representing the end of this page or `null | undefined` to
   * use `numItems` instead.
   *
   * @internal
   */
  endCursor?: Cursor | null;

  /**
   * The maximum number of rows that should be read from the database.
   *
   * This option is different from `numItems` in that it controls the number of rows entering a query's
   * pipeline, where `numItems` controls the number of rows coming out. For example, a `filter`
   * may disqualify most of the rows coming in, so setting a low `numItems` would not help
   * bound its execution time. Instead, set a low `maximumRowsRead` to efficiently paginate
   * through the filter.
   *
   * Currently this is not enforced for search queries.
   *
   * @internal
   */
  maximumRowsRead?: number;

  /**
   * The maximum number of bytes that should be read from the database.
   *
   * As with {@link PaginationOptions.maximumRowsRead}, this affects the number
   * of rows entering a query's pipeline.
   *
   * Once a paginated query hits its bytes read budget, an incomplete page
   * will be returned.
   *
   * Currently this is not enforced for search queries.
   *
   * @internal
   */
  maximumBytesRead?: number;
}

/**
 * A {@link values.Validator} for {@link PaginationOptions}.
 *
 * This includes the standard {@link PaginationOptions} properties along with
 * an optional cache-busting `id` property used by {@link react.usePaginatedQuery}.
 *
 * @public
 */
export const paginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.union(v.string(), v.null()),
  endCursor: v.optional(v.union(v.string(), v.null())),
  id: v.optional(v.number()),
  maximumRowsRead: v.optional(v.number()),
  maximumBytesRead: v.optional(v.number()),
});

/**
 * A {@link values.Validator} factory for {@link PaginationResult}.
 *
 * Create a validator for the result of calling {@link OrderedQuery.paginate}
 * with a given item validator.
 *
 * For example:
 * ```ts
 * const paginationResultValidator = paginationResultValidator(v.object({
 *   _id: v.id("users"),
 *   _creationTime: v.number(),
 *   name: v.string(),
 * }));
 * ```
 *
 * @param itemValidator - A validator for the items in the page
 * @returns A validator for the pagination result
 *
 * @public
 */
export function paginationResultValidator<
  T extends Validator<Value, "required", string>,
>(itemValidator: T) {
  return v.object({
    page: v.array(itemValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  });
}
