import { CommandParser } from '../client/parser';
import { ArrayReply, NullReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
import { HashExpiration } from './HEXPIRE';
declare const _default: {
    /**
     * Parses the arguments for the `HPEXPIRE` command.
     *
     * @param parser - The command parser instance.
     * @param key - The key of the hash.
     * @param fields - The fields to set the expiration for.
     * @param ms - The expiration time in milliseconds.
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT').
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument, ms: number, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => ArrayReply<HashExpiration> | NullReply;
};
export default _default;
//# sourceMappingURL=HPEXPIRE.d.ts.map