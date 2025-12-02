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
}
/**
 * A {@link values.Validator} for {@link PaginationOptions}.
 *
 * This includes the standard {@link PaginationOptions} properties along with
 * an optional cache-busting `id` property used by {@link react.usePaginatedQuery}.
 *
 * @public
 */
export declare const paginationOptsValidator: import("../values/validators.js").VObject<{
    id?: number;
    endCursor?: string | null;
    maximumRowsRead?: number;
    maximumBytesRead?: number;
    numItems: number;
    cursor: string | null;
}, {
    numItems: import("../values/validators.js").VFloat64<number, "required">;
    cursor: import("../values/validators.js").VUnion<string | null, [import("../values/validators.js").VString<string, "required">, import("../values/validators.js").VNull<null, "required">], "required", never>;
    endCursor: import("../values/validators.js").VUnion<string | null | undefined, [import("../values/validators.js").VString<string, "required">, import("../values/validators.js").VNull<null, "required">], "optional", never>;
    id: import("../values/validators.js").VFloat64<number | undefined, "optional">;
    maximumRowsRead: import("../values/validators.js").VFloat64<number | undefined, "optional">;
    maximumBytesRead: import("../values/validators.js").VFloat64<number | undefined, "optional">;
}, "required", "id" | "numItems" | "cursor" | "endCursor" | "maximumRowsRead" | "maximumBytesRead">;
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
export declare function paginationResultValidator<T extends Validator<Value, "required", string>>(itemValidator: T): import("../values/validators.js").VObject<{
    splitCursor?: string | null;
    pageStatus?: "SplitRecommended" | "SplitRequired" | null;
    page: T["type"][];
    continueCursor: string;
    isDone: boolean;
}, {
    page: import("../values/validators.js").VArray<T["type"][], T, "required">;
    continueCursor: import("../values/validators.js").VString<string, "required">;
    isDone: import("../values/validators.js").VBoolean<boolean, "required">;
    splitCursor: import("../values/validators.js").VUnion<string | null | undefined, [import("../values/validators.js").VString<string, "required">, import("../values/validators.js").VNull<null, "required">], "optional", never>;
    pageStatus: import("../values/validators.js").VUnion<"SplitRecommended" | "SplitRequired" | null | undefined, [import("../values/validators.js").VLiteral<"SplitRecommended", "required">, import("../values/validators.js").VLiteral<"SplitRequired", "required">, import("../values/validators.js").VNull<null, "required">], "optional", never>;
}, "required", "page" | "continueCursor" | "isDone" | "splitCursor" | "pageStatus">;
//# sourceMappingURL=pagination.d.ts.map