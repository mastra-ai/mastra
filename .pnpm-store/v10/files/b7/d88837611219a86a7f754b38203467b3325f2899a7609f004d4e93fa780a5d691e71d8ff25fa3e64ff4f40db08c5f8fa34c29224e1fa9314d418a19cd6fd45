import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { GeoSearchFrom, GeoSearchBy, GeoSearchOptions } from './GEOSEARCH';
export interface GeoSearchStoreOptions extends GeoSearchOptions {
    STOREDIST?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Searches a geospatial index and stores the results in a new sorted set
     * @param parser - The Redis command parser
     * @param destination - Key to store the results
     * @param source - Key of the geospatial index to search
     * @param from - Center point of the search (member name or coordinates)
     * @param by - Search area specification (radius or box dimensions)
     * @param options - Additional search and storage options
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, source: RedisArgument, from: GeoSearchFrom, by: GeoSearchBy, options?: GeoSearchStoreOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=GEOSEARCHSTORE.d.ts.map