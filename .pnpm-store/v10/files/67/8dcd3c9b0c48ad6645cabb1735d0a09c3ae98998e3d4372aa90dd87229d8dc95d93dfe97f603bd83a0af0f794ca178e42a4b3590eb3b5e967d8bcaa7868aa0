import { SearchQuery } from './searchquery';
/**
 * Specifies how multiple vector searches are combined.
 *
 * @category Full Text Search
 */
export declare enum VectorQueryCombination {
    /**
     * Indicates that multiple vector queries should be combined with logical AND.
     */
    AND = "and",
    /**
     * Indicates that multiple vector queries should be combined with logical OR.
     */
    OR = "or"
}
/**
 * @category Full Text Search
 */
export interface VectorSearchOptions {
    /**
     * Specifies how multiple vector queries should be combined.
     */
    vectorQueryCombination?: VectorQueryCombination;
}
/**
 * Represents a vector query.
 *
 * @category Full Text Search
 */
export declare class VectorQuery {
    private _fieldName;
    private _vector;
    private _vectorBase64;
    private _numCandidates;
    private _boost;
    private _prefilter;
    constructor(fieldName: string, vector: number[] | string);
    /**
     * @internal
     */
    toJSON(): any;
    /**
     * Adds boost option to vector query.
     *
     * @param boost A floating point value.
     */
    boost(boost: number): VectorQuery;
    /**
     * Adds numCandidates option to vector query. Value must be >= 1.
     *
     * @param numCandidates An integer value.
     */
    numCandidates(numCandidates: number): VectorQuery;
    /**
     * Adds prefilter option to vector query.
     *
     * @param prefilter A SearchQuery.
     */
    prefilter(prefilter: SearchQuery): VectorQuery;
    /**
     * Creates a vector query.
     *
     * @param fieldName The name of the field in the JSON document that holds the vector.
     * @param vector List of floating point values that represent the vector.
     */
    static create(fieldName: string, vector: number[] | string): VectorQuery;
}
/**
 * Represents a vector search.
 *
 * @category Full Text Search
 */
export declare class VectorSearch {
    private _queries;
    private _options;
    constructor(queries: VectorQuery[], options?: VectorSearchOptions);
    /**
     * @internal
     */
    get queries(): VectorQuery[];
    /**
     * @internal
     */
    get options(): VectorSearchOptions | undefined;
    /**
     * Creates a vector search from a single VectorQuery.
     *
     * @param query A vectory query that should be a part of the vector search.
     */
    static fromVectorQuery(query: VectorQuery): VectorSearch;
}
