import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
import { GeoCoordinates, GeoSearchOptions, GeoUnits } from './GEOSEARCH';
import { GeoReplyWith } from './GEOSEARCH_WITH';
export declare function parseGeoRadiusWithArguments(parser: CommandParser, key: RedisArgument, from: GeoCoordinates, radius: number, unit: GeoUnits, replyWith: Array<GeoReplyWith>, options?: GeoSearchOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Queries members in a geospatial index based on a radius from a center point with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, from: GeoCoordinates, radius: number, unit: GeoUnits, replyWith: Array<GeoReplyWith>, options?: GeoSearchOptions) => void;
    readonly transformReply: (this: void, reply: import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, ...any[]]>[], replyWith: GeoReplyWith[]) => import("./GEOSEARCH_WITH").GeoReplyWithMember[];
};
export default _default;
//# sourceMappingURL=GEORADIUS_WITH.d.ts.map