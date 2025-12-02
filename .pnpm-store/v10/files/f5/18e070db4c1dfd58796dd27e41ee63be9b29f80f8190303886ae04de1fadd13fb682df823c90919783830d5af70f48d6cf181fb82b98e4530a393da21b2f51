import { CommandParser } from '../client/parser';
import { ArrayReply, NullReply, NumberReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the HPTTL command
     *
     * @param parser - The command parser
     * @param key - The key to check time-to-live for
     * @param fields - The fields to check time-to-live for
     * @see https://redis.io/commands/hpttl/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument) => void;
    readonly transformReply: () => ArrayReply<NumberReply> | NullReply;
};
export default _default;
//# sourceMappingURL=HPTTL.d.ts.map