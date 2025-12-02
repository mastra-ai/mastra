import { Schema } from "../arrow";
import { EmbeddingFunction } from "./embedding_function";
export { FieldOptions, EmbeddingFunction, TextEmbeddingFunction, FunctionOptions, EmbeddingFunctionConstructor, } from "./embedding_function";
export * from "./registry";
/**
 * Create a schema with embedding functions.
 *
 * @param fields
 * @returns Schema
 * @example
 * ```ts
 * class MyEmbeddingFunction extends EmbeddingFunction {
 * // ...
 * }
 * const func = new MyEmbeddingFunction();
 * const schema = LanceSchema({
 *   id: new Int32(),
 *   text: func.sourceField(new Utf8()),
 *   vector: func.vectorField(),
 *   // optional: specify the datatype and/or dimensions
 *   vector2: func.vectorField({ datatype: new Float32(), dims: 3}),
 * });
 *
 * const table = await db.createTable("my_table", data, { schema });
 * ```
 */
export declare function LanceSchema(fields: Record<string, [object, Map<string, EmbeddingFunction>] | object>): Schema;
