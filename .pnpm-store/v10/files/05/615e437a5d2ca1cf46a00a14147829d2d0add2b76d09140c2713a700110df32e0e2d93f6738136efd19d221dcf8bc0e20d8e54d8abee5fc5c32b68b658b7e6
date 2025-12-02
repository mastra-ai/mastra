import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, NullReply } from '../RESP/types';
import { GeoUnits } from './GEOSEARCH';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the distance between two members in a geospatial index
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param member1 - First member in the geospatial index
     * @param member2 - Second member in the geospatial index
     * @param unit - Unit of distance (m, km, ft, mi)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, member1: RedisArgument, member2: RedisArgument, unit?: GeoUnits) => void;
    readonly transformReply: (this: void, reply: BlobStringReply | NullReply) => number | null;
};
export default _default;
//# sourceMappingURL=GEODIST.d.ts.map