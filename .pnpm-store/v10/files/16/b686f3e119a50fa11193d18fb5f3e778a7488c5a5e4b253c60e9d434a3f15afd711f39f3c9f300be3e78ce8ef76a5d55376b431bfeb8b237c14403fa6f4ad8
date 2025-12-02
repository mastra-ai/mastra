import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { GeoCoordinates, GeoSearchOptions, GeoUnits } from './GEOSEARCH';
export interface GeoRadiusStoreOptions extends GeoSearchOptions {
    STOREDIST?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Queries members in a geospatial index based on a radius from a center point and stores the results
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param destination - Key to store the results
     * @param options - Additional search and storage options
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, from: GeoCoordinates, radius: number, unit: GeoUnits, destination: RedisArgument, options?: GeoRadiusStoreOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=GEORADIUS_STORE.d.ts.map