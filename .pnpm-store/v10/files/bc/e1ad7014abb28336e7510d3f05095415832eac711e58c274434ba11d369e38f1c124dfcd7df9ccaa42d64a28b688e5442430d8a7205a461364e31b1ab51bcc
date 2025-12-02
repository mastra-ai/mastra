import { Ast, ParseQuery } from './parser';
import { AggregateFunctions, ExtractFirstProperty, GenericSchema, IsNonEmptyArray, Prettify, TablesAndViews, TypeScriptTypes, ContainsNull, GenericRelationship, PostgreSQLTypes, GenericTable, ClientServerOptions } from './types';
import { CheckDuplicateEmbededReference, GetComputedFields, GetFieldNodeResultName, IsAny, IsRelationNullable, IsStringUnion, JsonPathToType, ResolveRelationship, SelectQueryError } from './utils';
export type SpreadOnManyEnabled<PostgrestVersion extends string | undefined> = PostgrestVersion extends `13${string}` ? true : false;
/**
 * Main entry point for constructing the result type of a PostgREST query.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Query - The select query string literal to parse.
 */
export type GetResult<Schema extends GenericSchema, Row extends Record<string, unknown>, RelationName, Relationships, Query extends string, ClientOptions extends ClientServerOptions> = IsAny<Schema> extends true ? ParseQuery<Query> extends infer ParsedQuery ? ParsedQuery extends Ast.Node[] ? RelationName extends string ? ProcessNodesWithoutSchema<ParsedQuery> : any : ParsedQuery : any : Relationships extends null ? ParseQuery<Query> extends infer ParsedQuery ? ParsedQuery extends Ast.Node[] ? RPCCallNodes<ParsedQuery, RelationName extends string ? RelationName : 'rpc_call', Row> : ParsedQuery : Row : ParseQuery<Query> extends infer ParsedQuery ? ParsedQuery extends Ast.Node[] ? RelationName extends string ? Relationships extends GenericRelationship[] ? ProcessNodes<ClientOptions, Schema, Row, RelationName, Relationships, ParsedQuery> : SelectQueryError<'Invalid Relationships cannot infer result type'> : SelectQueryError<'Invalid RelationName cannot infer result type'> : ParsedQuery : never;
type ProcessSimpleFieldWithoutSchema<Field extends Ast.FieldNode> = Field['aggregateFunction'] extends AggregateFunctions ? {
    [K in GetFieldNodeResultName<Field>]: Field['castType'] extends PostgreSQLTypes ? TypeScriptTypes<Field['castType']> : number;
} : {
    [K in GetFieldNodeResultName<Field>]: Field['castType'] extends PostgreSQLTypes ? TypeScriptTypes<Field['castType']> : any;
};
type ProcessFieldNodeWithoutSchema<Node extends Ast.FieldNode> = IsNonEmptyArray<Node['children']> extends true ? {
    [K in GetFieldNodeResultName<Node>]: Node['children'] extends Ast.Node[] ? ProcessNodesWithoutSchema<Node['children']>[] : ProcessSimpleFieldWithoutSchema<Node>;
} : ProcessSimpleFieldWithoutSchema<Node>;
/**
 * Processes a single Node without schema and returns the resulting TypeScript type.
 */
type ProcessNodeWithoutSchema<Node extends Ast.Node> = Node extends Ast.StarNode ? any : Node extends Ast.SpreadNode ? Node['target']['children'] extends Ast.StarNode[] ? any : Node['target']['children'] extends Ast.FieldNode[] ? {
    [P in Node['target']['children'][number] as GetFieldNodeResultName<P>]: P['castType'] extends PostgreSQLTypes ? TypeScriptTypes<P['castType']> : any;
} : any : Node extends Ast.FieldNode ? ProcessFieldNodeWithoutSchema<Node> : any;
/**
 * Processes nodes when Schema is any, providing basic type inference
 */
type ProcessNodesWithoutSchema<Nodes extends Ast.Node[], Acc extends Record<string, unknown> = {}> = Nodes extends [infer FirstNode, ...infer RestNodes] ? FirstNode extends Ast.Node ? RestNodes extends Ast.Node[] ? ProcessNodeWithoutSchema<FirstNode> extends infer FieldResult ? FieldResult extends Record<string, unknown> ? ProcessNodesWithoutSchema<RestNodes, Acc & FieldResult> : FieldResult : any : any : any : Prettify<Acc>;
/**
 * Processes a single Node from a select chained after a rpc call
 *
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current rpc function
 * @param NodeType - The Node to process.
 */
export type ProcessRPCNode<Row extends Record<string, unknown>, RelationName extends string, NodeType extends Ast.Node> = NodeType['type'] extends Ast.StarNode['type'] ? Row : NodeType['type'] extends Ast.FieldNode['type'] ? ProcessSimpleField<Row, RelationName, Extract<NodeType, Ast.FieldNode>> : SelectQueryError<'RPC Unsupported node type.'>;
/**
 * Process select call that can be chained after an rpc call
 */
export type RPCCallNodes<Nodes extends Ast.Node[], RelationName extends string, Row extends Record<string, unknown>, Acc extends Record<string, unknown> = {}> = Nodes extends [infer FirstNode, ...infer RestNodes] ? FirstNode extends Ast.Node ? RestNodes extends Ast.Node[] ? ProcessRPCNode<Row, RelationName, FirstNode> extends infer FieldResult ? FieldResult extends Record<string, unknown> ? RPCCallNodes<RestNodes, RelationName, Row, Acc & FieldResult> : FieldResult extends SelectQueryError<infer E> ? SelectQueryError<E> : SelectQueryError<'Could not retrieve a valid record or error value'> : SelectQueryError<'Processing node failed.'> : SelectQueryError<'Invalid rest nodes array in RPC call'> : SelectQueryError<'Invalid first node in RPC call'> : Prettify<Acc>;
/**
 * Recursively processes an array of Nodes and accumulates the resulting TypeScript type.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Nodes - An array of AST nodes to process.
 * @param Acc - Accumulator for the constructed type.
 */
export type ProcessNodes<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Row extends Record<string, unknown>, RelationName extends string, Relationships extends GenericRelationship[], Nodes extends Ast.Node[], Acc extends Record<string, unknown> = {}> = CheckDuplicateEmbededReference<Schema, RelationName, Relationships, Nodes> extends false ? Nodes extends [infer FirstNode, ...infer RestNodes] ? FirstNode extends Ast.Node ? RestNodes extends Ast.Node[] ? ProcessNode<ClientOptions, Schema, Row, RelationName, Relationships, FirstNode> extends infer FieldResult ? FieldResult extends Record<string, unknown> ? ProcessNodes<ClientOptions, Schema, Row, RelationName, Relationships, RestNodes, Acc & FieldResult> : FieldResult extends SelectQueryError<infer E> ? SelectQueryError<E> : SelectQueryError<'Could not retrieve a valid record or error value'> : SelectQueryError<'Processing node failed.'> : SelectQueryError<'Invalid rest nodes array type in ProcessNodes'> : SelectQueryError<'Invalid first node type in ProcessNodes'> : Prettify<Acc> : Prettify<CheckDuplicateEmbededReference<Schema, RelationName, Relationships, Nodes>>;
/**
 * Processes a single Node and returns the resulting TypeScript type.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param NodeType - The Node to process.
 */
export type ProcessNode<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Row extends Record<string, unknown>, RelationName extends string, Relationships extends GenericRelationship[], NodeType extends Ast.Node> = NodeType['type'] extends Ast.StarNode['type'] ? GetComputedFields<Schema, RelationName> extends never ? Row : Omit<Row, GetComputedFields<Schema, RelationName>> : NodeType['type'] extends Ast.SpreadNode['type'] ? ProcessSpreadNode<ClientOptions, Schema, Row, RelationName, Relationships, Extract<NodeType, Ast.SpreadNode>> : NodeType['type'] extends Ast.FieldNode['type'] ? ProcessFieldNode<ClientOptions, Schema, Row, RelationName, Relationships, Extract<NodeType, Ast.FieldNode>> : SelectQueryError<'Unsupported node type.'>;
/**
 * Processes a FieldNode and returns the resulting TypeScript type.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Field - The FieldNode to process.
 */
type ProcessFieldNode<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Row extends Record<string, unknown>, RelationName extends string, Relationships extends GenericRelationship[], Field extends Ast.FieldNode> = Field['children'] extends [] ? {} : IsNonEmptyArray<Field['children']> extends true ? ProcessEmbeddedResource<ClientOptions, Schema, Relationships, Field, RelationName> : ProcessSimpleField<Row, RelationName, Field>;
type ResolveJsonPathType<Value, Path extends string | undefined, CastType extends PostgreSQLTypes> = Path extends string ? JsonPathToType<Value, Path> extends never ? TypeScriptTypes<CastType> : JsonPathToType<Value, Path> extends infer PathResult ? PathResult extends string ? PathResult : IsStringUnion<PathResult> extends true ? PathResult : CastType extends 'json' ? PathResult : TypeScriptTypes<CastType> : TypeScriptTypes<CastType> : TypeScriptTypes<CastType>;
/**
 * Processes a simple field (without embedded resources).
 *
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Field - The FieldNode to process.
 */
type ProcessSimpleField<Row extends Record<string, unknown>, RelationName extends string, Field extends Ast.FieldNode> = Field['name'] extends keyof Row | 'count' ? Field['aggregateFunction'] extends AggregateFunctions ? {
    [K in GetFieldNodeResultName<Field>]: Field['castType'] extends PostgreSQLTypes ? TypeScriptTypes<Field['castType']> : number;
} : {
    [K in GetFieldNodeResultName<Field>]: Field['castType'] extends PostgreSQLTypes ? ResolveJsonPathType<Row[Field['name']], Field['jsonPath'], Field['castType']> : Row[Field['name']];
} : SelectQueryError<`column '${Field['name']}' does not exist on '${RelationName}'.`>;
/**
 * Processes an embedded resource (relation).
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Field - The FieldNode to process.
 */
export type ProcessEmbeddedResource<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Relationships extends GenericRelationship[], Field extends Ast.FieldNode, CurrentTableOrView extends keyof TablesAndViews<Schema> & string> = ResolveRelationship<Schema, Relationships, Field, CurrentTableOrView> extends infer Resolved ? Resolved extends {
    referencedTable: Pick<GenericTable, 'Row' | 'Relationships'>;
    relation: GenericRelationship & {
        match: 'refrel' | 'col' | 'fkname' | 'func';
    };
    direction: string;
} ? ProcessEmbeddedResourceResult<ClientOptions, Schema, Resolved, Field, CurrentTableOrView> : {
    [K in GetFieldNodeResultName<Field>]: Resolved;
} : {
    [K in GetFieldNodeResultName<Field>]: SelectQueryError<'Failed to resolve relationship.'> & string;
};
/**
 * Helper type to process the result of an embedded resource.
 */
type ProcessEmbeddedResourceResult<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Resolved extends {
    referencedTable: Pick<GenericTable, 'Row' | 'Relationships'>;
    relation: GenericRelationship & {
        match: 'refrel' | 'col' | 'fkname' | 'func';
        isNotNullable?: boolean;
        referencedRelation: string;
        isSetofReturn?: boolean;
    };
    direction: string;
}, Field extends Ast.FieldNode, CurrentTableOrView extends keyof TablesAndViews<Schema>> = ProcessNodes<ClientOptions, Schema, Resolved['referencedTable']['Row'], Resolved['relation']['match'] extends 'func' ? Resolved['relation']['referencedRelation'] : Field['name'], Resolved['referencedTable']['Relationships'], Field['children'] extends undefined ? [] : Exclude<Field['children'], undefined> extends Ast.Node[] ? Exclude<Field['children'], undefined> : []> extends infer ProcessedChildren ? {
    [K in GetFieldNodeResultName<Field>]: Resolved['direction'] extends 'forward' ? Field extends {
        innerJoin: true;
    } ? Resolved['relation']['isOneToOne'] extends true ? ProcessedChildren : ProcessedChildren[] : Resolved['relation']['isOneToOne'] extends true ? Resolved['relation']['match'] extends 'func' ? Resolved['relation']['isNotNullable'] extends true ? Resolved['relation']['isSetofReturn'] extends true ? ProcessedChildren : {
        [P in keyof ProcessedChildren]: ProcessedChildren[P] | null;
    } : ProcessedChildren | null : ProcessedChildren | null : ProcessedChildren[] : Resolved['relation']['referencedRelation'] extends CurrentTableOrView ? Resolved['relation']['match'] extends 'col' ? IsRelationNullable<TablesAndViews<Schema>[CurrentTableOrView], Resolved['relation']> extends true ? ProcessedChildren | null : ProcessedChildren : ProcessedChildren[] : IsRelationNullable<TablesAndViews<Schema>[CurrentTableOrView], Resolved['relation']> extends true ? Field extends {
        innerJoin: true;
    } ? ProcessedChildren : ProcessedChildren | null : ProcessedChildren;
} : {
    [K in GetFieldNodeResultName<Field>]: SelectQueryError<'Failed to process embedded resource nodes.'> & string;
};
/**
 * Processes a SpreadNode by processing its target node.
 *
 * @param Schema - Database schema.
 * @param Row - The type of a row in the current table.
 * @param RelationName - The name of the current table or view.
 * @param Relationships - Relationships of the current table.
 * @param Spread - The SpreadNode to process.
 */
type ProcessSpreadNode<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Row extends Record<string, unknown>, RelationName extends string, Relationships extends GenericRelationship[], Spread extends Ast.SpreadNode> = ProcessNode<ClientOptions, Schema, Row, RelationName, Relationships, Spread['target']> extends infer Result ? Result extends SelectQueryError<infer E> ? SelectQueryError<E> : ExtractFirstProperty<Result> extends unknown[] ? SpreadOnManyEnabled<ClientOptions['PostgrestVersion']> extends true ? ProcessManyToManySpreadNodeResult<Result> : {
    [K in Spread['target']['name']]: SelectQueryError<`"${RelationName}" and "${Spread['target']['name']}" do not form a many-to-one or one-to-one relationship spread not possible`>;
} : ProcessSpreadNodeResult<Result> : never;
/**
 * Helper type to process the result of a many-to-many spread node.
 * Converts all fields in the spread object into arrays.
 */
type ProcessManyToManySpreadNodeResult<Result> = Result extends Record<string, SelectQueryError<string> | null> ? Result : ExtractFirstProperty<Result> extends infer SpreadedObject ? SpreadedObject extends Array<Record<string, unknown>> ? {
    [K in keyof SpreadedObject[number]]: Array<SpreadedObject[number][K]>;
} : SelectQueryError<'An error occurred spreading the many-to-many object'> : SelectQueryError<'An error occurred spreading the many-to-many object'>;
/**
 * Helper type to process the result of a spread node.
 */
type ProcessSpreadNodeResult<Result> = Result extends Record<string, SelectQueryError<string> | null> ? Result : ExtractFirstProperty<Result> extends infer SpreadedObject ? ContainsNull<SpreadedObject> extends true ? Exclude<{
    [K in keyof SpreadedObject]: SpreadedObject[K] | null;
}, null> : Exclude<{
    [K in keyof SpreadedObject]: SpreadedObject[K];
}, null> : SelectQueryError<'An error occurred spreading the object'>;
export {};
//# sourceMappingURL=result.d.ts.map