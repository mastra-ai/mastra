import { CommandParser } from '../client/parser';
import { ArrayReply, BlobStringReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the SUNION command to return the members of the set resulting from the union of all the given sets
     *
     * @param parser - The command parser
     * @param keys - One or more set keys to compute the union from
     * @returns Array of all elements that are members of at least one of the given sets
     * @see https://redis.io/commands/sunion/
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: RedisVariadicArgument) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=SUNION.d.ts.map