declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Read-only variant that queries members in a geospatial index based on a radius from a center point with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, from: import("./GEOSEARCH").GeoCoordinates, radius: number, unit: import("./GEOSEARCH").GeoUnits, replyWith: import("./GEOSEARCH_WITH").GeoReplyWith[], options?: import("./GEOSEARCH").GeoSearchOptions | undefined) => void;
    readonly transformReply: (this: void, reply: import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, ...any[]]>[], replyWith: import("./GEOSEARCH_WITH").GeoReplyWith[]) => import("./GEOSEARCH_WITH").GeoReplyWithMember[];
};
export default _default;
//# sourceMappingURL=GEORADIUS_RO_WITH.d.ts.map