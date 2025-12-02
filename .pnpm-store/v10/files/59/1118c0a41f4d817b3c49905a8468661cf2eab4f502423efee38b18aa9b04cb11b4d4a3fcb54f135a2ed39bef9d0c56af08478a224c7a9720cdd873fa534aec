import { CommandParser } from '../client/parser';
import { ArrayReply, NullReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
import { HashExpiration } from './HEXPIRE';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Parses the arguments for the `HPEXPIREAT` command.
     *
     * @param parser - The command parser instance.
     * @param key - The key of the hash.
     * @param fields - The fields to set the expiration for.
     * @param timestamp - The expiration timestamp (Unix timestamp or Date object).
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT').
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument, timestamp: number | Date, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => ArrayReply<HashExpiration> | NullReply;
};
export default _default;
//# sourceMappingURL=HPEXPIREAT.d.ts.map