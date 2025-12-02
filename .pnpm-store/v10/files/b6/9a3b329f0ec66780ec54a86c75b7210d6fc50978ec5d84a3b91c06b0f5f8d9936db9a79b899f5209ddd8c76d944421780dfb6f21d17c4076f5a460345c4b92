declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Read-only variant that queries members in a geospatial index based on a radius from a member with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Member name to use as center point
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param withValues - Information to include with each returned member
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, from: import("../RESP/types").RedisArgument, radius: number, unit: import("./GEOSEARCH").GeoUnits, replyWith: import("./GEOSEARCH_WITH").GeoReplyWith[], options?: import("./GEOSEARCH").GeoSearchOptions | undefined) => void;
    readonly transformReply: (this: void, reply: import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, ...any[]]>[], replyWith: import("./GEOSEARCH_WITH").GeoReplyWith[]) => import("./GEOSEARCH_WITH").GeoReplyWithMember[];
};
export default _default;
//# sourceMappingURL=GEORADIUSBYMEMBER_RO_WITH.d.ts.map