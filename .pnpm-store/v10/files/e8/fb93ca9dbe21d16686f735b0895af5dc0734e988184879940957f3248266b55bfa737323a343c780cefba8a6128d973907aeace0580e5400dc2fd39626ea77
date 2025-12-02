import { MutationState } from './mutationstate';
import { SearchFacet } from './searchfacet';
import { SearchQuery } from './searchquery';
import { SearchSort } from './searchsort';
import { VectorSearch } from './vectorsearch';
/**
 * SearchMetaData represents the meta-data available from a search query.
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Full Text Search
 */
export declare class SearchMetaData {
}
/**
 * SearchRow represents the data available from a row of a search query.
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Full Text Search
 */
export declare class SearchRow {
}
/**
 * Contains the results of a search query.
 *
 * @category Full Text Search
 */
export declare class SearchResult {
    /**
     * The rows which have been returned by the query.
     */
    rows: any[];
    /**
     * The meta-data which has been returned by the query.
     */
    meta: SearchMetaData;
    /**
     * @internal
     */
    constructor(data: SearchResult);
}
/**
 * Specifies the highlight style that should be used for matches in the results.
 *
 * @category Full Text Search
 */
export declare enum HighlightStyle {
    /**
     * Indicates that matches should be highlighted using HTML tags in the result text.
     */
    HTML = "html",
    /**
     * Indicates that matches should be highlighted using ASCII coding in the result test.
     */
    ANSI = "ansi"
}
/**
 * Represents the various scan consistency options that are available when
 * querying against the query service.
 *
 * @category Full Text Search
 */
export declare enum SearchScanConsistency {
    /**
     * Indicates that no specific consistency is required, this is the fastest
     * options, but results may not include the most recent operations which have
     * been performed.
     */
    NotBounded = "not_bounded"
}
/**
 * @category Full Text Search
 */
export interface SearchQueryOptions {
    /**
     * Specifies the number of results to skip from the index before returning
     * results.
     */
    skip?: number;
    /**
     * Specifies the limit to the number of results that should be returned.
     */
    limit?: number;
    /**
     * Configures whether the result should contain the execution plan for the query.
     */
    explain?: boolean;
    /**
     * Specifies how the highlighting should behave.  Specifically which mode should be
     * used for highlighting as well as which fields should be highlighted.
     */
    highlight?: {
        style?: HighlightStyle;
        fields?: string[];
    };
    /**
     * Specifies the collections which should be searched as part of the query.
     */
    collections?: string[];
    /**
     * Specifies the list of fields which should be searched.
     */
    fields?: string[];
    /**
     * Specifies any facets that should be included in the query.
     */
    facets?: {
        [name: string]: SearchFacet;
    };
    /**
     * Specifies a list of fields or SearchSort's to use when sorting the result sets.
     */
    sort?: string[] | SearchSort[];
    /**
     * Specifies that scoring should be disabled.  This improves performance but makes it
     * impossible to sort based on how well a particular result scored.
     */
    disableScoring?: boolean;
    /**
     * If set to true, will include the locations in the search result.
     *
     * @experimental This API is subject to change without notice.
     */
    includeLocations?: boolean;
    /**
     * Specifies the consistency requirements when executing the query.
     *
     * @see SearchScanConsistency
     */
    consistency?: SearchScanConsistency;
    /**
     * Specifies a MutationState which the query should be consistent with.
     *
     * @see {@link MutationState}
     */
    consistentWith?: MutationState;
    /**
     * Specifies any additional parameters which should be passed to the query engine
     * when executing the query.
     */
    raw?: {
        [key: string]: any;
    };
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
    /**
     * Specifies that the search response should include the request JSON.
     */
    showRequest?: boolean;
    /**
     * Uncommitted: This API is subject to change in the future.
     * Specifies that the search request should appear in the log.
     */
    logRequest?: boolean;
    /**
     * Uncommitted: This API is subject to change in the future.
     * Specifies that the search response should appear in the log.
     */
    logResponse?: boolean;
}
/**
 *  Represents a search query and/or vector search to execute via the Couchbase Full Text Search (FTS) service.
 *
 * @category Full Text Search
 */
export declare class SearchRequest {
    private _searchQuery;
    private _vectorSearch;
    constructor(query: SearchQuery | VectorSearch);
    /**
     * @internal
     */
    get searchQuery(): SearchQuery | undefined;
    /**
     * @internal
     */
    get vectorSearch(): VectorSearch | undefined;
    /**
     * Adds a search query to the request if the request does not already have a search query.
     *
     * @param query A SearchQuery to add to the request.
     */
    withSearchQuery(query: SearchQuery): SearchRequest;
    /**
     * Adds a vector search to the request if the request does not already have a vector search.
     *
     * @param search A VectorSearch to add to the request.
     */
    withVectorSearch(search: VectorSearch): SearchRequest;
    /**
     * Creates a search request.
     *
     * @param query Either a SearchQuery or VectorSearch to add to the search request.
     */
    static create(query: SearchQuery | VectorSearch): SearchRequest;
}
