import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { ZKeys } from './generic-transformers';
import { ZInterOptions } from './ZINTER';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Stores the result of intersection of multiple sorted sets in a new sorted set.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param keys - Keys of the sorted sets to intersect.
     * @param options - Optional parameters for the intersection operation.
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, keys: ZKeys, options?: ZInterOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=ZINTERSTORE.d.ts.map