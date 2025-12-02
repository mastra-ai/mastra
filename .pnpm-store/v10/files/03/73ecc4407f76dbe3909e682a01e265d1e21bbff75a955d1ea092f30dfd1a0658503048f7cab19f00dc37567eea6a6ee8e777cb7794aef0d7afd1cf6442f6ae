/**
 * Provides the ability to specify sorting for a search query.
 *
 * @category Full Text Search
 */
export declare class SearchSort {
    protected _data: any;
    constructor(data: any);
    toJSON(): any;
    static score(): ScoreSearchSort;
    static id(): IdSearchSort;
    static field(field: string): FieldSearchSort;
    static geoDistance(field: string, lat: number, lon: number): GeoDistanceSearchSort;
}
/**
 * Provides sorting for a search query by score.
 *
 * @category Full Text Search
 */
export declare class ScoreSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor();
    descending(descending: boolean): ScoreSearchSort;
}
/**
 *  Provides sorting for a search query by document id.
 *
 * @category Full Text Search
 */
export declare class IdSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor();
    descending(descending: boolean): IdSearchSort;
}
/**
 *  Provides sorting for a search query by a specified field.
 *
 * @category Full Text Search
 */
export declare class FieldSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor(field: string);
    type(type: string): FieldSearchSort;
    mode(mode: string): FieldSearchSort;
    missing(missing: boolean): FieldSearchSort;
    descending(descending: boolean): FieldSearchSort;
}
/**
 *  Provides sorting for a search query by geographic distance from a point.
 *
 * @category Full Text Search
 */
export declare class GeoDistanceSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor(field: string, lat: number, lon: number);
    unit(unit: string): GeoDistanceSearchSort;
    descending(descending: boolean): GeoDistanceSearchSort;
}
