import { Id, Value } from "../values/value.js";
import {
  DocumentByInfo,
  FieldTypeFromFieldPath,
  GenericDataModel,
  GenericDocument,
  GenericTableInfo,
  GenericVectorIndexConfig,
  NamedTableInfo,
  NamedVectorIndex,
  TableNamesInDataModel,
  VectorIndexNames,
} from "./data_model.js";

/**
 * An object with parameters for performing a vector search against a vector index.
 * @public
 */
export interface VectorSearchQuery<
  TableInfo extends GenericTableInfo,
  IndexName extends VectorIndexNames<TableInfo>,
> {
  /**
   * The query vector.
   *
   * This must have the same length as the `dimensions` of the index.
   * This vector search will return the IDs of the documents most similar to
   * this vector.
   */
  vector: number[];
  /**
   * The number of results to return. If specified, must be between 1 and 256
   * inclusive.
   *
   * @default 10
   */
  limit?: number;
  /**
   * Optional filter expression made up of `q.or` and `q.eq` operating
   * over the filter fields of the index.
   *
   * e.g. `filter: q => q.or(q.eq("genre", "comedy"), q.eq("genre", "drama"))`
   *
   * @param q
   * @returns
   */
  filter?: (
    q: VectorFilterBuilder<
      DocumentByInfo<TableInfo>,
      NamedVectorIndex<TableInfo, IndexName>
    >,
  ) => FilterExpression<boolean>;
}

export type VectorSearch<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>,
  IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
> = (
  tableName: TableName,
  indexName: IndexName,
  query: VectorSearchQuery<NamedTableInfo<DataModel, TableName>, IndexName>,
) => Promise<Array<{ _id: Id<TableName>; _score: number }>>;

/**
 * Expressions are evaluated to produce a {@link values.Value} in the course of executing a query.
 *
 * To construct an expression, use the {@link VectorFilterBuilder} provided within
 * {@link VectorSearchQuery}.
 *
 * @typeParam T - The type that this expression evaluates to.
 * @public
 */
export abstract class FilterExpression<T extends Value | undefined> {
  // Property for nominal type support.
  private _isExpression: undefined;

  // Property to distinguish expressions by the type they resolve to.
  private _value!: T;

  /**
   * @internal
   */
  constructor() {
    // only defining the constructor so we can mark it as internal and keep
    // it out of the docs.
  }
}

/**
 * An interface for defining filters for vector searches.
 *
 * This has a similar interface to {@link FilterBuilder}, which is used in
 * database queries, but supports only the methods that can be efficiently
 * done in a vector search.
 *
 * @public
 */
export interface VectorFilterBuilder<
  Document extends GenericDocument,
  VectorIndexConfig extends GenericVectorIndexConfig,
> {
  //  Comparisons  /////////////////////////////////////////////////////////////

  /**
   * Is the field at `fieldName` equal to `value`
   *
   * @public
   * */
  eq<FieldName extends VectorIndexConfig["filterFields"]>(
    fieldName: FieldName,
    value: FieldTypeFromFieldPath<Document, FieldName>,
  ): FilterExpression<boolean>;

  //  Logic  ///////////////////////////////////////////////////////////////////

  /**
   * `exprs[0] || exprs[1] || ... || exprs[n]`
   *
   * @public
   */
  or(...exprs: Array<FilterExpression<boolean>>): FilterExpression<boolean>;
}
