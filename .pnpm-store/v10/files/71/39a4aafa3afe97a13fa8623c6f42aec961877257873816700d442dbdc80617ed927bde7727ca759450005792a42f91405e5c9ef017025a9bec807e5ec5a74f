declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Read-only variant that queries members in a geospatial index based on a radius from a center point
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param options - Additional search options
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, from: import("./GEOSEARCH").GeoCoordinates, radius: number, unit: import("./GEOSEARCH").GeoUnits, options?: import("./GEOSEARCH").GeoSearchOptions | undefined) => void;
    readonly transformReply: () => import("../RESP/types").ArrayReply<import("../RESP/types").BlobStringReply<string>>;
};
export default _default;
//# sourceMappingURL=GEORADIUS_RO.d.ts.map