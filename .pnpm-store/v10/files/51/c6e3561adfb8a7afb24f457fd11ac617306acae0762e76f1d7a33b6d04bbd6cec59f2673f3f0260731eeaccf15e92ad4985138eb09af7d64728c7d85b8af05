import { JSONSchema } from "@json-schema-tools/meta-schema";
/**
 * Signature of the mutation method passed to traverse.
 *
 * @param schema The schema or subschema node being traversed
 * @param isCycle false if the schema passed is not the root of a detected cycle. Useful for special handling of cycled schemas.
 * @param path json-path string in dot-notation as per [draft-goessner-dispatch-jsonpath-00](https://www.ietf.org/archive/id/draft-goessner-dispatch-jsonpath-00.html#name-overview-of-jsonpath-expres)
 * @param parent A reference to JSONSchema that is the parent of the `schema` param. If the `schema` is the root schema, `parent` will be `undefined`. when schema is a cycle, parent is the parent of the referenced cycle (once again, if the cycled schema is the root, the parent will be undefined).
 */
export type MutationFunction = (schema: JSONSchema, isCycle: boolean, path: string, parent: JSONSchema) => JSONSchema;
/**
 * The options you can use when traversing.
 */
export interface TraverseOptions {
    /**
     * Set this to true if you don't want to call the mutator function on the root schema.
     */
    skipFirstMutation?: boolean;
    /**
     * Set this to true if you want to merge the returned value of the mutation function into
     * the original schema.
     */
    mergeNotMutate?: boolean;
    /**
     * true if you want the original schema that was provided to be directly modified by the provided mutation/merge function
     * To preserve cyclical refs this is necessary.
     */
    mutable?: boolean;
    /**
     * true if you want to traverse in a breadth-first manner. This will cause the mutation function to be called first with
     * the root schema, moving down the subschemas until the terminal subschemas.
     */
    bfs?: boolean;
}
export declare const defaultOptions: TraverseOptions;
/**
 * Traverse all subschema of a schema, calling the mutator function with each.
 * The mutator is called on leaf nodes first.
 *
 * @param schema the schema to traverse
 * @param mutation the function to pass each node in the subschema tree.
 * @param traverseOptions a set of options for traversal.
 * @param depth For internal use. Tracks the current recursive depth in the tree. This is used to implement
 *              some of the options.
 *
 */
export default function traverse(schema: JSONSchema, mutation: MutationFunction, traverseOptions?: TraverseOptions, depth?: number, recursiveStack?: JSONSchema[], mutableStack?: JSONSchema[], pathStack?: string[], prePostMap?: Array<[JSONSchema, JSONSchema]>, cycleSet?: JSONSchema[]): JSONSchema;
