import {
  FieldTypeFromFieldPath,
  GenericDocument,
  GenericSearchIndexConfig,
} from "./data_model.js";

/**
 * Builder for defining search filters.
 *
 * A search filter is a chained list of:
 * 1. One search expression constructed with `.search`.
 * 2. Zero or more equality expressions constructed with `.eq`.
 *
 * The search expression must search for text in the index's `searchField`. The
 * filter expressions can use any of the `filterFields` defined in the index.
 *
 * For all other filtering use {@link OrderedQuery.filter}.
 *
 * To learn about full text search, see [Indexes](https://docs.convex.dev/text-search).
 * @public
 */
export interface SearchFilterBuilder<
  Document extends GenericDocument,
  SearchIndexConfig extends GenericSearchIndexConfig,
> {
  /**
   * Search for the terms in `query` within `doc[fieldName]`.
   *
   * This will do a full text search that returns results where any word of of
   * `query` appears in the field.
   *
   * Documents will be returned based on their relevance to the query. This
   * takes into account:
   * - How many words in the query appear in the text?
   * - How many times do they appear?
   * - How long is the text field?
   *
   * @param fieldName - The name of the field to search in. This must be listed
   * as the index's `searchField`.
   * @param query - The query text to search for.
   */
  search(
    fieldName: SearchIndexConfig["searchField"],
    query: string,
  ): SearchFilterFinalizer<Document, SearchIndexConfig>;
}

/**
 * Builder to define equality expressions as part of a search filter.
 *
 * See {@link SearchFilterBuilder}.
 *
 * @public
 */
export interface SearchFilterFinalizer<
  Document extends GenericDocument,
  SearchIndexConfig extends GenericSearchIndexConfig,
> extends SearchFilter {
  /**
   * Restrict this query to documents where `doc[fieldName] === value`.
   *
   * @param fieldName - The name of the field to compare. This must be listed in
   * the search index's `filterFields`.
   * @param value - The value to compare against.
   */
  eq<FieldName extends SearchIndexConfig["filterFields"]>(
    fieldName: FieldName,
    value: FieldTypeFromFieldPath<Document, FieldName>,
  ): SearchFilterFinalizer<Document, SearchIndexConfig>;
}

/**
 * An expression representing a search filter created by
 * {@link SearchFilterBuilder}.
 *
 * @public
 */
export abstract class SearchFilter {
  // Property for nominal type support.
  private _isSearchFilter: undefined;

  /**
   * @internal
   */
  constructor() {
    // only defining the constructor so we can mark it as internal and keep
    // it out of the docs.
  }
}
