import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
import { GeoSearchOptions, GeoUnits } from './GEOSEARCH';
import { GeoReplyWith } from './GEOSEARCH_WITH';
export declare function parseGeoRadiusByMemberWithArguments(parser: CommandParser, key: RedisArgument, from: RedisArgument, radius: number, unit: GeoUnits, replyWith: Array<GeoReplyWith>, options?: GeoSearchOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Queries members in a geospatial index based on a radius from a member with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Member name to use as center point
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, from: RedisArgument, radius: number, unit: GeoUnits, replyWith: Array<GeoReplyWith>, options?: GeoSearchOptions) => void;
    readonly transformReply: (this: void, reply: import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, ...any[]]>[], replyWith: GeoReplyWith[]) => import("./GEOSEARCH_WITH").GeoReplyWithMember[];
};
export default _default;
//# sourceMappingURL=GEORADIUSBYMEMBER_WITH.d.ts.map