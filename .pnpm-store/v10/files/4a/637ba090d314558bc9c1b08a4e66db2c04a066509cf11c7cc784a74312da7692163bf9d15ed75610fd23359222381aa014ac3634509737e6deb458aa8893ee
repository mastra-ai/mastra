import { GenericIndexFields, GenericDocument, FieldTypeFromFieldPath } from "./data_model.js";
/**
 * A type that adds 1 to a number literal type (up to 14).
 *
 * This is necessary to step through the fields in an index.
 */
type PlusOne<N extends number> = [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15
][N];
/**
 * Builder to define an index range to query.
 *
 * An index range is a description of which documents Convex should consider
 * when running the query.
 *
 * An index range is always a chained list of:
 * 1. 0 or more equality expressions defined with `.eq`.
 * 2. [Optionally] A lower bound expression defined with `.gt` or `.gte`.
 * 3. [Optionally] An upper bound expression defined with `.lt` or `.lte`.
 *
 * **You must step through fields in index order.**
 *
 * Each equality expression must compare a different index field, starting from
 * the beginning and in order. The upper and lower bounds must follow the
 * equality expressions and compare the next field.
 *
 * For example, if there is an index of messages on
 * `["projectId", "priority"]`, a range searching for "messages in 'myProjectId'
 * with priority at least 100" would look like:
 * ```ts
 * q.eq("projectId", myProjectId)
 *  .gte("priority", 100)
 * ```
 *
 * **The performance of your query is based on the specificity of the range.**
 *
 * This class is designed to only allow you to specify ranges that Convex can
 * efficiently use your index to find. For all other filtering use
 * {@link OrderedQuery.filter}.
 *
 * To learn about indexes, see [Indexes](https://docs.convex.dev/using/indexes).
 * @public
 */
export interface IndexRangeBuilder<Document extends GenericDocument, IndexFields extends GenericIndexFields, FieldNum extends number = 0> extends LowerBoundIndexRangeBuilder<Document, IndexFields[FieldNum]> {
    /**
     * Restrict this range to documents where `doc[fieldName] === value`.
     *
     * @param fieldName - The name of the field to compare. Must be the next field
     * in the index.
     * @param value - The value to compare against.
     */
    eq(fieldName: IndexFields[FieldNum], value: FieldTypeFromFieldPath<Document, IndexFields[FieldNum]>): NextIndexRangeBuilder<Document, IndexFields, FieldNum>;
}
/**
 * An {@link IndexRangeBuilder} for the next field of the index.
 *
 * This type is careful to check if adding one to the `FieldNum` will exceed
 * the length of the `IndexFields`.
 */
type NextIndexRangeBuilder<Document extends GenericDocument, IndexFields extends GenericIndexFields, FieldNum extends number> = PlusOne<FieldNum> extends IndexFields["length"] ? IndexRange : IndexRangeBuilder<Document, IndexFields, PlusOne<FieldNum>>;
/**
 * Builder to define the lower bound of an index range.
 *
 * See {@link IndexRangeBuilder}.
 *
 * @public
 */
export interface LowerBoundIndexRangeBuilder<Document extends GenericDocument, IndexFieldName extends string> extends UpperBoundIndexRangeBuilder<Document, IndexFieldName> {
    /**
     * Restrict this range to documents where `doc[fieldName] > value`.
     *
     * @param fieldName - The name of the field to compare. Must be the next field
     * in the index.
     * @param value - The value to compare against.
     */
    gt(fieldName: IndexFieldName, value: FieldTypeFromFieldPath<Document, IndexFieldName>): UpperBoundIndexRangeBuilder<Document, IndexFieldName>;
    /**
     * Restrict this range to documents where `doc[fieldName] >= value`.
     *
     * @param fieldName - The name of the field to compare. Must be the next field
     * in the index.
     * @param value - The value to compare against.
     */
    gte(fieldName: IndexFieldName, value: FieldTypeFromFieldPath<Document, IndexFieldName>): UpperBoundIndexRangeBuilder<Document, IndexFieldName>;
}
/**
 * Builder to define the upper bound of an index range.
 *
 * See {@link IndexRangeBuilder}.
 *
 * @public
 */
export interface UpperBoundIndexRangeBuilder<Document extends GenericDocument, IndexFieldName extends string> extends IndexRange {
    /**
     * Restrict this range to documents where `doc[fieldName] < value`.
     *
     * @param fieldName - The name of the field to compare. Must be the same index
     * field used in the lower bound (`.gt` or `.gte`) or the next field if no
     * lower bound was specified.
     * @param value - The value to compare against.
     */
    lt(fieldName: IndexFieldName, value: FieldTypeFromFieldPath<Document, IndexFieldName>): IndexRange;
    /**
     * Restrict this range to documents where `doc[fieldName] <= value`.
     *
     * @param fieldName - The name of the field to compare. Must be the same index
     * field used in the lower bound (`.gt` or `.gte`) or the next field if no
     * lower bound was specified.
     * @param value - The value to compare against.
     */
    lte(fieldName: IndexFieldName, value: FieldTypeFromFieldPath<Document, IndexFieldName>): IndexRange;
}
/**
 * An expression representing an index range created by
 * {@link IndexRangeBuilder}.
 * @public
 */
export declare abstract class IndexRange {
    private _isIndexRange;
}
export {};
//# sourceMappingURL=index_range_builder.d.ts.map