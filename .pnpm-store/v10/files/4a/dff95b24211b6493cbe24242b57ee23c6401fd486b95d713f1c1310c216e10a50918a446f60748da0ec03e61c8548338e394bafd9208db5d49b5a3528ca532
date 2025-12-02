/**
 * Provides the ability to specify facets for a search query.
 *
 * @category Full Text Search
 */
export declare class SearchFacet {
    protected _data: any;
    constructor(data: any);
    toJSON(): any;
    static term(field: string, size: number): TermSearchFacet;
    static numeric(field: string, size: number): NumericSearchFacet;
    static date(field: string, size: number): DateSearchFacet;
}
/**
 * Provides ability to request a term facet.
 *
 * @category Full Text Search
 */
export declare class TermSearchFacet extends SearchFacet {
    /**
     * @internal
     */
    constructor(field: string, size: number);
}
/**
 * Provides ability to request a numeric facet.
 *
 * @category Full Text Search
 */
export declare class NumericSearchFacet extends SearchFacet {
    /**
     * @internal
     */
    constructor(field: string, size: number);
    addRange(name: string, min?: number, max?: number): NumericSearchFacet;
}
/**
 * Provides ability to request a date facet.
 *
 * @category Full Text Search
 */
export declare class DateSearchFacet extends SearchFacet {
    /**
     * @internal
     */
    constructor(field: string, size: number);
    addRange(name: string, start?: Date, end?: Date): DateSearchFacet;
}
