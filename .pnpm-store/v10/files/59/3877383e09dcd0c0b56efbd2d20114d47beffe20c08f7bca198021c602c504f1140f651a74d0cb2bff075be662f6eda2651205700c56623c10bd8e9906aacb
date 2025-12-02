import { Ast } from './parser';
import { AggregateFunctions, ContainsNull, GenericRelationship, GenericSchema, GenericTable, IsNonEmptyArray, TablesAndViews, UnionToArray, GenericFunction, GenericSetofOption } from './types';
export type IsAny<T> = 0 extends 1 & T ? true : false;
export type SelectQueryError<Message extends string> = {
    error: true;
} & Message;
export type DeduplicateRelationships<T extends readonly unknown[]> = T extends readonly [
    infer First,
    ...infer Rest
] ? First extends Rest[number] ? DeduplicateRelationships<Rest extends readonly unknown[] ? Rest : []> : [First, ...DeduplicateRelationships<Rest extends readonly unknown[] ? Rest : []>] : T;
export type GetFieldNodeResultName<Field extends Ast.FieldNode> = Field['alias'] extends string ? Field['alias'] : Field['aggregateFunction'] extends AggregateFunctions ? Field['aggregateFunction'] : Field['name'];
type FilterRelationNodes<Nodes extends Ast.Node[]> = UnionToArray<{
    [K in keyof Nodes]: Nodes[K] extends Ast.SpreadNode ? Nodes[K]['target'] : Nodes[K] extends Ast.FieldNode ? IsNonEmptyArray<Nodes[K]['children']> extends true ? Nodes[K] : never : never;
}[number]>;
type ResolveRelationships<Schema extends GenericSchema, RelationName extends string, Relationships extends GenericRelationship[], Nodes extends Ast.FieldNode[]> = UnionToArray<{
    [K in keyof Nodes]: Nodes[K] extends Ast.FieldNode ? ResolveRelationship<Schema, Relationships, Nodes[K], RelationName> extends infer Relation ? Relation extends {
        relation: {
            referencedRelation: string;
            foreignKeyName: string;
            match: string;
        };
        from: string;
    } ? {
        referencedTable: Relation['relation']['referencedRelation'];
        fkName: Relation['relation']['foreignKeyName'];
        from: Relation['from'];
        match: Relation['relation']['match'];
        fieldName: GetFieldNodeResultName<Nodes[K]>;
    } : Relation : never : never;
}>[0];
/**
 * Checks if a relation is implicitly referenced twice, requiring disambiguation
 */
type IsDoubleReference<T, U> = T extends {
    referencedTable: infer RT;
    fieldName: infer FN;
    match: infer M;
} ? M extends 'col' | 'refrel' ? U extends {
    referencedTable: RT;
    fieldName: FN;
    match: M;
} ? true : false : false : false;
/**
 * Compares one element with all other elements in the array to find duplicates
 */
type CheckDuplicates<Arr extends any[], Current> = Arr extends [infer Head, ...infer Tail] ? IsDoubleReference<Current, Head> extends true ? Head | CheckDuplicates<Tail, Current> : CheckDuplicates<Tail, Current> : never;
/**
 * Iterates over the elements of the array to find duplicates
 */
type FindDuplicatesWithinDeduplicated<Arr extends any[]> = Arr extends [infer Head, ...infer Tail] ? CheckDuplicates<Tail, Head> | FindDuplicatesWithinDeduplicated<Tail> : never;
type FindDuplicates<Arr extends any[]> = FindDuplicatesWithinDeduplicated<DeduplicateRelationships<Arr>>;
export type CheckDuplicateEmbededReference<Schema extends GenericSchema, RelationName extends string, Relationships extends GenericRelationship[], Nodes extends Ast.Node[]> = FilterRelationNodes<Nodes> extends infer RelationsNodes ? RelationsNodes extends Ast.FieldNode[] ? ResolveRelationships<Schema, RelationName, Relationships, RelationsNodes> extends infer ResolvedRels ? ResolvedRels extends unknown[] ? FindDuplicates<ResolvedRels> extends infer Duplicates ? Duplicates extends never ? false : Duplicates extends {
    fieldName: infer FieldName;
} ? FieldName extends string ? {
    [K in FieldName]: SelectQueryError<`table "${RelationName}" specified more than once use hinting for desambiguation`>;
} : false : false : false : false : false : false : false;
/**
 * Returns a boolean representing whether there is a foreign key referencing
 * a given relation.
 */
type HasFKeyToFRel<FRelName, Relationships> = Relationships extends [infer R] ? R extends {
    referencedRelation: FRelName;
} ? true : false : Relationships extends [infer R, ...infer Rest] ? HasFKeyToFRel<FRelName, [R]> extends true ? true : HasFKeyToFRel<FRelName, Rest> : false;
/**
 * Checks if there is more than one relation to a given foreign relation name in the Relationships.
 */
type HasMultipleFKeysToFRelDeduplicated<FRelName, Relationships> = Relationships extends [
    infer R,
    ...infer Rest
] ? R extends {
    referencedRelation: FRelName;
} ? HasFKeyToFRel<FRelName, Rest> extends true ? true : HasMultipleFKeysToFRelDeduplicated<FRelName, Rest> : HasMultipleFKeysToFRelDeduplicated<FRelName, Rest> : false;
type HasMultipleFKeysToFRel<FRelName, Relationships extends unknown[]> = HasMultipleFKeysToFRelDeduplicated<FRelName, DeduplicateRelationships<Relationships>>;
type CheckRelationshipError<Schema extends GenericSchema, Relationships extends GenericRelationship[], CurrentTableOrView extends keyof TablesAndViews<Schema> & string, FoundRelation> = FoundRelation extends SelectQueryError<string> ? FoundRelation : FoundRelation extends {
    relation: {
        referencedRelation: infer RelatedRelationName;
        name: string;
    };
    direction: 'reverse';
} ? RelatedRelationName extends string ? HasMultipleFKeysToFRel<RelatedRelationName, Relationships> extends true ? SelectQueryError<`Could not embed because more than one relationship was found for '${RelatedRelationName}' and '${CurrentTableOrView}' you need to hint the column with ${RelatedRelationName}!<columnName> ?`> : FoundRelation : never : FoundRelation extends {
    relation: {
        referencedRelation: infer RelatedRelationName;
        name: string;
    };
    direction: 'forward';
    from: infer From;
} ? RelatedRelationName extends string ? From extends keyof TablesAndViews<Schema> & string ? HasMultipleFKeysToFRel<RelatedRelationName, TablesAndViews<Schema>[From]['Relationships']> extends true ? SelectQueryError<`Could not embed because more than one relationship was found for '${From}' and '${RelatedRelationName}' you need to hint the column with ${From}!<columnName> ?`> : FoundRelation : never : never : FoundRelation;
/**
 * Resolves relationships for embedded resources and retrieves the referenced Table
 */
export type ResolveRelationship<Schema extends GenericSchema, Relationships extends GenericRelationship[], Field extends Ast.FieldNode, CurrentTableOrView extends keyof TablesAndViews<Schema> & string> = ResolveReverseRelationship<Schema, Relationships, Field, CurrentTableOrView> extends infer ReverseRelationship ? ReverseRelationship extends false ? CheckRelationshipError<Schema, Relationships, CurrentTableOrView, ResolveForwardRelationship<Schema, Field, CurrentTableOrView>> : CheckRelationshipError<Schema, Relationships, CurrentTableOrView, ReverseRelationship> : never;
/**
 * Resolves reverse relationships (from children to parent)
 */
type ResolveReverseRelationship<Schema extends GenericSchema, Relationships extends GenericRelationship[], Field extends Ast.FieldNode, CurrentTableOrView extends keyof TablesAndViews<Schema> & string> = FindFieldMatchingRelationships<Schema, Relationships, Field> extends infer FoundRelation ? FoundRelation extends never ? false : FoundRelation extends {
    referencedRelation: infer RelatedRelationName;
} ? RelatedRelationName extends string ? RelatedRelationName extends keyof TablesAndViews<Schema> ? FoundRelation extends {
    hint: string;
} ? {
    referencedTable: TablesAndViews<Schema>[RelatedRelationName];
    relation: FoundRelation;
    direction: 'reverse';
    from: CurrentTableOrView;
} : HasMultipleFKeysToFRel<RelatedRelationName, Relationships> extends true ? SelectQueryError<`Could not embed because more than one relationship was found for '${RelatedRelationName}' and '${CurrentTableOrView}' you need to hint the column with ${RelatedRelationName}!<columnName> ?`> : {
    referencedTable: TablesAndViews<Schema>[RelatedRelationName];
    relation: FoundRelation;
    direction: 'reverse';
    from: CurrentTableOrView;
} : SelectQueryError<`Relation '${RelatedRelationName}' not found in schema.`> : false : false : false;
export type FindMatchingTableRelationships<Schema extends GenericSchema, Relationships extends GenericRelationship[], value extends string> = Relationships extends [infer R, ...infer Rest] ? Rest extends GenericRelationship[] ? R extends {
    referencedRelation: infer ReferencedRelation;
} ? ReferencedRelation extends keyof Schema['Tables'] ? R extends {
    foreignKeyName: value;
} ? R & {
    match: 'fkname';
} : R extends {
    referencedRelation: value;
} ? R & {
    match: 'refrel';
} : R extends {
    columns: [value];
} ? R & {
    match: 'col';
} : FindMatchingTableRelationships<Schema, Rest, value> : FindMatchingTableRelationships<Schema, Rest, value> : false : false : false;
export type FindMatchingViewRelationships<Schema extends GenericSchema, Relationships extends GenericRelationship[], value extends string> = Relationships extends [infer R, ...infer Rest] ? Rest extends GenericRelationship[] ? R extends {
    referencedRelation: infer ReferencedRelation;
} ? ReferencedRelation extends keyof Schema['Views'] ? R extends {
    foreignKeyName: value;
} ? R & {
    match: 'fkname';
} : R extends {
    referencedRelation: value;
} ? R & {
    match: 'refrel';
} : R extends {
    columns: [value];
} ? R & {
    match: 'col';
} : FindMatchingViewRelationships<Schema, Rest, value> : FindMatchingViewRelationships<Schema, Rest, value> : false : false : false;
export type FindMatchingHintTableRelationships<Schema extends GenericSchema, Relationships extends GenericRelationship[], hint extends string, name extends string> = Relationships extends [infer R, ...infer Rest] ? Rest extends GenericRelationship[] ? R extends {
    referencedRelation: infer ReferencedRelation;
} ? ReferencedRelation extends name ? R extends {
    foreignKeyName: hint;
} ? R & {
    match: 'fkname';
} : R extends {
    referencedRelation: hint;
} ? R & {
    match: 'refrel';
} : R extends {
    columns: [hint];
} ? R & {
    match: 'col';
} : FindMatchingHintTableRelationships<Schema, Rest, hint, name> : FindMatchingHintTableRelationships<Schema, Rest, hint, name> : false : false : false;
export type FindMatchingHintViewRelationships<Schema extends GenericSchema, Relationships extends GenericRelationship[], hint extends string, name extends string> = Relationships extends [infer R, ...infer Rest] ? Rest extends GenericRelationship[] ? R extends {
    referencedRelation: infer ReferencedRelation;
} ? ReferencedRelation extends name ? R extends {
    foreignKeyName: hint;
} ? R & {
    match: 'fkname';
} : R extends {
    referencedRelation: hint;
} ? R & {
    match: 'refrel';
} : R extends {
    columns: [hint];
} ? R & {
    match: 'col';
} : FindMatchingHintViewRelationships<Schema, Rest, hint, name> : FindMatchingHintViewRelationships<Schema, Rest, hint, name> : false : false : false;
type IsColumnsNullable<Table extends Pick<GenericTable, 'Row'>, Columns extends (keyof Table['Row'])[]> = Columns extends [infer Column, ...infer Rest] ? Column extends keyof Table['Row'] ? ContainsNull<Table['Row'][Column]> extends true ? true : IsColumnsNullable<Table, Rest extends (keyof Table['Row'])[] ? Rest : []> : false : false;
export type IsRelationNullable<Table extends GenericTable, Relation extends GenericRelationship> = IsColumnsNullable<Table, Relation['columns']>;
type TableForwardRelationships<Schema extends GenericSchema, TName> = TName extends keyof TablesAndViews<Schema> ? UnionToArray<RecursivelyFindRelationships<Schema, TName, keyof TablesAndViews<Schema>>> extends infer R ? R extends (GenericRelationship & {
    from: keyof TablesAndViews<Schema>;
})[] ? R : [] : [] : [];
type RecursivelyFindRelationships<Schema extends GenericSchema, TName, Keys extends keyof TablesAndViews<Schema>> = Keys extends infer K ? K extends keyof TablesAndViews<Schema> ? FilterRelationships<TablesAndViews<Schema>[K]['Relationships'], TName, K> extends never ? RecursivelyFindRelationships<Schema, TName, Exclude<Keys, K>> : FilterRelationships<TablesAndViews<Schema>[K]['Relationships'], TName, K> | RecursivelyFindRelationships<Schema, TName, Exclude<Keys, K>> : false : false;
type FilterRelationships<R, TName, From> = R extends readonly (infer Rel)[] ? Rel extends {
    referencedRelation: TName;
} ? Rel & {
    from: From;
} : never : never;
export type ResolveForwardRelationship<Schema extends GenericSchema, Field extends Ast.FieldNode, CurrentTableOrView extends keyof TablesAndViews<Schema> & string> = FindFieldMatchingRelationships<Schema, TablesAndViews<Schema>[Field['name']]['Relationships'], Ast.FieldNode & {
    name: CurrentTableOrView;
    hint: Field['hint'];
}> extends infer FoundByName ? FoundByName extends GenericRelationship ? {
    referencedTable: TablesAndViews<Schema>[Field['name']];
    relation: FoundByName;
    direction: 'forward';
    from: Field['name'];
    type: 'found-by-name';
} : FindFieldMatchingRelationships<Schema, TableForwardRelationships<Schema, CurrentTableOrView>, Field> extends infer FoundByMatch ? FoundByMatch extends GenericRelationship & {
    from: keyof TablesAndViews<Schema>;
} ? {
    referencedTable: TablesAndViews<Schema>[FoundByMatch['from']];
    relation: FoundByMatch;
    direction: 'forward';
    from: CurrentTableOrView;
    type: 'found-by-match';
} : FindJoinTableRelationship<Schema, CurrentTableOrView, Field['name']> extends infer FoundByJoinTable ? FoundByJoinTable extends GenericRelationship ? {
    referencedTable: TablesAndViews<Schema>[FoundByJoinTable['referencedRelation']];
    relation: FoundByJoinTable & {
        match: 'refrel';
    };
    direction: 'forward';
    from: CurrentTableOrView;
    type: 'found-by-join-table';
} : ResolveEmbededFunctionJoinTableRelationship<Schema, CurrentTableOrView, Field['name']> extends infer FoundEmbededFunctionJoinTableRelation ? FoundEmbededFunctionJoinTableRelation extends GenericSetofOption ? {
    referencedTable: TablesAndViews<Schema>[FoundEmbededFunctionJoinTableRelation['to']];
    relation: {
        foreignKeyName: `${Field['name']}_${CurrentTableOrView}_${FoundEmbededFunctionJoinTableRelation['to']}_forward`;
        columns: [];
        isOneToOne: FoundEmbededFunctionJoinTableRelation['isOneToOne'] extends true ? true : false;
        referencedColumns: [];
        referencedRelation: FoundEmbededFunctionJoinTableRelation['to'];
    } & {
        match: 'func';
        isNotNullable: FoundEmbededFunctionJoinTableRelation['isNotNullable'] extends true ? true : FoundEmbededFunctionJoinTableRelation['isSetofReturn'] extends true ? false : true;
        isSetofReturn: FoundEmbededFunctionJoinTableRelation['isSetofReturn'];
    };
    direction: 'forward';
    from: CurrentTableOrView;
    type: 'found-by-embeded-function';
} : SelectQueryError<`could not find the relation between ${CurrentTableOrView} and ${Field['name']}`> : SelectQueryError<`could not find the relation between ${CurrentTableOrView} and ${Field['name']}`> : SelectQueryError<`could not find the relation between ${CurrentTableOrView} and ${Field['name']}`> : SelectQueryError<`could not find the relation between ${CurrentTableOrView} and ${Field['name']}`> : SelectQueryError<`could not find the relation between ${CurrentTableOrView} and ${Field['name']}`>;
/**
 * Given a CurrentTableOrView, finds all join tables to this relation.
 * For example, if products and categories are linked via product_categories table:
 *
 * @example
 * Given:
 * - CurrentTableView = 'products'
 * - FieldName = "categories"
 *
 * It should return this relationship from product_categories:
 * {
 *   foreignKeyName: "product_categories_category_id_fkey",
 *   columns: ["category_id"],
 *   isOneToOne: false,
 *   referencedRelation: "categories",
 *   referencedColumns: ["id"]
 * }
 */
type ResolveJoinTableRelationship<Schema extends GenericSchema, CurrentTableOrView extends keyof TablesAndViews<Schema> & string, FieldName extends string> = {
    [TableName in keyof TablesAndViews<Schema>]: DeduplicateRelationships<TablesAndViews<Schema>[TableName]['Relationships']> extends readonly (infer Rel)[] ? Rel extends {
        referencedRelation: CurrentTableOrView;
    } ? DeduplicateRelationships<TablesAndViews<Schema>[TableName]['Relationships']> extends readonly (infer OtherRel)[] ? OtherRel extends {
        referencedRelation: FieldName;
    } ? OtherRel : never : never : never : never;
}[keyof TablesAndViews<Schema>];
type ResolveEmbededFunctionJoinTableRelationship<Schema extends GenericSchema, CurrentTableOrView extends keyof TablesAndViews<Schema> & string, FieldName extends string> = FindMatchingFunctionBySetofFrom<Schema['Functions'][FieldName], CurrentTableOrView> extends infer Fn ? Fn extends GenericFunction ? Fn['SetofOptions'] : false : false;
export type FindJoinTableRelationship<Schema extends GenericSchema, CurrentTableOrView extends keyof TablesAndViews<Schema> & string, FieldName extends string> = ResolveJoinTableRelationship<Schema, CurrentTableOrView, FieldName> extends infer Result ? [Result] extends [never] ? false : Result : never;
/**
 * Finds a matching relationship based on the FieldNode's name and optional hint.
 */
export type FindFieldMatchingRelationships<Schema extends GenericSchema, Relationships extends GenericRelationship[], Field extends Ast.FieldNode> = Field extends {
    hint: string;
} ? FindMatchingHintTableRelationships<Schema, Relationships, Field['hint'], Field['name']> extends GenericRelationship ? FindMatchingHintTableRelationships<Schema, Relationships, Field['hint'], Field['name']> & {
    branch: 'found-in-table-via-hint';
    hint: Field['hint'];
} : FindMatchingHintViewRelationships<Schema, Relationships, Field['hint'], Field['name']> extends GenericRelationship ? FindMatchingHintViewRelationships<Schema, Relationships, Field['hint'], Field['name']> & {
    branch: 'found-in-view-via-hint';
    hint: Field['hint'];
} : SelectQueryError<'Failed to find matching relation via hint'> : FindMatchingTableRelationships<Schema, Relationships, Field['name']> extends GenericRelationship ? FindMatchingTableRelationships<Schema, Relationships, Field['name']> & {
    branch: 'found-in-table-via-name';
    name: Field['name'];
} : FindMatchingViewRelationships<Schema, Relationships, Field['name']> extends GenericRelationship ? FindMatchingViewRelationships<Schema, Relationships, Field['name']> & {
    branch: 'found-in-view-via-name';
    name: Field['name'];
} : SelectQueryError<'Failed to find matching relation via name'>;
export type JsonPathToAccessor<Path extends string> = Path extends `${infer P1}->${infer P2}` ? P2 extends `>${infer Rest}` ? JsonPathToAccessor<`${P1}.${Rest}`> : P2 extends string ? JsonPathToAccessor<`${P1}.${P2}`> : Path : Path extends `>${infer Rest}` ? JsonPathToAccessor<Rest> : Path extends `${infer P1}::${infer _}` ? JsonPathToAccessor<P1> : Path extends `${infer P1}${')' | ','}${infer _}` ? P1 : Path;
export type JsonPathToType<T, Path extends string> = Path extends '' ? T : ContainsNull<T> extends true ? JsonPathToType<Exclude<T, null>, Path> : Path extends `${infer Key}.${infer Rest}` ? Key extends keyof T ? JsonPathToType<T[Key], Rest> : never : Path extends keyof T ? T[Path] : never;
export type IsStringUnion<T> = string extends T ? false : T extends string ? [T] extends [never] ? false : true : false;
type MatchingFunctionBySetofFrom<Fn extends GenericFunction, TableName extends string> = Fn['SetofOptions'] extends GenericSetofOption ? TableName extends Fn['SetofOptions']['from'] ? Fn : never : false;
type FindMatchingFunctionBySetofFrom<FnUnion, TableName extends string> = FnUnion extends infer Fn extends GenericFunction ? MatchingFunctionBySetofFrom<Fn, TableName> : false;
type ComputedField<Schema extends GenericSchema, RelationName extends keyof TablesAndViews<Schema>, FieldName extends keyof TablesAndViews<Schema>[RelationName]['Row']> = FieldName extends keyof Schema['Functions'] ? Schema['Functions'][FieldName] extends {
    Args: {
        '': TablesAndViews<Schema>[RelationName]['Row'];
    };
    Returns: any;
} ? FieldName : never : never;
export type GetComputedFields<Schema extends GenericSchema, RelationName extends keyof TablesAndViews<Schema>> = {
    [K in keyof TablesAndViews<Schema>[RelationName]['Row']]: ComputedField<Schema, RelationName, K>;
}[keyof TablesAndViews<Schema>[RelationName]['Row']];
export {};
//# sourceMappingURL=utils.d.ts.map