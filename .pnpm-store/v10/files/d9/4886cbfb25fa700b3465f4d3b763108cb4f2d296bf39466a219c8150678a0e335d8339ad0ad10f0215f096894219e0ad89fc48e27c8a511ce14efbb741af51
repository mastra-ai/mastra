import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the SUNIONSTORE command to store the union of multiple sets into a destination set
     *
     * @param parser - The command parser
     * @param destination - The destination key to store the resulting set
     * @param keys - One or more source set keys to compute the union from
     * @returns The number of elements in the resulting set
     * @see https://redis.io/commands/sunionstore/
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, keys: RedisVariadicArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=SUNIONSTORE.d.ts.map