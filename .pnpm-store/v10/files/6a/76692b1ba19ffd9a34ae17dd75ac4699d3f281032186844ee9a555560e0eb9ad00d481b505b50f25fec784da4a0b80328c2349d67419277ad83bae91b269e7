import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { ZKeys } from './generic-transformers';
export interface ZUnionOptions {
    AGGREGATE?: 'SUM' | 'MIN' | 'MAX';
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Stores the union of multiple sorted sets in a new sorted set.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param keys - Keys of the sorted sets to combine.
     * @param options - Optional parameters for the union operation.
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, keys: ZKeys, options?: ZUnionOptions) => any;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=ZUNIONSTORE.d.ts.map