/**
 * The type of JavaScript values serializable to JSON.
 *
 * @public
 */
export type JSONValue = null | boolean | number | string | JSONValue[] | {
    [key: string]: JSONValue;
};
/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/database/document-ids).
 *
 * Documents can be loaded using `db.get(id)` in query and mutation functions.
 *
 * IDs are base 32 encoded strings which are URL safe.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings at compile time.
 *
 * If you're using code generation, use the `Id` type generated for your data model in
 * `convex/_generated/dataModel.d.ts`.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 *
 * @public
 */
export type Id<TableName extends string> = string & {
    __tableName: TableName;
};
/**
 * A value supported by Convex.
 *
 * Values can be:
 * - stored inside of documents.
 * - used as arguments and return types to queries and mutation functions.
 *
 * You can see the full set of supported types at
 * [Types](https://docs.convex.dev/using/types).
 *
 * @public
 */
export type Value = null | bigint | number | boolean | string | ArrayBuffer | Value[] | {
    [key: string]: undefined | Value;
};
/**
 * The types of {@link Value} that can be used to represent numbers.
 *
 * @public
 */
export type NumericValue = bigint | number;
export declare function slowBigIntToBase64(value: bigint): string;
export declare function slowBase64ToBigInt(encoded: string): bigint;
export declare function modernBigIntToBase64(value: bigint): string;
export declare function modernBase64ToBigInt(encoded: string): bigint;
export declare const bigIntToBase64: typeof modernBigIntToBase64;
export declare const base64ToBigInt: typeof modernBase64ToBigInt;
/**
 * Parse a Convex value from its JSON representation.
 *
 * This function will deserialize serialized Int64s to `BigInt`s, Bytes to `ArrayBuffer`s etc.
 *
 * To learn more about Convex values, see [Types](https://docs.convex.dev/using/types).
 *
 * @param value - The JSON representation of a Convex value previously created with {@link convexToJson}.
 * @returns The JavaScript representation of the Convex value.
 *
 * @public
 */
export declare function jsonToConvex(value: JSONValue): Value;
export declare function stringifyValueForError(value: any): string;
/**
 * Convert a Convex value to its JSON representation.
 *
 * Use {@link jsonToConvex} to recreate the original value.
 *
 * To learn more about Convex values, see [Types](https://docs.convex.dev/using/types).
 *
 * @param value - A Convex value to convert into JSON.
 * @returns The JSON representation of `value`.
 *
 * @public
 */
export declare function convexToJson(value: Value): JSONValue;
export declare function convexOrUndefinedToJson(value: Value | undefined): JSONValue;
/**
 * Similar to convexToJson but also serializes top level undefined fields
 * using convexOrUndefinedToJson().
 *
 * @param value - A Convex value to convert into JSON.
 * @returns The JSON representation of `value`.
 */
export declare function patchValueToJson(value: Value): JSONValue;
//# sourceMappingURL=value.d.ts.map