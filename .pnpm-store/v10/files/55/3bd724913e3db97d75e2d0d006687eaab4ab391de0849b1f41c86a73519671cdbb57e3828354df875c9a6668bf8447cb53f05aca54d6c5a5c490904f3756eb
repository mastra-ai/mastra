/**
 * Specifies how the individual match terms should be logically concatenated.
 *
 * @experimental This API is subject to change without notice.
 * @category Full Text Search
 */
export declare enum MatchOperator {
    /**
     * Specifies that individual match terms are concatenated with a logical OR - this is the default if not provided.
     */
    Or = "or",
    /**
     * Specifies that individual match terms are concatenated with a logical AND.
     */
    And = "and"
}
/**
 * GeoPoint represents a specific coordinate on earth.  We support
 * a number of different variants of geopoints being specified.
 *
 * @category Full Text Search
 */
export type GeoPoint = [longitude: number, latitude: number] | {
    lon: number;
    lat: number;
} | {
    longitude: number;
    latitude: number;
};
/**
 * Provides the ability to specify the query for a search query.
 *
 * @category Full Text Search
 */
export declare class SearchQuery {
    protected _data: any;
    constructor(data: any);
    toJSON(): any;
    /**
     * @internal
     */
    static toJSON(query: SearchQuery | any): any;
    /**
     * @internal
     */
    static hasProp(query: SearchQuery | any, prop: string): boolean;
    static match(match: string): MatchSearchQuery;
    static matchPhrase(phrase: string): MatchPhraseSearchQuery;
    static regexp(regexp: string): RegexpSearchQuery;
    static queryString(query: string): QueryStringSearchQuery;
    static numericRange(): NumericRangeSearchQuery;
    static dateRange(): DateRangeSearchQuery;
    static termRange(): TermRangeSearchQuery;
    /**
     * Creates a ConjunctionSearchQuery from a set of other SearchQuery's.
     *
     * @deprecated Use the multi-argument overload instead.
     */
    static conjuncts(queries: SearchQuery[]): ConjunctionSearchQuery;
    /**
     * Creates a ConjunctionSearchQuery from a set of other SearchQuery's.
     */
    static conjuncts(...queries: SearchQuery[]): ConjunctionSearchQuery;
    /**
     * Creates a DisjunctionSearchQuery from a set of other SearchQuery's.
     *
     * @deprecated Use the multi-argument overload instead.
     */
    static disjuncts(queries: SearchQuery[]): DisjunctionSearchQuery;
    /**
     * Creates a DisjunctionSearchQuery from a set of other SearchQuery's.
     */
    static disjuncts(...queries: SearchQuery[]): DisjunctionSearchQuery;
    static boolean(): BooleanSearchQuery;
    static wildcard(wildcard: string): WildcardSearchQuery;
    /**
     * Creates a DocIdSearchQuery from a set of document-ids.
     *
     * @deprecated Use the multi-argument overload instead.
     */
    static docIds(queries: string[]): DocIdSearchQuery;
    /**
     * Creates a DocIdSearchQuery from a set of document-ids.
     */
    static docIds(...queries: string[]): DocIdSearchQuery;
    static booleanField(val: boolean): BooleanFieldSearchQuery;
    static term(term: string): TermSearchQuery;
    static phrase(terms: string[]): PhraseSearchQuery;
    static prefix(prefix: string): PrefixSearchQuery;
    static matchAll(): MatchAllSearchQuery;
    static matchNone(): MatchNoneSearchQuery;
    static geoDistance(lon: number, lat: number, distance: string): GeoDistanceSearchQuery;
    static geoBoundingBox(tl_lon: number, tl_lat: number, br_lon: number, br_lat: number): GeoBoundingBoxSearchQuery;
    static geoPolygon(points: GeoPoint[]): GeoPolygonSearchQuery;
}
/**
 * Represents a match search query.
 *
 * @category Full Text Search
 */
export declare class MatchSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(match: string);
    operator(op: MatchOperator): MatchSearchQuery;
    field(field: string): MatchSearchQuery;
    analyzer(analyzer: string): MatchSearchQuery;
    prefixLength(prefixLength: number): MatchSearchQuery;
    fuzziness(fuzziness: number): MatchSearchQuery;
    boost(boost: number): MatchSearchQuery;
}
/**
 * Represents a match-phrase search query.
 *
 * @category Full Text Search
 */
export declare class MatchPhraseSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(phrase: string);
    field(field: string): MatchPhraseSearchQuery;
    analyzer(analyzer: string): MatchPhraseSearchQuery;
    boost(boost: number): MatchPhraseSearchQuery;
}
/**
 * Represents a regexp search query.
 *
 * @category Full Text Search
 */
export declare class RegexpSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(regexp: string);
    field(field: string): RegexpSearchQuery;
    boost(boost: number): RegexpSearchQuery;
}
/**
 * Represents a query-string search query.
 *
 * @category Full Text Search
 */
export declare class QueryStringSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(query: string);
    boost(boost: number): QueryStringSearchQuery;
}
/**
 * Represents a numeric-range search query.
 *
 * @category Full Text Search
 */
export declare class NumericRangeSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor();
    min(min: number, inclusive?: boolean): NumericRangeSearchQuery;
    max(max: number, inclusive?: boolean): NumericRangeSearchQuery;
    field(field: string): NumericRangeSearchQuery;
    boost(boost: number): NumericRangeSearchQuery;
}
/**
 * Represents a date-range search query.
 *
 * @category Full Text Search
 */
export declare class DateRangeSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor();
    start(start: Date | string, inclusive?: boolean): DateRangeSearchQuery;
    end(end: Date | string, inclusive?: boolean): DateRangeSearchQuery;
    field(field: string): DateRangeSearchQuery;
    dateTimeParser(parser: string): DateRangeSearchQuery;
    boost(boost: number): DateRangeSearchQuery;
}
/**
 * Represents a term-range search query.
 *
 * @category Full Text Search
 */
export declare class TermRangeSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor();
    min(min: string, inclusive?: boolean): TermRangeSearchQuery;
    max(max: string, inclusive?: boolean): TermRangeSearchQuery;
    field(field: string): TermRangeSearchQuery;
    boost(boost: number): TermRangeSearchQuery;
}
/**
 * Represents a conjunction search query.
 *
 * @category Full Text Search
 */
export declare class ConjunctionSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(...queries: SearchQuery[]);
    /**
     * Adds additional queries to this conjunction query.
     *
     * @deprecated Use the multi-argument overload instead.
     */
    and(queries: SearchQuery[]): ConjunctionSearchQuery;
    /**
     * Adds additional queries to this conjunction query.
     */
    and(...queries: SearchQuery[]): ConjunctionSearchQuery;
    boost(boost: number): ConjunctionSearchQuery;
}
/**
 * Represents a disjunction search query.
 *
 * @category Full Text Search
 */
export declare class DisjunctionSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(...queries: SearchQuery[]);
    /**
     * Adds additional queries to this disjunction query.
     *
     * @deprecated Use the multi-argument overload instead.
     */
    or(queries: SearchQuery[]): DisjunctionSearchQuery;
    /**
     * Adds additional queries to this disjunction query.
     */
    or(...queries: SearchQuery[]): DisjunctionSearchQuery;
    boost(boost: number): DisjunctionSearchQuery;
}
/**
 * Represents a boolean search query.
 *
 * @category Full Text Search
 */
export declare class BooleanSearchQuery extends SearchQuery {
    private _shouldMin;
    /**
     * @internal
     */
    constructor();
    must(query: ConjunctionSearchQuery): BooleanSearchQuery;
    should(query: DisjunctionSearchQuery): BooleanSearchQuery;
    mustNot(query: DisjunctionSearchQuery): BooleanSearchQuery;
    shouldMin(shouldMin: number): BooleanSearchQuery;
    boost(boost: number): BooleanSearchQuery;
    toJSON(): any;
}
/**
 * Represents a wildcard search query.
 *
 * @category Full Text Search
 */
export declare class WildcardSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(wildcard: string);
    field(field: string): WildcardSearchQuery;
    boost(boost: number): WildcardSearchQuery;
}
/**
 * Represents a document-id search query.
 *
 * @category Full Text Search
 */
export declare class DocIdSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(...ids: string[]);
    /**
     * Adds additional document-id's to this query.
     *
     * @deprecated Use the multi-argument overload instead.
     */
    addDocIds(ids: string[]): DocIdSearchQuery;
    /**
     * Adds additional document-id's to this query.
     */
    addDocIds(...ids: string[]): DocIdSearchQuery;
    field(field: string): DocIdSearchQuery;
    boost(boost: number): DocIdSearchQuery;
}
/**
 * Represents a boolean-field search query.
 *
 * @category Full Text Search
 */
export declare class BooleanFieldSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(val: boolean);
    field(field: string): BooleanFieldSearchQuery;
    boost(boost: number): BooleanFieldSearchQuery;
}
/**
 * Represents a term search query.
 *
 * @category Full Text Search
 */
export declare class TermSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(term: string);
    field(field: string): TermSearchQuery;
    prefixLength(prefixLength: number): TermSearchQuery;
    fuzziness(fuzziness: number): TermSearchQuery;
    boost(boost: number): TermSearchQuery;
}
/**
 * Represents a phrase search query.
 *
 * @category Full Text Search
 */
export declare class PhraseSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(terms: string[]);
    field(field: string): PhraseSearchQuery;
    boost(boost: number): PhraseSearchQuery;
}
/**
 * Represents a prefix search query.
 *
 * @category Full Text Search
 */
export declare class PrefixSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(prefix: string);
    field(field: string): PrefixSearchQuery;
    boost(boost: number): PrefixSearchQuery;
}
/**
 * Represents a match-all search query.
 *
 * @category Full Text Search
 */
export declare class MatchAllSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor();
}
/**
 * Represents a match-none search query.
 *
 * @category Full Text Search
 */
export declare class MatchNoneSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor();
}
/**
 * Represents a geo-distance search query.
 *
 * @category Full Text Search
 */
export declare class GeoDistanceSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(lon: number, lat: number, distance: string);
    field(field: string): GeoDistanceSearchQuery;
    boost(boost: number): GeoDistanceSearchQuery;
}
/**
 * Represents a geo-bounding-box search query.
 *
 * @category Full Text Search
 */
export declare class GeoBoundingBoxSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(tl_lon: number, tl_lat: number, br_lon: number, br_lat: number);
    field(field: string): GeoBoundingBoxSearchQuery;
    boost(boost: number): GeoBoundingBoxSearchQuery;
}
/**
 * Represents a geo-polygon search query.
 *
 * @category Full Text Search
 */
export declare class GeoPolygonSearchQuery extends SearchQuery {
    /**
     * @internal
     */
    constructor(points: GeoPoint[]);
    field(field: string): GeoPolygonSearchQuery;
    boost(boost: number): GeoPolygonSearchQuery;
}
