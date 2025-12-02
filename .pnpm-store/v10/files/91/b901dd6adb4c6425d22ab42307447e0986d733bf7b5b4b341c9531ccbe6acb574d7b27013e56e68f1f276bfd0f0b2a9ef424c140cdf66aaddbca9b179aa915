import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
export type GeoUnits = 'm' | 'km' | 'mi' | 'ft';
export interface GeoCoordinates {
    longitude: RedisArgument | number;
    latitude: RedisArgument | number;
}
export type GeoSearchFrom = RedisArgument | GeoCoordinates;
export interface GeoSearchByRadius {
    radius: number;
    unit: GeoUnits;
}
export interface GeoSearchByBox {
    width: number;
    height: number;
    unit: GeoUnits;
}
export type GeoSearchBy = GeoSearchByRadius | GeoSearchByBox;
export declare function parseGeoSearchArguments(parser: CommandParser, key: RedisArgument, from: GeoSearchFrom, by: GeoSearchBy, options?: GeoSearchOptions): void;
export type GeoCountArgument = number | {
    value: number;
    ANY?: boolean;
};
export interface GeoSearchOptions {
    SORT?: 'ASC' | 'DESC';
    COUNT?: GeoCountArgument;
}
export declare function parseGeoSearchOptions(parser: CommandParser, options?: GeoSearchOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Queries members inside an area of a geospatial index
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center point of the search (member name or coordinates)
     * @param by - Search area specification (radius or box dimensions)
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, from: GeoSearchFrom, by: GeoSearchBy, options?: GeoSearchOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=GEOSEARCH.d.ts.map