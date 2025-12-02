import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { GeoCoordinates } from './GEOSEARCH';
export interface GeoMember extends GeoCoordinates {
    member: RedisArgument;
}
export interface GeoAddOptions {
    condition?: 'NX' | 'XX';
    /**
     * @deprecated Use `{ condition: 'NX' }` instead.
     */
    NX?: boolean;
    /**
     * @deprecated Use `{ condition: 'XX' }` instead.
     */
    XX?: boolean;
    CH?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Adds geospatial items to the specified key
     * @param parser - The Redis command parser
     * @param key - Key to add the geospatial items to
     * @param toAdd - Geospatial member(s) to add
     * @param options - Options for the GEOADD command
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, toAdd: GeoMember | Array<GeoMember>, options?: GeoAddOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=GEOADD.d.ts.map