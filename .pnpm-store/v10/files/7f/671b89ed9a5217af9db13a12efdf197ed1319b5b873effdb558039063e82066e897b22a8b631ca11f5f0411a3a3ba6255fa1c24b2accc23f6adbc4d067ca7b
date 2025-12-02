import { Value } from "../values/index.js";

// Document Types  /////////////////////////////////////////////////////////////

/**
 * A document stored in Convex.
 * @public
 */
export type GenericDocument = Record<string, Value>;

/**
 * A type describing all of the document fields in a table.
 *
 * These can either be field names (like "name") or references to fields on
 * nested objects (like "properties.name").
 * @public
 */
export type GenericFieldPaths = string;

// Index Types  ///////////////////////////////////////////////////////////////

/**
 * A type describing the ordered fields in an index.
 *
 * These can either be field names (like "name") or references to fields on
 * nested objects (like "properties.name").
 * @public
 */
export type GenericIndexFields = string[];

/**
 * A type describing the indexes in a table.
 *
 * It's an object mapping each index name to the fields in the index.
 * @public
 */
export type GenericTableIndexes = Record<string, GenericIndexFields>;

/**
 * A type describing the configuration of a search index.
 * @public
 */
export type GenericSearchIndexConfig = {
  searchField: string;
  filterFields: string;
};

/**
 * A type describing all of the search indexes in a table.
 *
 * This is an object mapping each index name to the config for the index.
 * @public
 */
export type GenericTableSearchIndexes = Record<
  string,
  GenericSearchIndexConfig
>;

/**
 * A type describing the configuration of a vector index.
 * @public
 */
export type GenericVectorIndexConfig = {
  vectorField: string;
  dimensions: number;
  filterFields: string;
};

/**
 * A type describing all of the vector indexes in a table.
 *
 * This is an object mapping each index name to the config for the index.
 * @public
 */
export type GenericTableVectorIndexes = Record<
  string,
  GenericVectorIndexConfig
>;
/**
 * If we have A | B | C, this finds A[Key] | B[Key] | C[Key], where we default to
 * `Default` if the Key isn't found.
 *
 * Conditional types apparently loop over the variants in a union, so the `T extends T`
 * is enough to force this behavior.
 * https://stackoverflow.com/questions/49401866/all-possible-keys-of-an-union-type
 */

type ValueFromUnion<T, Key, Default> = T extends T
  ? Key extends keyof T
    ? T[Key]
    : Default
  : never;

/**
 * The type of a field in a document.
 *
 * Note that this supports both simple fields like "name" and nested fields like
 * "properties.name".
 *
 * If the field is not present in the document it is considered to be `undefined`.
 *
 * @public
 */
export type FieldTypeFromFieldPath<
  Document extends GenericDocument,
  FieldPath extends string,
> =
  FieldTypeFromFieldPathInner<Document, FieldPath> extends Value | undefined
    ? FieldTypeFromFieldPathInner<Document, FieldPath>
    : Value | undefined;

/**
 * The inner type of {@link FieldTypeFromFieldPath}.
 *
 * It's wrapped in a helper to coerce the type to `Value | undefined` since some
 * versions of TypeScript fail to infer this type correctly.
 *
 * @public
 */
export type FieldTypeFromFieldPathInner<
  Document extends GenericDocument,
  FieldPath extends string,
> = FieldPath extends `${infer First}.${infer Second}`
  ? ValueFromUnion<
      Document,
      First,
      Record<never, never>
    > extends infer FieldValue
    ? // The fact that `extends infer` extracts the generic document out of a union of a
      // Value and record of Values (GenericDocument) is due to the feature
      // "Distributive Conditional Types" in the TypeScript Handbook:
      // https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
      FieldValue extends GenericDocument
      ? FieldTypeFromFieldPath<FieldValue, Second>
      : undefined
    : undefined
  : ValueFromUnion<Document, FieldPath, undefined>;

// Table Types /////////////////////////////////////////////////////////////////

/**
 * A type describing the document type and indexes in a table.
 * @public
 */
export type GenericTableInfo = {
  document: GenericDocument;
  fieldPaths: GenericFieldPaths;
  indexes: GenericTableIndexes;
  searchIndexes: GenericTableSearchIndexes;
  vectorIndexes: GenericTableVectorIndexes;
};

/**
 * The type of a document in a table for a given {@link GenericTableInfo}.
 * @public
 */
export type DocumentByInfo<TableInfo extends GenericTableInfo> =
  TableInfo["document"];

/**
 * The field paths in a table for a given {@link GenericTableInfo}.
 *
 * These can either be field names (like "name") or references to fields on
 * nested objects (like "properties.name").
 * @public
 */
export type FieldPaths<TableInfo extends GenericTableInfo> =
  TableInfo["fieldPaths"];

/**
 * The database indexes in a table for a given {@link GenericTableInfo}.
 *
 * This will be an object mapping index names to the fields in the index.
 * @public
 */
export type Indexes<TableInfo extends GenericTableInfo> = TableInfo["indexes"];

/**
 * The names of indexes in a table for a given {@link GenericTableInfo}.
 * @public
 */
export type IndexNames<TableInfo extends GenericTableInfo> =
  keyof Indexes<TableInfo>;

/**
 * Extract the fields of an index from a {@link GenericTableInfo} by name.
 * @public
 */
export type NamedIndex<
  TableInfo extends GenericTableInfo,
  IndexName extends IndexNames<TableInfo>,
> = Indexes<TableInfo>[IndexName];

/**
 * The search indexes in a table for a given {@link GenericTableInfo}.
 *
 * This will be an object mapping index names to the search index config.
 * @public
 */
export type SearchIndexes<TableInfo extends GenericTableInfo> =
  TableInfo["searchIndexes"];

/**
 * The names of search indexes in a table for a given {@link GenericTableInfo}.
 * @public
 */
export type SearchIndexNames<TableInfo extends GenericTableInfo> =
  keyof SearchIndexes<TableInfo>;

/**
 * Extract the config of a search index from a {@link GenericTableInfo} by name.
 * @public
 */
export type NamedSearchIndex<
  TableInfo extends GenericTableInfo,
  IndexName extends SearchIndexNames<TableInfo>,
> = SearchIndexes<TableInfo>[IndexName];

/**
 * The vector indexes in a table for a given {@link GenericTableInfo}.
 *
 * This will be an object mapping index names to the vector index config.
 * @public
 */
export type VectorIndexes<TableInfo extends GenericTableInfo> =
  TableInfo["vectorIndexes"];

/**
 * The names of vector indexes in a table for a given {@link GenericTableInfo}.
 * @public
 */
export type VectorIndexNames<TableInfo extends GenericTableInfo> =
  keyof VectorIndexes<TableInfo>;

/**
 * Extract the config of a vector index from a {@link GenericTableInfo} by name.
 * @public
 */
export type NamedVectorIndex<
  TableInfo extends GenericTableInfo,
  IndexName extends VectorIndexNames<TableInfo>,
> = VectorIndexes<TableInfo>[IndexName];

// Data Model Types ////////////////////////////////////////////////////////////

/**
 * A type describing the tables in a Convex project.
 *
 * This is designed to be code generated with `npx convex dev`.
 * @public
 */
export type GenericDataModel = Record<string, GenericTableInfo>;

/**
 * A {@link GenericDataModel} that considers documents to be `any` and does not
 * support indexes.
 *
 * This is the default before a schema is defined.
 * @public
 */
export type AnyDataModel = {
  [tableName: string]: {
    document: any;
    fieldPaths: GenericFieldPaths;
    indexes: {};
    searchIndexes: {};
    vectorIndexes: {};
  };
};

/**
 * A type of all of the table names defined in a {@link GenericDataModel}.
 * @public
 */
export type TableNamesInDataModel<DataModel extends GenericDataModel> =
  keyof DataModel & string;

/**
 * Extract the `TableInfo` for a table in a {@link GenericDataModel} by table
 * name.
 *
 * @public
 */
export type NamedTableInfo<
  DataModel extends GenericDataModel,
  TableName extends keyof DataModel,
> = DataModel[TableName];

/**
 * The type of a document in a {@link GenericDataModel} by table name.
 * @public
 */
export type DocumentByName<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>,
> = DataModel[TableName]["document"];
