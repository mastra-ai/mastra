import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, TuplesReply, BlobStringReply, NumberReply, DoubleReply, UnwrapReply } from '../RESP/types';
import { GeoSearchBy, GeoSearchFrom, GeoSearchOptions } from './GEOSEARCH';
export declare const GEO_REPLY_WITH: {
    readonly DISTANCE: "WITHDIST";
    readonly HASH: "WITHHASH";
    readonly COORDINATES: "WITHCOORD";
};
export type GeoReplyWith = typeof GEO_REPLY_WITH[keyof typeof GEO_REPLY_WITH];
export interface GeoReplyWithMember {
    member: BlobStringReply;
    distance?: BlobStringReply;
    hash?: NumberReply;
    coordinates?: {
        longitude: DoubleReply;
        latitude: DoubleReply;
    };
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Queries members inside an area of a geospatial index with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center point of the search (member name or coordinates)
     * @param by - Search area specification (radius or box dimensions)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, from: GeoSearchFrom, by: GeoSearchBy, replyWith: Array<GeoReplyWith>, options?: GeoSearchOptions) => void;
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<TuplesReply<[BlobStringReply, ...Array<any>]>>>, replyWith: Array<GeoReplyWith>) => GeoReplyWithMember[];
};
export default _default;
//# sourceMappingURL=GEOSEARCH_WITH.d.ts.map