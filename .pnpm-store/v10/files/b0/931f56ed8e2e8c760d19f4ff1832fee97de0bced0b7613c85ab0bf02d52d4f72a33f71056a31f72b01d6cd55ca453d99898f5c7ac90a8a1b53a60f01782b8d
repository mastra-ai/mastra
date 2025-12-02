import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
import { GeoCoordinates, GeoUnits, GeoSearchOptions } from './GEOSEARCH';
export declare function parseGeoRadiusArguments(parser: CommandParser, key: RedisArgument, from: GeoCoordinates, radius: number, unit: GeoUnits, options?: GeoSearchOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Queries members in a geospatial index based on a radius from a center point
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, from: GeoCoordinates, radius: number, unit: GeoUnits, options?: GeoSearchOptions | undefined) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=GEORADIUS.d.ts.map